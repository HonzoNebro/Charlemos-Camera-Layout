import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { endEditSession } from "../../scripts/edit-runtime.js";
import { setApp } from "../../scripts/state.js";

const dictionary = JSON.parse(readFileSync(new URL("../../lang/en.json", import.meta.url)));
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {
    constructor() { this.id = "editor"; }
    render() { return this; }
    async close() { this.closed = true; return this; }
  } } },
  utils: { escapeHTML: (value) => String(value ?? ""), deepClone: structuredClone, randomID: () => "test-template" }
};
const { CameraEditorApp } = await import("../../scripts/camera-editor-app.js");
const { updateCameraField, fieldDisabled } = await import("../../scripts/editor-fields.js");
const { FRAME_PRESETS, applyFramePreset } = await import("../../scripts/editor-frame-presets.js");
const { templateFromProfile } = await import("../../scripts/profile-library.js");

test("guided shape controls preserve custom CSS until explicit replacement and use role drafts", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.cameraAudience = "player";
  const change = (name, value) => app.change({ target: { name, value, dataset: {}, tagName: "SELECT", checkValidity: () => true } });
  change("basicShape", "circle(45%)");
  change("shape-radius", "30");
  assert.equal(app.cameraSession.draft.profile.layouts.u.clipPath, "circle(30% at 50% 50%)");
  assert.equal(app.session.draft.profile.layouts.u.clipPath, undefined);
  assert.equal(store.sceneProfiles.a.layouts.u.clipPath, undefined);
  change("shape-radius", "101");
  assert.equal(app.cameraSession.draft.profile.layouts.u.clipPath, "circle(30% at 50% 50%)");
  assert.ok(app.message);
  change("basicShape", "url(#custom)");
  change("shape-radius", "10");
  assert.equal(app.cameraSession.draft.profile.layouts.u.clipPath, "url(#custom)");
  assert.doesNotMatch(app.guidedShapeHtml("url(#custom)"), /name="shape-radius"/);
  assert.match(app.guidedShapeHtml("url(#custom)"), /charlemos-shape-preview/);
  assert.match(app.guidedShapeHtml("circle(45%)"), /name="shape-radius"/);
  assert.match(app.guidedShapeHtml("polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"), /name="shape-x1"/);
  assert.match(app.frameAlignmentHtml(), /data-alignment="middle"/);
  app.session.undo();
  assert.equal(app.cameraSession.draft.profile.layouts.u.clipPath, "circle(30% at 50% 50%)");
});

test("visual controls appear only with the camera, frame or name they edit", async () => {
  environment();
  const app = new CameraEditorApp();
  const context = await app._prepareContext();
  app.area = "cameras";
  app.section = "layout";
  const layout = await app._renderHTML(context);
  assert.match(layout, /Edit camera on screen/);
  assert.match(layout, /Convert to absolute records the current visible rectangle/);
  app.section = "effects";
  assert.doesNotMatch(await app._renderHTML(context), /Edit camera on screen|Edit frame on screen|Edit name on screen/);
  app.section = "overlay";
  const overlay = await app._renderHTML(context);
  assert.match(overlay, /Edit frame on screen/);
  assert.match(overlay, /data-element="overlay"/);
  assert.equal(app.visualElement(), "overlay");
  app.section = "name";
  const name = await app._renderHTML(context);
  assert.match(name, /Edit name on screen/);
  assert.match(name, /data-element="name"/);
  assert.equal(app.visualElement(), "name");
});

test("basic effect removal is an inline disabled hint at the default value", async () => {
  environment();
  const app = new CameraEditorApp();
  const defaults = app.basicEffectsHtml({});
  assert.match(defaults, /data-effect="rotate"[^>]*disabled/);
  const changed = app.basicEffectsHtml({ transform: "rotate(12deg)" });
  assert.doesNotMatch(changed, /data-effect="rotate"[^>]*disabled/);
  assert.match(changed, /charlemos-basic-effect/);
});

