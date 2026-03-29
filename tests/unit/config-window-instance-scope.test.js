import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../../scripts/constants.js";

function installWindowTestEnv() {
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.canvas = {
    scene: {
      id: "scene-a"
    }
  };
  globalThis.game = {
    user: {
      id: "u1"
    },
    users: {
      contents: [{ id: "u1", name: "GM", active: true }]
    },
    i18n: {
      localize: (key) => key
    },
    settings: {
      get: () => ({})
    }
  };
  globalThis.foundry = {
    utils: {
      escapeHTML: (value) => String(value ?? ""),
      deepClone: (value) => structuredClone(value),
      mergeObject: (target, source) => ({ ...(target ?? {}), ...(source ?? {}) })
    },
    applications: {
      api: {
        ApplicationV2: class {
          constructor() {
            this.id = "app";
          }
        }
      },
      settings: {
        menus: {
          FontConfig: class {
            static getAvailableFontChoices() {
              return {};
            }
          }
        }
      }
    }
  };
}

test("config subwindows render scoped form ids per instance", async () => {
  installWindowTestEnv();

  const { LayoutConfigApp } = await import("../../scripts/layout-config-app.js");
  const { EffectsConfigApp } = await import("../../scripts/effects-config-app.js");
  const { OverlayConfigApp } = await import("../../scripts/overlay-config-app.js");
  const { NameConfigApp } = await import("../../scripts/name-config-app.js");
  const { SceneLayoutPresetApp } = await import("../../scripts/scene-layout-preset-app.js");

  const cases = [
    { App: LayoutConfigApp, appId: "layout-a", suffix: "layout-form" },
    { App: EffectsConfigApp, appId: "effects-a", suffix: "effects-form" },
    { App: OverlayConfigApp, appId: "overlay-a", suffix: "overlay-form" },
    { App: NameConfigApp, appId: "name-a", suffix: "name-form" },
    { App: SceneLayoutPresetApp, appId: "scene-preset-a", suffix: "scene-preset-form" }
  ];

  for (const item of cases) {
    const app = new item.App({ selectedUserId: "u1" });
    app.id = item.appId;
    const context = await app._prepareContext();
    const html = await app._renderHTML(context);
    const expectedFormId = `${MODULE_ID}-${item.suffix}-${item.appId}`;
    assert.equal(context.formId, expectedFormId);
    assert.match(html, new RegExp(`id="${expectedFormId}"`));
  }
});

test("config windows expose larger resizable defaults", async () => {
  installWindowTestEnv();

  const { CameraConfigApp } = await import("../../scripts/camera-config-app.js");
  const { LayoutConfigApp } = await import("../../scripts/layout-config-app.js");
  const { EffectsConfigApp } = await import("../../scripts/effects-config-app.js");
  const { OverlayConfigApp } = await import("../../scripts/overlay-config-app.js");
  const { NameConfigApp } = await import("../../scripts/name-config-app.js");
  const { SceneLayoutPresetApp } = await import("../../scripts/scene-layout-preset-app.js");

  const cases = [
    { App: CameraConfigApp, width: 860, height: 700 },
    { App: LayoutConfigApp, width: 760, height: 620 },
    { App: EffectsConfigApp, width: 760, height: 700 },
    { App: OverlayConfigApp, width: 760, height: 780 },
    { App: NameConfigApp, width: 760, height: 840 },
    { App: SceneLayoutPresetApp, width: 760, height: 780 }
  ];

  for (const item of cases) {
    assert.equal(item.App.DEFAULT_OPTIONS.window.resizable, true);
    assert.equal(item.App.DEFAULT_OPTIONS.position.width, item.width);
    assert.equal(item.App.DEFAULT_OPTIONS.position.height, item.height);
  }
});
