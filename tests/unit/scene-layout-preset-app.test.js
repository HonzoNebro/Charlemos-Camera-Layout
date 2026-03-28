import test from "node:test";
import assert from "node:assert/strict";

function installScenePresetEnv() {
  globalThis.document = {
    getElementById: () => null
  };
  globalThis.canvas = {
    scene: {
      id: "scene-a"
    }
  };
  globalThis.game = {
    i18n: {
      localize: (key) => key === "charlemos-camera-layout.ui.config.common.offline" ? "(offline)" : key
    },
    users: {
      contents: [
        { id: "u2", name: "Bruno", active: false },
        { id: "u1", name: "Ana", active: true }
      ]
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
            this.id = "scene-preset-app";
          }
        }
      }
    }
  };
}

test("scene preset app includes offline users but only preselects active ones", async () => {
  installScenePresetEnv();
  const { SceneLayoutPresetApp } = await import("../../scripts/scene-layout-preset-app.js");

  const app = new SceneLayoutPresetApp();
  app.id = "scene-preset-app";
  const context = await app._prepareContext();
  const html = await app._renderHTML(context);

  assert.deepEqual(
    context.formData.users.map((user) => [user.id, user.active, user.include]),
    [
      ["u1", true, true],
      ["u2", false, false]
    ]
  );
  assert.match(html, /Ana/);
  assert.match(html, /Bruno \(offline\)/);
  assert.match(html, /name="include-u1" checked/);
  assert.doesNotMatch(html, /name="include-u2" checked/);
  assert.match(html, /name="aspectRatio"/);
});