function environment() {
  endEditSession(); setApp(null);
  const store = { sceneProfiles: { a: { enabled: true, cameraControlMode: "module", layouts: { u: { left: "12vw", filter: "url(#custom)", geometry: { custom: 42 }, overlay: { enabled: false, extra: 7 } } } } }, sceneCamera: {}, playerLayouts: {} };
  const users = [{ id: "u", name: "Ana", active: true }, { id: "v", name: "Bea", active: false }];
  const scenes = [{ id: "a", name: "Tavern" }, { id: "b", name: "Castle" }];
  globalThis.game = {
    user: { id: "u", isGM: true }, i18n: { localize: (key) => dictionary[key] ?? key },
    users: { contents: users, get: (id) => users.find((user) => user.id === id) },
    scenes: { contents: scenes, get: (id) => scenes.find((scene) => scene.id === id) },
    settings: { get: (_module, key) => store[key] ?? {}, set: async (_module, key, value) => { store[key] = value; } }
  };
  globalThis.canvas = { scene: { id: "a" } };
  globalThis.window = { innerWidth: 1280, innerHeight: 720, confirm: () => true };
  globalThis.ui = {};
  return store;
}

test("all panel sections render translated controls without opening subwindows", async () => {
  environment();
  const app = new CameraEditorApp();
  const context = await app._prepareContext();
  for (const area of ["scene", "cameras", "tools"]) {
    app.area = area;
    for (const section of ["layout", "effects", "overlay", "name"]) {
      app.section = section;
      const html = await app._renderHTML(context);
      assert.doesNotMatch(html, /charlemos-camera-layout\.ui\./, `${area}/${section} has untranslated keys`);
      assert.match(html, /Tavern/);
      assert.match(html, /data-editor-action="apply"/);
      assert.doesNotMatch(html, /open-layout-config/);
    }
  }
});

test("editing one field preserves raw CSS, inactive geometry and custom properties", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  updateCameraField(app.session, "u", "overlayOpacity", "0.5");
  assert.equal(app.session.draft.profile.layouts.u.filter, "url(#custom)");
  assert.equal(app.session.draft.profile.layouts.u.left, "12vw");
  assert.equal(app.session.draft.profile.layouts.u.geometry.custom, 42);
  assert.equal(app.session.draft.profile.layouts.u.overlay.extra, 7);
  assert.equal(store.sceneProfiles.a.layouts.u.overlay.opacity, undefined);
  app.selectedUserId = "v";
  await app._prepareContext();
  assert.equal(app.session.draft.profile.layouts.u.overlay.opacity, 0.5);
});

test("closing dirty panel requests a decision; discard does not persist", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  updateCameraField(app.session, "u", "overlayOpacity", "0.2");
  await app.close();
  assert.equal(app.closeRequested, true);
  assert.notEqual(app.closed, true);
  await app.close({ discard: true });
  assert.equal(app.closed, true);
  assert.equal(store.sceneProfiles.a.layouts.u.overlay.opacity, undefined);
});

test("deleted scenes preserve the complete draft for inspection", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  updateCameraField(app.session, "u", "overlayOpacity", "0.2");
  const before = structuredClone(app.session.draft);
  delete store.sceneProfiles.a;
  game.scenes.get = () => null;
  const context = await app._prepareContext();
  assert.equal(context.problem, "sceneDeleted");
  assert.deepEqual(app.session.draft, before);
});

test("relative sizing remains available and controls disclose dependencies", () => {
  assert.equal(fieldDisabled("width", { layoutMode: "relative" }, true), false);
  assert.equal(fieldDisabled("left", { layoutMode: "relative" }, true), true);
  assert.equal(fieldDisabled("width", {}, false), true);
  assert.equal(fieldDisabled("overlayBoundsTop", { overlayBoundsMode: "camera" }, true), true);
});

