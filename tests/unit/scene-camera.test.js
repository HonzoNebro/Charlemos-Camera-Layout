import test from "node:test";
import assert from "node:assert/strict";
import {
  applySceneProfile,
  getSceneCamera,
  getSceneProfile,
  migrateLegacySceneProfiles,
  resetSceneProfile,
  sceneProfileEnabled,
  setSceneCamera
} from "../../scripts/scene-camera.js";

function installSettings(initial) {
  const store = {
    sceneCamera: initial.sceneCamera ?? {},
    sceneProfiles: initial.sceneProfiles ?? {}
  };
  globalThis.canvas = { scene: { id: "scene-a" } };
  globalThis.game = {
    settings: {
      get: (_moduleId, key) => store[key],
      set: async (_moduleId, key, value) => {
        store[key] = value;
        return value;
      }
    }
  };
  return store;
}

test("migrateLegacySceneProfiles moves old profile payload out of sceneCamera", async () => {
  const store = installSettings({
    sceneCamera: {
      "scene-a": { enabled: true, layouts: { u1: { filter: "blur(1px)" } } },
      "scene-b": { playerId: "u2" }
    },
    sceneProfiles: {}
  });

  const migrated = await migrateLegacySceneProfiles();

  assert.equal(migrated, true);
  assert.deepEqual(store.sceneProfiles["scene-a"], { enabled: true, layouts: { u1: { filter: "blur(1px)" } } });
  assert.deepEqual(store.sceneCamera["scene-b"], { playerId: "u2" });
  assert.equal(store.sceneCamera["scene-a"], undefined);
});

test("sceneCamera and sceneProfiles stay isolated", async () => {
  installSettings({ sceneCamera: {}, sceneProfiles: {} });

  await setSceneCamera("scene-a", "u1");
  await applySceneProfile("scene-a", { u1: { clipPath: "circle(45%)" } });

  assert.deepEqual(getSceneCamera({ id: "scene-a" }), { playerId: "u1" });
  assert.deepEqual(getSceneProfile({ id: "scene-a" }), { enabled: true, layouts: { u1: { clipPath: "circle(45%)" } } });
  assert.equal(sceneProfileEnabled({ id: "scene-a" }), true);
});

test("resetSceneProfile removes scene profile entry", async () => {
  installSettings({
    sceneCamera: {},
    sceneProfiles: {
      "scene-a": { enabled: true, layouts: { u1: { filter: "grayscale(0.5)" } } }
    }
  });

  const reset = await resetSceneProfile("scene-a");

  assert.equal(reset, true);
  assert.equal(getSceneProfile({ id: "scene-a" }), null);
  assert.equal(sceneProfileEnabled({ id: "scene-a" }), false);
});
