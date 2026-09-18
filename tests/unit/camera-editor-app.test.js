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
  utils: { escapeHTML: (value) => String(value ?? ""), deepClone: structuredClone }
};
const { CameraEditorApp } = await import("../../scripts/camera-editor-app.js");
const { updateCameraField, fieldDisabled } = await import("../../scripts/editor-fields.js");
const { FRAME_PRESETS, applyFramePreset } = await import("../../scripts/editor-frame-presets.js");

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