test("frame presets preserve media and camera configuration and form one local undo step", async () => {
  for (const enabled of [true, false]) {
    for (const [id, bounds] of Object.entries(FRAME_PRESETS)) {
      const store = environment();
      Object.assign(store.sceneProfiles.a.layouts.u.overlay, {
        enabled, imageUrl: "art/frame.webm", opacity: 0.4, tint: { color: "#123456" },
        offset: { x: "calc(2vw + 4px)", y: "3vh", custom: 8 }, scale: 2, rotate: 35
      });
      const saved = structuredClone(store);
      const app = new CameraEditorApp();
      await app._prepareContext();
      const before = structuredClone(app.session.draft);
      await app.action("frame-preset", { dataset: { preset: id } });
      const layout = app.session.draft.profile.layouts.u;
      assert.deepEqual(layout.overlay.bounds, bounds);
      assert.equal(layout.overlay.fitMode, "contain");
      assert.equal(layout.overlay.anchor, "center");
      assert.equal(layout.overlay.scale, 1);
      assert.equal(layout.overlay.rotate, 0);
      assert.deepEqual(layout.overlay.offset, { x: "0px", y: "0px", custom: 8 });
      for (const key of ["imageUrl", "opacity", "tint", "enabled", "extra"]) {
        assert.deepEqual(layout.overlay[key], before.profile.layouts.u.overlay[key]);
      }
      const { overlay: _overlay, ...camera } = layout;
      const { overlay: _previous, ...previousCamera } = before.profile.layouts.u;
      assert.deepEqual(camera, previousCamera);
      assert.deepEqual(store, saved);
      assert.equal(app.session.preview, true);
      assert.equal(app.session.history.length, 1);
      const after = structuredClone(app.session.draft);
      app.session.undo();
      assert.deepEqual(app.session.draft, before);
      app.session.redo();
      assert.deepEqual(app.session.draft, after);
      await app.close({ discard: true });
      assert.deepEqual(store, saved);
    }
  }
});

test("frame preset actions reject invalid targets and unsafe session contexts", async () => {
  environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  const before = structuredClone(app.session.draft);
  assert.equal(applyFramePreset(app.session, "u", "unknown"), false);
  assert.equal(applyFramePreset(app.session, "u", "__proto__"), false);
  for (const problem of ["scene", "user", "busy"]) {
    canvas.scene.id = problem === "scene" ? "b" : "a";
    app.selectedUserId = problem === "user" ? "missing" : "u";
    app.session.busy = problem === "busy";
    await app.action("frame-preset", { dataset: { preset: "outside" } });
    assert.deepEqual(app.session.draft, before);
  }
});

test("frame presets are translated, accessible draft actions in the overlay section", async () => {
  environment();
  const app = new CameraEditorApp();
  app.area = "cameras";
  app.section = "overlay";
  const context = await app._prepareContext();
  for (const lang of ["en", "es", "gl"]) {
    const labels = JSON.parse(readFileSync(new URL(`../../lang/${lang}.json`, import.meta.url)));
    game.i18n.localize = (key) => labels[key] ?? key;
    const html = await app._renderHTML(context);
    assert.doesNotMatch(html, /charlemos-camera-layout\.ui\./);
    assert.equal((html.match(/data-editor-action="frame-preset"/g) ?? []).length, 3);
    assert.match(html, /class="charlemos-frame-diagram" aria-hidden="true"/);
    for (const id of Object.keys(FRAME_PRESETS)) assert.match(html, new RegExp(`data-preset="${id}"`));
  }
});

test("frame presets on an unconfigured camera do not invent a resource or enable its overlay", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.selectedUserId = "v";
  await app.action("frame-preset", { dataset: { preset: "lower" } });
  const overlay = app.session.draft.profile.layouts.v.overlay;
  assert.equal(overlay.bounds.bottom, 25);
  assert.equal(overlay.enabled, undefined);
  assert.equal(overlay.imageUrl, undefined);
  assert.equal(store.sceneProfiles.a.layouts.v, undefined);
  app.session.undo();
  assert.equal(app.session.draft.profile.layouts.v, undefined);
});

test("frame blending is local, reversible and independent from tint and presets", async () => {
  for (const mode of ["auto", "normal", "screen", "soft-light"]) {
    const store = environment();
    const saved = structuredClone(store);
    const app = new CameraEditorApp();
    await app._prepareContext();
    const before = structuredClone(app.session.draft);
    await app.action("frame-blend", { dataset: { mode } });
    assert.equal(app.session.preview, true);
    assert.equal(app.session.history.length, 1);
    const expected = structuredClone(before);
    expected.profile.layouts.u.overlay.blendMode = mode;
    assert.deepEqual(app.session.draft, expected);
    assert.deepEqual(store, saved);
    app.session.undo();
    assert.deepEqual(app.session.draft, before);
    app.session.redo();
    assert.deepEqual(app.session.draft, expected);
    await app.action("frame-preset", { dataset: { preset: "outside" } });
    assert.equal(app.session.draft.profile.layouts.u.overlay.blendMode, mode);
    await app.close({ discard: true });
    assert.deepEqual(store, saved);
  }
});

