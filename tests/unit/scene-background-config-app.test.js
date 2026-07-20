import test from "node:test";
import assert from "node:assert/strict";

const settings = {
  sceneCamera: {}
};

function installEnv(scene = { id: "scene-a" }) {
  globalThis.canvas = { scene };
  globalThis.document = {
    getElementById: () => null
  };
  globalThis.game = {
    i18n: {
      localize: (key) => key.endsWith(".ui.config.common.offline") ? "(offline)" : key
    },
    settings: {
      get: (_moduleId, key) => settings[key] ?? {},
      set: async (_moduleId, key, value) => {
        settings[key] = structuredClone(value);
        return value;
      }
    },
    users: {
      contents: [
        { id: "u2", name: "Bruno", active: false },
        { id: "u1", name: "Ana", active: true }
      ]
    }
  };
  globalThis.ui = {
    notifications: {
      info: () => {},
      warn: () => {}
    }
  };
  globalThis.foundry = {
    utils: {
      escapeHTML: (value) => String(value ?? ""),
      deepClone: (value) => structuredClone(value)
    },
    applications: {
      api: {
        ApplicationV2: class {
          constructor() {
            this.id = "scene-background-app";
            this.renderCalls = 0;
          }

          async render() {
            this.renderCalls += 1;
          }

          async close() {}
        }
      }
    }
  };
}

function formWith(playerId, fit) {
  return {
    elements: {
      namedItem: (name) => ({ value: name === "playerId" ? playerId : fit })
    }
  };
}

test("scene background app lists active users first, marks offline users and exposes all fit modes", async () => {
  installEnv();
  settings.sceneCamera = {
    "scene-a": {
      playerId: "u2",
      fit: "contain"
    }
  };
  const { SceneBackgroundConfigApp } = await import("../../scripts/scene-background-config-app.js");

  const app = new SceneBackgroundConfigApp();
  const context = await app._prepareContext();
  const html = await app._renderHTML(context);

  assert.deepEqual(context.users.map((user) => user.id), ["u1", "u2"]);
  assert.equal(context.playerId, "u2");
  assert.equal(context.fit, "contain");
  assert.match(html, /<option value="">[^<]*ui\.sceneBackground\.source\.disabled<\/option>/);
  assert.ok(html.indexOf("Ana") < html.indexOf("Bruno"));
  assert.match(html, /Bruno \(offline\)/);
  assert.match(html, /name="fit"/);
  assert.match(html, /value="cover"/);
  assert.match(html, /value="contain" selected/);
  assert.match(html, /value="fill"/);
  assert.match(html, /data-scene-background-status="waiting"/);
});

test("scene background html reports active and unavailable local states", async () => {
  installEnv();
  const { buildSceneBackgroundHtml } = await import("../../scripts/scene-background-config-app.js");
  const base = {
    title: "Background",
    sceneId: "scene-a",
    formId: "background-form",
    users: [],
    playerId: "",
    fit: "cover"
  };

  const active = buildSceneBackgroundHtml({ ...base, status: "active" });
  const waiting = buildSceneBackgroundHtml({ ...base, status: "waiting" });
  const unavailable = buildSceneBackgroundHtml({ ...base, status: "unavailable" });

  assert.match(active, /data-scene-background-status="active"/);
  assert.match(waiting, /data-scene-background-status="waiting"/);
  assert.match(unavailable, /data-scene-background-status="unavailable"/);
});

test("scene background app saves the selected source and fit", async () => {
  installEnv();
  settings.sceneCamera = {};
  const { SceneBackgroundConfigApp } = await import("../../scripts/scene-background-config-app.js");

  const app = new SceneBackgroundConfigApp();
  await app.saveForm(formWith("u1", "fill"));

  assert.deepEqual(settings.sceneCamera["scene-a"], {
    playerId: "u1",
    fit: "fill"
  });
});

test("scene background app resets the scene source when disabled", async () => {
  installEnv();
  settings.sceneCamera = {
    "scene-a": {
      playerId: "u1",
      fit: "cover"
    }
  };
  const { SceneBackgroundConfigApp } = await import("../../scripts/scene-background-config-app.js");

  const app = new SceneBackgroundConfigApp();
  await app.saveForm(formWith("", "cover"));

  assert.equal(settings.sceneCamera["scene-a"], undefined);
});

test("scene background app shows a no-scene state", async () => {
  installEnv(null);
  const { SceneBackgroundConfigApp } = await import("../../scripts/scene-background-config-app.js");

  const app = new SceneBackgroundConfigApp();
  const context = await app._prepareContext();
  const html = await app._renderHTML(context);

  assert.equal(context.sceneId, null);
  assert.match(html, /ui\.config\.noScene\.title/);
  assert.doesNotMatch(html, /scene-background-form/);
});

test("scene background summary includes source, fit and local status", async () => {
  installEnv();
  const { sceneBackgroundSummary } = await import("../../scripts/scene-background-config-app.js");

  const summary = sceneBackgroundSummary(
    { playerId: "u1", fit: "contain" },
    [{ id: "u1", name: "Ana", active: true }],
    { state: "active", sceneId: "scene-a", playerId: "u1" }
  );

  assert.match(summary, /^Ana · /);
  assert.match(summary, /ui\.sceneBackground\.fit\.contain/);
  assert.match(summary, /ui\.sceneBackground\.status\.active/);
});

test("status changes refresh only the open scene background window", async () => {
  installEnv();
  const { SceneBackgroundConfigApp, refreshSceneBackgroundConfigIfOpen } =
    await import("../../scripts/scene-background-config-app.js");
  const app = new SceneBackgroundConfigApp();
  globalThis.document.getElementById = () => ({});

  await refreshSceneBackgroundConfigIfOpen();
  assert.equal(app.renderCalls, 1);

  await app.close();
  await refreshSceneBackgroundConfigIfOpen();
  assert.equal(app.renderCalls, 1);
});
