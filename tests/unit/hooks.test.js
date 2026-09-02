import test from "node:test";
import assert from "node:assert/strict";

function installHookEnvironment({ isGM = true, legacySceneCamera = false, rejectSettingWrites = false } = {}) {
  const once = new Map();
  const on = new Map();
  const settings = {
    sceneCamera: legacySceneCamera ? { "scene-a": { playerId: "u1" } } : {},
    sceneProfiles: {},
    playerLayouts: {},
    hideControls: false,
    debugRenderer: false
  };
  const module = {
    active: true,
    version: "3.0.2"
  };
  globalThis.Hooks = {
    once: (name, callback) => {
      once.set(name, callback);
    },
    on: (name, callback) => {
      const callbacks = on.get(name) ?? [];
      callbacks.push(callback);
      on.set(name, callbacks);
    }
  };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          constructor() {
            this.id = "test-app";
          }
        }
      }
    },
    utils: {
      deepClone: (value) => structuredClone(value ?? {}),
      escapeHTML: (value) => String(value ?? ""),
      mergeObject: (target, source) => ({ ...(target ?? {}), ...(source ?? {}) })
    }
  };
  globalThis.game = {
    i18n: {
      localize: (key) => key
    },
    modules: {
      get: () => module
    },
    scenes: {
      contents: [{ id: "scene-a" }]
    },
    settings: {
      get: (_moduleId, key) => settings[key],
      set: async (_moduleId, key, value) => {
        if (rejectSettingWrites) throw new Error("setting write rejected");
        settings[key] = value;
        return value;
      }
    },
    user: {
      id: "u1",
      isGM
    },
    users: {
      contents: [{ id: "u1", active: true }],
      some: () => false
    }
  };
  globalThis.canvas = {
    scene: {
      id: "scene-a"
    }
  };
  globalThis.document = {
    body: {
      classList: {
        toggle: () => {}
      }
    }
  };
  globalThis.ui = {
    webrtc: null
  };
  globalThis.window = {
    clearTimeout: () => {},
    setInterval: () => 1,
    setTimeout: () => 1
  };
  return { module, on, once };
}

test("ready hook initializes the live camera and scene background renderers", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const environment = installHookEnvironment();
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};

  try {
    const { registerHooks } = await import(`../../scripts/hooks.js?test=${Date.now()}-${Math.random()}`);
    registerHooks();

    assert.equal(typeof environment.once.get("ready"), "function");
    await environment.once.get("ready")();

    assert.equal(environment.on.get("canvasReady")?.length, 2);
    assert.equal(environment.on.get("canvasTearDown")?.length, 2);
    assert.equal(environment.on.get("renderApplicationV2")?.length, 2);
    assert.equal(environment.on.get("closeApplicationV2")?.length, 1);
    assert.equal(environment.on.get("charlemos-camera-layout.sceneBackgroundStatusChanged")?.length, 1);
    assert.equal(typeof environment.module.api?.resetSceneCamera, "function");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("ready hook initializes player clients without writing world settings", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const environment = installHookEnvironment({
    isGM: false,
    legacySceneCamera: true,
    rejectSettingWrites: true
  });
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};

  try {
    const { registerHooks } = await import(`../../scripts/hooks.js?test=${Date.now()}-${Math.random()}`);
    registerHooks();

    await environment.once.get("ready")();

    assert.equal(typeof environment.module.api?.getSceneCamera, "function");
    assert.equal(typeof environment.module.api?.resetSceneCamera, "function");
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