test("frame blending blocks invalid choices and scene changes", async () => {
  environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  const before = structuredClone(app.session.draft);
  await app.action("frame-blend", { dataset: { mode: "invalid" } });
  assert.deepEqual(app.session.draft, before);
  canvas.scene.id = "b";
  await app.action("frame-blend", { dataset: { mode: "screen" } });
  assert.deepEqual(app.session.draft, before);
});

test("duplicating a saved scene composition opens a destination draft and never copies its background", async () => {
  const store = environment();
  store.sceneCamera = { a: { playerId: "u" }, b: { playerId: "v", fit: "contain" } };
  const saved = structuredClone(store);
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.duplicateSource = "a";
  app.duplicateDestination = "b";
  await app.duplicateProfile();
  assert.equal(app.session.sceneId, "b");
  assert.equal(app.session.history.length, 1);
  assert.deepEqual(app.session.draft.background, saved.sceneCamera.b);
  assert.deepEqual(app.session.draft.profile.layouts, saved.sceneProfiles.a.layouts);
  assert.deepEqual(store, saved);
  assert.equal((await app._prepareContext()).problem, "sceneChanged");
});

test("declining duplication and source changes during review preserve the current draft", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.duplicateSource = "a"; app.duplicateDestination = "b";
  const before = structuredClone(app.session.draft);
  window.confirm = () => false;
  await app.duplicateProfile();
  assert.deepEqual(app.session.draft, before);
  window.confirm = () => { store.sceneProfiles.a.layouts.u.left = "90px"; return true; };
  await app.duplicateProfile();
  assert.equal(app.message, dictionary["charlemos-camera-layout.ui.editor.profilesChanged"]);
  assert.equal(app.session.sceneId, "a");
  assert.deepEqual(app.session.draft, before);
});

test("saving a library template explicitly distinguishes saved state from the draft", async () => {
  for (const source of ["saved", "draft"]) {
    const store = environment();
    const persisted = structuredClone(store.sceneProfiles);
    const app = new CameraEditorApp();
    await app._prepareContext();
    updateCameraField(app.session, "u", "left", "35vw");
    const before = structuredClone(app.session.draft);
    app.library.name = "Reusable";
    app.library.source = source;
    await app.action("template-create", { dataset: {} });
    const entry = store.profileLibrary[app.library.selectedId];
    assert.equal(entry.name, "Reusable");
    assert.equal(entry.profile.layouts.u.left, source === "saved" ? "12vw" : "35vw");
    assert.equal(entry.profile.layouts.u.geometry.custom, 42);
    assert.deepEqual(app.session.draft, before);
    assert.deepEqual(store.sceneProfiles, persisted);
    await app.close({ discard: true });
    assert.ok(store.profileLibrary[app.library.selectedId]);
  }
});

test("template loading maps IDs and is one reversible scene-draft operation", async () => {
  const store = environment();
  store.sceneCamera.a = { playerId: "u", fit: "contain" };
  store.profileLibrary = { template: templateFromProfile("Reusable", { cameraControlMode: "native", layouts: { old: { width: "20vw", overlay: { enabled: false, imageUrl: "art.png" } } } }) };
  const saved = structuredClone(store);
  const app = new CameraEditorApp();
  await app._prepareContext();
  const before = structuredClone(app.session.draft);
  app.library.selectTemplate("template", game.users.contents);
  assert.equal(app.library.mappings.old, "__unresolved__");
  await app.action("template-load", { dataset: {} });
  assert.deepEqual(app.session.draft, before);
  app.library.mappings.old = "v";
  await app.action("template-load", { dataset: {} });
  assert.equal(app.session.draft.profile.layouts.v.width, "20vw");
  assert.deepEqual(app.session.draft.profile.layouts.u, before.profile.layouts.u);
  assert.deepEqual(app.session.draft.background, before.background);
  assert.equal(app.session.history.length, 1);
  assert.equal(app.session.preview, true);
  assert.deepEqual(store, saved);
  app.session.undo();
  assert.deepEqual(app.session.draft, before);
  app.session.redo();
  assert.equal(app.session.draft.profile.layouts.v.width, "20vw");
  await app.close({ discard: true });
  assert.deepEqual(store, saved);
});

