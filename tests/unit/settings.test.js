import test from "node:test";
import assert from "node:assert/strict";
import { SETTINGS_KEYS } from "../../scripts/constants.js";

function installBaseGlobals() {
  globalThis.foundry = {
    utils: {
      escapeHTML: (value) => String(value ?? "")
    },
    applications: {
      api: {
        ApplicationV2: class {}
      }
    }
  };
}

async function importSettingsModule() {
  return import(`../../scripts/settings.js?test=${Date.now()}-${Math.random()}`);
}

test("handleSharedLayoutSettingChange reapplies layouts and refreshes hub only if present", async () => {
  installBaseGlobals();
  const { handleSharedLayoutSettingChange } = await importSettingsModule();
  let requestCount = 0;
  let refreshCount = 0;

  handleSharedLayoutSettingChange({
    requestApply: () => {
      requestCount += 1;
    },
    app: {
      refreshIfOpen: () => {
        refreshCount += 1;
      }
    }
  });

  assert.equal(requestCount, 1);
  assert.equal(refreshCount, 1);
});

test("registerSettings wires shared world settings through onChange", async () => {
  installBaseGlobals();
  const registered = new Map();
  globalThis.game = {
    settings: {
      register: (_moduleId, key, options) => {
        registered.set(key, options);
      },
      registerMenu: () => {}
    }
  };

  const { registerSettings } = await importSettingsModule();
  registerSettings();

  assert.equal(typeof registered.get(SETTINGS_KEYS.PLAYER_LAYOUTS)?.onChange, "function");
  assert.equal(typeof registered.get(SETTINGS_KEYS.SCENE_CAMERA)?.onChange, "function");
  assert.equal(typeof registered.get(SETTINGS_KEYS.SCENE_PROFILES)?.onChange, "function");
});
