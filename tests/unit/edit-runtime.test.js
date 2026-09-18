import test from "node:test";
import assert from "node:assert/strict";
import { beginEditSession, endEditSession, applyEditSession, previewConfiguration } from "../../scripts/edit-runtime.js";
import { getSceneProfile } from "../../scripts/effective-camera-state.js";

function environment() {
  endEditSession();
  const store = { sceneProfiles: { a: { enabled: true, cameraControlMode: "module", layouts: { u: { left: "20vw", custom: 42 } } }, b: { layouts: {} } }, sceneCamera: {} };
  const writes = [];
  globalThis.canvas = { scene: { id: "a" } };
  globalThis.game = {
    user: { isGM: true }, scenes: { get: (id) => ["a", "b"].includes(id) ? { id } : null }, users: { get: (id) => id === "u" ? { id, active: false } : null },
    settings: { get: (_module, key) => store[key], set: async (_module, key, value) => { writes.push(key); store[key] = value; } }
  };
  return { store, writes };
}

test("preview is local, preserves inactive geometry and cancellation reveals latest saved state", async () => {
  const { store, writes } = environment();
  const session = beginEditSession("a");
  session.edit(["profile", "cameraControlMode"], "native");
  session.preview = true;
  assert.equal(getSceneProfile().cameraControlMode, "native");
  assert.equal(store.sceneProfiles.a.cameraControlMode, "module");
  assert.equal(writes.length, 0);
  game.user.isGM = false;
  assert.equal(previewConfiguration("a"), null);
  game.user.isGM = true;
  assert.equal((await applyEditSession()).ok, true);
  assert.equal(store.sceneProfiles.a.layouts.u.left, "20vw");
  assert.equal(store.sceneProfiles.a.layouts.u.custom, 42);
  session.edit(["profile", "layouts", "u", "left"], "30vw");
  endEditSession();
  assert.equal(getSceneProfile().layouts.u.left, "20vw");
});

test("scene switches suspend preview and prevent writes to either scene", async () => {
  const { writes } = environment();
  const session = beginEditSession("a");
  session.edit(["profile", "layouts", "u", "filter"], "blur(1px)");
  session.preview = true;
  canvas.scene.id = "b";
  assert.equal(previewConfiguration("a"), null);
  assert.equal((await applyEditSession()).reason, "sceneChanged");
  assert.deepEqual(writes, []);
});

test("external changes merge, conflicts block and deleted users cannot be saved", async () => {
  const { store } = environment();
  const session = beginEditSession("a");
  session.edit(["profile", "layouts", "u", "left"], "40vw");
  store.sceneProfiles.a.layouts.u.left = "50vw";
  assert.equal((await applyEditSession()).reason, "conflicts");
  session.resolve(["profile", "layouts", "u", "left"], true);
  game.users.get = () => null;
  assert.equal((await applyEditSession()).reason, "userDeleted");
});

test("duplicate apply is rejected while a write is pending", async () => {
  const { store } = environment();
  const session = beginEditSession("a");
  session.edit(["profile", "layouts", "u", "filter"], "blur(1px)");
  let release;
  game.settings.set = async (_module, key, value) => { await new Promise((resolve) => { release = resolve; }); store[key] = value; };
  const pending = applyEditSession();
  assert.equal((await applyEditSession()).reason, "busy");
  release();
  assert.equal((await pending).ok, true);
});