test("changed templates require refresh, and rename/delete never mutate scenes", async () => {
  const store = environment();
  store.profileLibrary = { template: templateFromProfile("First", store.sceneProfiles.a) };
  const scenes = structuredClone(store.sceneProfiles);
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.library.selectTemplate("template", game.users.contents);
  store.profileLibrary.template.name = "Other GM";
  await app.action("template-delete", { dataset: {} });
  assert.ok(store.profileLibrary.template);
  assert.equal(app.message, dictionary["charlemos-camera-layout.ui.editor.templateChanged"]);
  await app.action("template-refresh", { dataset: {} });
  app.library.name = "Renamed";
  await app.action("template-rename", { dataset: {} });
  assert.equal(store.profileLibrary.template.name, "Renamed");
  assert.equal(store.profileLibrary.template.revision, 2);
  await app.action("template-delete", { dataset: {} });
  assert.deepEqual(store.profileLibrary, {});
  assert.deepEqual(store.sceneProfiles, scenes);
});

test("template writes respect scene changes, GM permission, cancellation and write failures", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.library.name = "Reusable";
  const before = structuredClone(app.session.draft);
  canvas.scene.id = "b";
  await app.action("template-create", { dataset: {} });
  assert.equal(store.profileLibrary, undefined);
  canvas.scene.id = "a";
  game.user.isGM = false;
  await app.action("template-create", { dataset: {} });
  assert.equal(store.profileLibrary, undefined);
  game.user.isGM = true;
  window.confirm = () => false;
  await app.action("template-create", { dataset: {} });
  assert.equal(store.profileLibrary, undefined);
  window.confirm = () => true;
  game.settings.set = async () => { throw new Error("offline"); };
  await app.action("template-create", { dataset: {} });
  assert.equal(store.profileLibrary, undefined);
  assert.equal(app.library.busy, false);
  assert.deepEqual(app.session.draft, before);
  assert.equal(app.message, dictionary["charlemos-camera-layout.ui.editor.recoveryComplete"]);
});

test("library management remains accessible without a scene and translates all controls", async () => {
  const store = environment();
  store.profileLibrary = { template: templateFromProfile("Reusable", store.sceneProfiles.a) };
  canvas.scene = null;
  const app = new CameraEditorApp();
  app.area = "tools";
  const context = await app._prepareContext();
  app.library.selectTemplate("template", game.users.contents);
  for (const lang of ["en", "es", "gl"]) {
    const labels = JSON.parse(readFileSync(new URL(`../../lang/${lang}.json`, import.meta.url)));
    game.i18n.localize = (key) => labels[key] ?? key;
    const html = await app._renderHTML(context);
    assert.doesNotMatch(html, /charlemos-camera-layout\.ui\./);
    assert.match(html, /data-editor-action="template-create" disabled/);
    assert.match(html, /data-editor-action="template-load" disabled/);
  }
  await app.action("template-delete", { dataset: {} });
  assert.deepEqual(store.profileLibrary, {});
});

test("template loading rechecks deleted users and changed templates after confirmation", async () => {
  const store = environment();
  store.profileLibrary = { template: templateFromProfile("Reusable", { layouts: { u: { left: "40px" } } }) };
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.library.selectTemplate("template", game.users.contents);
  const before = structuredClone(app.session.draft);
  window.confirm = () => { store.profileLibrary.template.revision++; return true; };
  await app.action("template-load", { dataset: {} });
  assert.deepEqual(app.session.draft, before);
  app.library.selectTemplate("template", game.users.contents);
  window.confirm = () => { game.users.contents.splice(0, 1); return true; };
  await app.action("template-load", { dataset: {} });
  assert.deepEqual(app.session.draft, before);
});

