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
      localize: (key) => key.endsWith(".ui.config.common.offline") ? "(offline)" : key
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

function installScenePresetNoSceneEnv() {
  installScenePresetEnv();
  globalThis.canvas = {
    scene: null
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

test("scene preset app shows a no-scene state instead of an editable form", async () => {
  installScenePresetNoSceneEnv();
  const { SceneLayoutPresetApp } = await import("../../scripts/scene-layout-preset-app.js");

  const app = new SceneLayoutPresetApp();
  app.id = "scene-preset-app";
  const context = await app._prepareContext();
  const html = await app._renderHTML(context);

  assert.equal(context.sceneId, null);
  assert.match(html, /ui\.config\.noScene\.title/);
  assert.doesNotMatch(html, /scene-preset-form/);
});

test("orderedSelectedUserIds keeps explicit gaps from slot numbers", async () => {
  installScenePresetEnv();
  const { orderedSelectedUserIds } = await import("../../scripts/scene-layout-preset-app.js");

  const ordered = orderedSelectedUserIds([
    { id: "gm", name: "GM", include: true, order: 3 },
    { id: "u1", name: "Ana", include: true, order: 6 },
    { id: "u2", name: "Bruno", include: true, order: 7 },
    { id: "u3", name: "Carla", include: true, order: 8 },
    { id: "u4", name: "Dani", include: true, order: 9 },
    { id: "u5", name: "Eva", include: true, order: 10 }
  ]);

  assert.deepEqual(Array.from({ length: ordered.length }, (_, index) => ordered[index] ?? null), [null, null, "gm", null, null, "u1", "u2", "u3", "u4", "u5"]);
});
