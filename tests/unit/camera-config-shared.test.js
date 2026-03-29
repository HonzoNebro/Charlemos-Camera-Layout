import test from "node:test";
import assert from "node:assert/strict";
import {
  finalizeSubwindowSave,
  importLegacyLayoutsIntoCurrentScene,
  loadLayoutForUser,
  normalizeImportPayload,
  resetLayoutForUser,
  sanitizeLayoutForCameraControlMode,
  sanitizeLayouts,
  saveLayoutPatchForUser
} from "../../scripts/camera-config-shared.js";
import { clearLoadedSceneProfileDraft, setLoadedSceneProfileDraft } from "../../scripts/state.js";

function mergeObject(target, source) {
  const base = structuredClone(target ?? {});
  Object.entries(source ?? {}).forEach(([key, value]) => {
    const current = base[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      base[key] = mergeObject(current, value);
      return;
    }
    base[key] = structuredClone(value);
  });
  return base;
}

function installSettings(initial, options = {}) {
  const store = {
    playerLayouts: initial.playerLayouts ?? {},
    sceneProfiles: initial.sceneProfiles ?? {},
    sceneCamera: initial.sceneCamera ?? {},
    debugRenderer: false
  };
  globalThis.canvas = options.sceneId === null ? { scene: null } : { scene: { id: options.sceneId ?? "scene-a" } };
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
  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value),
      mergeObject
    }
  };
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
        filter: "blur(1px)",
        geometry: {
          borderRadius: "10px",
          transparentFrame: true
        }
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
      filter: "blur(1px)",
      geometry: {
        borderRadius: "10px",
        transparentFrame: true
      }
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

test("loadLayoutForUser ignores legacy global layouts outside scene profiles", () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        filter: "blur(1px)"
      }
    }
  });

  assert.equal(store.playerLayouts.u1.filter, "blur(1px)");
  assert.equal(loadLayoutForUser("u1"), null);
});

test("saveLayoutPatchForUser writes only to the current scene profile", async () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        filter: "blur(1px)"
      }
    },
    sceneProfiles: {}
  });

  const saved = await saveLayoutPatchForUser("u1", {
    overlay: {
      enabled: true,
      imageUrl: "modules/example/frame.png"
    }
  });

  assert.equal(saved, true);
  assert.deepEqual(store.playerLayouts, {
    u1: {
      filter: "blur(1px)"
    }
  });
  assert.deepEqual(store.sceneProfiles["scene-a"], {
    enabled: true,
    cameraControlMode: "native",
    layouts: {
      u1: {
        overlay: {
          enabled: true,
          imageUrl: "modules/example/frame.png"
        }
      }
    }
  });
});

test("saveLayoutPatchForUser keeps draft changes scoped to the scene", async () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        filter: "blur(1px)"
      }
    },
    sceneProfiles: {}
  });
  setLoadedSceneProfileDraft("scene-a", {
    cameraControlMode: "module",
    layouts: {
      u2: {
        top: "10px"
      }
    }
  });

  const saved = await saveLayoutPatchForUser("u1", {
    width: "320px",
    height: "240px"
  });

  assert.equal(saved, true);
  assert.deepEqual(store.playerLayouts, {
    u1: {
      filter: "blur(1px)"
    }
  });
  assert.deepEqual(store.sceneProfiles["scene-a"], {
    enabled: true,
    cameraControlMode: "module",
    layouts: {
      u2: {
        top: "10px"
      },
      u1: {
        width: "320px",
        height: "240px"
      }
    }
  });
});

test("resetLayoutForUser preserves module camera control mode without touching legacy global layouts", async () => {
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
  assert.deepEqual(store.playerLayouts, {
    u1: {
      width: "960px",
      height: "540px",
      overlay: {
        enabled: true,
        imageUrl: "modules/example/frame.png"
      }
    }
  });
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
  assert.deepEqual(store.playerLayouts, {
    u1: {
      width: "960px",
      height: "540px"
    }
  });
  assert.equal(store.sceneProfiles["scene-a"], undefined);
});

test("importLegacyLayoutsIntoCurrentScene merges legacy globals without overwriting current scene overrides", async () => {
  const store = installSettings({
    playerLayouts: {
      u1: {
        filter: "blur(1px)"
      },
      u2: {
        overlay: {
          enabled: true,
          imageUrl: "modules/example/frame.png"
        }
      }
    },
    sceneProfiles: {
      "scene-a": {
        enabled: true,
        cameraControlMode: "module",
        layouts: {
          u1: {
            top: "20px",
            left: "10px"
          }
        }
      }
    }
  });

  const importedCount = await importLegacyLayoutsIntoCurrentScene();

  assert.equal(importedCount, 2);
  assert.deepEqual(store.sceneProfiles["scene-a"], {
    enabled: true,
    cameraControlMode: "module",
    layouts: {
      u1: {
        filter: "blur(1px)",
        top: "20px",
        left: "10px"
      },
      u2: {
        overlay: {
          enabled: true,
          imageUrl: "modules/example/frame.png"
        }
      }
    }
  });
});

test("resetLayoutForUser returns false without an active scene", async () => {
  installSettings(
    {
      playerLayouts: {
        u1: {
          filter: "blur(1px)"
        }
      }
    },
    { sceneId: null }
  );

  const changed = await resetLayoutForUser("u1");

  assert.equal(changed, false);
});

test("finalizeSubwindowSave closes the subwindow and then refreshes the hub callback", async () => {
  const events = [];
  const app = {
    close: async () => {
      events.push("close");
    }
  };

  await finalizeSubwindowSave(app, async () => {
    events.push("saved");
  });

  assert.deepEqual(events, ["close", "saved"]);
});