test("library saves prevent duplicate submissions and closing while a write is pending", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  app.library.name = "Reusable";
  let finish;
  let writes = 0;
  game.settings.set = async (_module, key, data) => {
    writes++;
    await new Promise((resolve) => { finish = resolve; });
    store[key] = data;
  };
  const saving = app.action("template-create", { dataset: {} });
  assert.equal(app.library.busy, true);
  await app.action("template-create", { dataset: {} });
  await app.close({ discard: true });
  assert.notEqual(app.closed, true);
  assert.equal(writes, 1);
  finish();
  await saving;
  assert.equal(app.library.busy, false);
  assert.equal(Object.keys(store.profileLibrary).length, 1);
});

test("camera audience controls route forms, frame presets and visual edits into the chosen role", async () => {
  const store = environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  const base = structuredClone(app.session.draft.profile.layouts);
  const change = (name, value, tagName = "SELECT") => app.change({ target: { name, value, tagName, type: "text", dataset: {}, checkValidity: () => true } });
  change("cameraAudience", "player");
  assert.equal(app.session.previewAudience, "player");
  change("overlayOpacity", "0.6", "INPUT");
  assert.equal(app.session.draft.profile.roleVariants.player.layouts.u.overlay.opacity, 0.6);
  await app.action("frame-preset", { dataset: { preset: "outside" } });
  assert.equal(app.session.draft.profile.roleVariants.player.layouts.u.overlay.bounds.top, 10);
  app.toggleVisual();
  app.visual.session.edit(["profile", "layouts", "u", "left"], "28vw");
  assert.equal(app.session.draft.profile.roleVariants.player.layouts.u.left, "28vw");
  assert.deepEqual(app.session.draft.profile.layouts, base);
  assert.equal(store.sceneProfiles.a.roleVariants, undefined);
  change("cameraAudience", "gm");
  assert.equal(app.visual, null);
  change("nameText", "GM only", "INPUT");
  assert.equal(app.session.draft.profile.roleVariants.gm.layouts.u.nameStyle.text, "GM only");
  assert.equal(app.session.draft.profile.roleVariants.player.layouts.u.nameStyle, undefined);
  await app.action("inherit-role", { dataset: {} });
  assert.equal(app.session.draft.profile.roleVariants.gm, undefined);
  app.session.undo();
  assert.equal(app.session.draft.profile.roleVariants.gm.layouts.u.nameStyle.text, "GM only");
});

test("role form sections render translated effective values and inheritance controls", async () => {
  const store = environment();
  store.sceneProfiles.a.roleVariants = { gm: { layouts: { u: { left: "75vw" } } } };
  const app = new CameraEditorApp();
  app.area = "cameras";
  app.cameraAudience = "gm";
  const context = await app._prepareContext();
  for (const lang of ["en", "es", "gl"]) {
    const labels = JSON.parse(readFileSync(new URL(`../../lang/${lang}.json`, import.meta.url)));
    game.i18n.localize = (key) => labels[key] ?? key;
    for (const section of ["layout", "effects", "overlay", "name"]) {
      app.section = section;
      const html = await app._renderHTML(context);
      assert.doesNotMatch(html, /charlemos-camera-layout\.ui\./);
      assert.match(html, /data-editor-action="inherit-camera"/);
      assert.match(html, /name="previewAudience"/);
    }
  }
  app.section = "layout";
  app.resetSection();
  assert.equal(app.cameraSession.draft.profile.layouts.u.left, "12vw");
  assert.equal(app.session.draft.profile.layouts.u.left, "12vw");
});

test("invalid macro role payloads do not replace a pending editor draft", async () => {
  environment();
  const app = new CameraEditorApp();
  await app._prepareContext();
  updateCameraField(app.session, "u", "left", "33vw");
  const before = structuredClone(app.session.draft);
  assert.equal(await app.loadDraft("b", { layouts: {}, roleVariants: { unknown: {} } }), false);
  assert.equal(app.session.sceneId, "a");
  assert.deepEqual(app.session.draft, before);
});
