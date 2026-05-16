import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../../scripts/api.js";
import { setApp } from "../../scripts/state.js";

function mockApiEnv({ toggleTarget = true } = {}) {
  const settings = new Map();
  settings.set("charlemos-camera-layout.sceneProfiles", {});
  settings.set("charlemos-camera-layout.sceneCamera", {});
  let clicked = 0;
  const warnings = [];
  const infos = [];
  const viewElement = {
    classList: {
      contains: () => false
    },
    closest: () => null,
    querySelector: (selector) =>
      toggleTarget && selector.includes("toggleDocked")
        ? {
            click: () => {
              clicked += 1;
            }
          }
        : null
  };
  globalThis.window = {
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout: () => {}
  };
  globalThis.canvas = {
    scene: {
      id: "scene-a"
    }
  };
  globalThis.game = {
    i18n: {
      localize: (key) => key
    },
    users: {
      contents: [{ id: "u1" }]
    },
    settings: {
      get: (moduleId, key) => settings.get(`${moduleId}.${key}`),
      set: async (moduleId, key, value) => {
        settings.set(`${moduleId}.${key}`, value);
        return value;
      }
    }
  };
  globalThis.ui = {
    notifications: {
      info: (message) => infos.push(message),
      warn: (message) => warnings.push(message)
    },
    webrtc: {
      getUserCameraView: () => viewElement,
      getUserVideoElement: () => null
    }
  };
  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value ?? {}),
      mergeObject: (target, source) => ({ ...(target ?? {}), ...(source ?? {}) })
    }
  };
  return {
    clicked: () => clicked,
    infos,
    settings,
    warnings
  };
}

test("applySceneProfileDraft prepares docked module cameras before applying macro profile", async () => {
  const env = mockApiEnv();
  const api = createApi();

  await api.applySceneProfileDraft("scene-a", {
    cameraControlMode: "module",
    layouts: {
      u1: {
        top: "10px",
        left: "20px"
      }
    }
  });

  const sceneProfiles = env.settings.get("charlemos-camera-layout.sceneProfiles");
  assert.equal(env.clicked(), 1);
  assert.equal(sceneProfiles["scene-a"].cameraControlMode, "module");
  assert.equal(sceneProfiles["scene-a"].layouts.u1.top, "10px");
  assert.deepEqual(env.warnings, []);
  assert.equal(
    env.infos.includes("charlemos-camera-layout.ui.config.notifications.macroApplied"),
    true
  );
});

test("applySceneProfileDraft warns when docked module cameras cannot be popped out", async () => {
  const env = mockApiEnv({ toggleTarget: false });
  const api = createApi();

  await api.applySceneProfileDraft("scene-a", {
    cameraControlMode: "module",
    layouts: {
      u1: {
        top: "10px"
      }
    }
  });

  const sceneProfiles = env.settings.get("charlemos-camera-layout.sceneProfiles");
  assert.equal(env.clicked(), 0);
  assert.equal(sceneProfiles["scene-a"].cameraControlMode, "module");
  assert.deepEqual(env.warnings, ["charlemos-camera-layout.ui.config.notifications.moduleGeometryUnavailable"]);
});

test("applySceneProfileDraft refreshes an existing config window without opening it", async () => {
  mockApiEnv();
  const api = createApi();
  let refreshCount = 0;
  let renderCount = 0;
  setApp({
    refreshIfOpen: async () => {
      refreshCount += 1;
    },
    render: () => {
      renderCount += 1;
    }
  });

  try {
    await api.applySceneProfileDraft("scene-a", {
      cameraControlMode: "native",
      layouts: {
        u1: {
          filter: "blur(1px)"
        }
      }
    });
  } finally {
    setApp(null);
  }

  assert.equal(refreshCount, 1);
  assert.equal(renderCount, 0);
});
