import test from "node:test";
import assert from "node:assert/strict";
import { normalizeImportPayload, resetLayoutForUser, sanitizeLayoutForCameraControlMode, sanitizeLayouts } from "../../scripts/camera-config-shared.js";
import { clearLoadedSceneProfileDraft } from "../../scripts/state.js";

function installSettings(initial) {
  const store = {
    playerLayouts: initial.playerLayouts ?? {},
    sceneProfiles: initial.sceneProfiles ?? {},
    sceneCamera: initial.sceneCamera ?? {},
    debugRenderer: false
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
  globalThis.ui = {};
  clearLoadedSceneProfileDraft();
  return store;
}

test("sanitizeLayoutForCameraControlMode strips geometry ownership fields in native mode", () => {
  const result = sanitizeLayoutForCameraControlMode(
    {
      layoutMode: "relative",
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "320px",
      height: "180px",
      relative: {
        targetUserId: "u2",
        placement: "below",
        gap: "12px"
      },
      filter: "blur(1px)",
      crop: { top: "5px" }
    },
    "native"
  );

  assert.deepEqual(result, {
    filter: "blur(1px)",
    crop: { top: "5px" }
  });
});

test("sanitizeLayouts preserves geometry ownership fields in module mode", () => {
  const result = sanitizeLayouts(
    {
      u1: {
        layoutMode: "relative",
        position: "absolute",
        top: "10px",
        left: "20px",
        width: "320px",
        height: "180px",
        relative: {
          targetUserId: "u2",
          placement: "below",
          gap: "12px"
        },
        filter: "blur(1px)"
      }
    },
    "module"
  );

  assert.deepEqual(result, {
    u1: {
      layoutMode: "relative",
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "320px",
      height: "180px",
      relative: {
        targetUserId: "u2",
        placement: "below",
        gap: "12px"
      },
      filter: "blur(1px)"
    }
  });
});

test("normalizeImportPayload preserves relative layouts in module scenes and strips them in native scenes", () => {
  const payload = normalizeImportPayload({
    settings: {
      playerLayouts: {},
      sceneProfiles: {
        "scene-module": {
          enabled: true,
          cameraControlMode: "module",
          layouts: {
            u1: {
              layoutMode: "relative",
              top: "10px",
              left: "20px",
              relative: {
                targetUserId: "u2",
                placement: "below-center",
                gap: "12px"
              }
            }
          }
        },
        "scene-native": {
          enabled: true,
          cameraControlMode: "native",
          layouts: {
            u1: {
              layoutMode: "relative",
              top: "10px",
              left: "20px",
              relative: {
                targetUserId: "u2",
                placement: "below-center",
                gap: "12px"
              },
              filter: "blur(1px)"
            }
          }
        }
      },
      sceneCamera: {}
    }
  });

  assert.deepEqual(payload.sceneProfiles["scene-module"].layouts.u1.relative, {
    targetUserId: "u2",
    placement: "below-center",
    gap: "12px"
  });
  assert.equal(payload.sceneProfiles["scene-module"].layouts.u1.layoutMode, "relative");
  assert.deepEqual(payload.sceneProfiles["scene-native"].layouts.u1, {
    filter: "blur(1px)"
  });
});

test("resetLayoutForUser preserves module camera control mode without persisting fallback geometry", async () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        width: "960px",
        height: "540px",
        overlay: { enabled: true, imageUrl: "modules/example/frame.png" }
      }
    },
    sceneProfiles: {
      "scene-a": {
        enabled: true,
        cameraControlMode: "module",
        layouts: {
          u1: {
            width: "960px",
            height: "540px",
            filter: "blur(1px)"
          }
        }
      }
    }
  });

  const changed = await resetLayoutForUser("u1");

  assert.equal(changed, true);
  assert.deepEqual(store.playerLayouts, {});
  assert.deepEqual(store.sceneProfiles["scene-a"], {
    enabled: true,
    cameraControlMode: "module",
    layouts: {
      u1: {}
    }
  });
});

test("resetLayoutForUser keeps native scenes free of module geometry", async () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        width: "960px",
        height: "540px"
      }
    },
    sceneProfiles: {
      "scene-a": {
        enabled: true,
        cameraControlMode: "native",
        layouts: {
          u1: {
            filter: "blur(1px)"
          }
        }
      }
    }
  });

  const changed = await resetLayoutForUser("u1");

  assert.equal(changed, true);
  assert.deepEqual(store.playerLayouts, {});
  assert.equal(store.sceneProfiles["scene-a"], undefined);
});
