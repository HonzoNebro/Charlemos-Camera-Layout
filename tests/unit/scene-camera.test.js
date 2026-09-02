import test from "node:test";
import assert from "node:assert/strict";
import {
  applySceneProfile,
  getSceneCameraControlMode,
  getSceneCamera,
  getSceneProfile,
  migrateLegacySceneProfiles,
  normalizeSceneCamera,
  pruneMissingSceneState,
  resetSceneCamera,
  resetSceneProfile,
  sanitizeSceneCameras,
  sceneProfileEnabled,
  setSceneCameraControlMode,
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
  assert.deepEqual(store.sceneCamera["scene-b"], { playerId: "u2", fit: "cover" });
  assert.equal(store.sceneCamera["scene-a"], undefined);
});

test("migrateLegacySceneProfiles normalizes legacy scene camera entries", async () => {
  const store = installSettings({
    sceneCamera: {
      "scene-a": { playerId: "u1" },
      "scene-b": { playerId: "u2", fit: "invalid" },
      "scene-invalid": { fit: "fill" }
    },
    sceneProfiles: {}
  });

  const migrated = await migrateLegacySceneProfiles();

  assert.equal(migrated, true);
  assert.deepEqual(store.sceneCamera, {
    "scene-a": { playerId: "u1", fit: "cover" },
    "scene-b": { playerId: "u2", fit: "cover" }
  });
});

test("sceneCamera and sceneProfiles stay isolated", async () => {
  installSettings({ sceneCamera: {}, sceneProfiles: {} });

  await setSceneCamera("scene-a", "u1");
  await applySceneProfile("scene-a", { u1: { clipPath: "circle(45%)" } });

  assert.deepEqual(getSceneCamera({ id: "scene-a" }), { playerId: "u1", fit: "cover" });
  assert.deepEqual(getSceneProfile({ id: "scene-a" }), {
    enabled: true,
    cameraControlMode: "native",
    layouts: { u1: { clipPath: "circle(45%)" } }
  });
  assert.equal(sceneProfileEnabled({ id: "scene-a" }), true);
  assert.equal(getSceneCameraControlMode({ id: "scene-a" }), "native");
});

test("scene cameras normalize legacy and invalid fit values to cover", () => {
  installSettings({
    sceneCamera: {
      "scene-a": { playerId: "u1" },
      "scene-b": { playerId: "u2", fit: "unexpected" }
    },
    sceneProfiles: {}
  });

  assert.deepEqual(getSceneCamera({ id: "scene-a" }), { playerId: "u1", fit: "cover" });
  assert.deepEqual(getSceneCamera({ id: "scene-b" }), { playerId: "u2", fit: "cover" });
  assert.deepEqual(normalizeSceneCamera({ playerId: "u3", fit: "contain" }), { playerId: "u3", fit: "contain" });
});

test("setSceneCamera accepts fit options and persists normalized scene camera state", async () => {
  const store = installSettings({
    sceneCamera: {
      "scene-legacy": { playerId: "u1" },
      "scene-invalid": { fit: "fill" }
    },
    sceneProfiles: {}
  });

  const result = await setSceneCamera("scene-a", "u2", { fit: "fill" });

  assert.deepEqual(result, { playerId: "u2", fit: "fill" });
  assert.deepEqual(store.sceneCamera, {
    "scene-legacy": { playerId: "u1", fit: "cover" },
    "scene-a": { playerId: "u2", fit: "fill" }
  });
});

test("sanitizeSceneCameras rejects invalid entries and only preserves supported fits", () => {
  assert.deepEqual(
    sanitizeSceneCameras({
      "scene-a": { playerId: "u1", fit: "contain", extra: true },
      "scene-b": { playerId: "u2", fit: "invalid" },
      "scene-c": { fit: "fill" }
    }),
    {
      "scene-a": { playerId: "u1", fit: "contain" },
      "scene-b": { playerId: "u2", fit: "cover" }
    }
  );
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
  assert.equal(getSceneCameraControlMode({ id: "scene-a" }), "native");
});

test("resetSceneCamera removes scene camera entry", async () => {
  installSettings({
    sceneCamera: {
      "scene-a": { playerId: "u1" }
    },
    sceneProfiles: {}
  });

  const reset = await resetSceneCamera("scene-a");

  assert.equal(reset, true);
  assert.equal(getSceneCamera({ id: "scene-a" }), null);
});

test("setSceneCameraControlMode stores normalized mode on the scene profile", async () => {
  const store = installSettings({
    sceneCamera: {},
    sceneProfiles: {}
  });

  await setSceneCameraControlMode("scene-a", "module");

  assert.equal(store.sceneProfiles["scene-a"].cameraControlMode, "module");
  assert.equal(getSceneCameraControlMode({ id: "scene-a" }), "module");
});

test("applySceneProfile preserves existing camera control mode", async () => {
  installSettings({
    sceneCamera: {},
    sceneProfiles: {
      "scene-a": { enabled: true, cameraControlMode: "module", layouts: { u1: { top: "8px" } } }
    }
  });

  await applySceneProfile("scene-a", { u2: { filter: "blur(1px)" } });

  assert.equal(getSceneCameraControlMode({ id: "scene-a" }), "module");
  assert.deepEqual(getSceneProfile({ id: "scene-a" }), {
    enabled: true,
    cameraControlMode: "module",
    layouts: { u2: { filter: "blur(1px)" } }
  });
});

test("scene profiles normalize legacy overlay bounds lazily without rewriting settings", () => {
  const store = installSettings({
    sceneCamera: {},
    sceneProfiles: {
      "scene-a": {
        enabled: true,
        layouts: {
          u1: {
            overlay: {
              enabled: true,
              imageUrl: "frame.png"
            }
          }
        }
      }
    }
  });

  const profile = getSceneProfile({ id: "scene-a" });

  assert.deepEqual(profile.layouts.u1.overlay.bounds, {
    mode: "camera",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });
  assert.equal(store.sceneProfiles["scene-a"].layouts.u1.overlay.bounds, undefined);
});

test("applySceneProfile persists normalized expanded overlay bounds", async () => {
  const store = installSettings({ sceneCamera: {}, sceneProfiles: {} });

  await applySceneProfile("scene-a", {
    u1: {
      overlay: {
        enabled: true,
        bounds: {
          mode: "expanded",
          top: "12.5",
          right: 700,
          bottom: -5,
          left: "invalid"
        }
      }
    }
  });

  assert.deepEqual(store.sceneProfiles["scene-a"].layouts.u1.overlay.bounds, {
    mode: "expanded",
    top: 12.5,
    right: 500,
    bottom: 0,
    left: 0
  });
});

test("pruneMissingSceneState removes orphaned scene profiles and scene camera entries", async () => {
  const store = installSettings({
    sceneCamera: {
      "scene-a": { playerId: "u1" },
      "scene-missing": { playerId: "u2" }
    },
    sceneProfiles: {
      "scene-a": { enabled: true, layouts: {} },
      "scene-missing": { enabled: true, layouts: { u2: { filter: "blur(1px)" } } }
    }
  });

  const result = await pruneMissingSceneState(["scene-a"]);

  assert.deepEqual(result, {
    removedSceneProfiles: ["scene-missing"],
    removedSceneCameras: ["scene-missing"]
  });
  assert.deepEqual(store.sceneProfiles, {
    "scene-a": { enabled: true, layouts: {} }
  });
  assert.deepEqual(store.sceneCamera, {
    "scene-a": { playerId: "u1" }
  });
});
