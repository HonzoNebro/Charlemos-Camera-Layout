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
