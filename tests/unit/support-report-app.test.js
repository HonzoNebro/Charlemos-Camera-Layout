import test from "node:test";
import assert from "node:assert/strict";

function installSupportEnv() {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "TestBrowser/1.0",
      language: "es-ES"
    }
  });
  globalThis.canvas = {
    scene: {
      id: "scene-a",
      name: "Scene A"
    }
  };
  globalThis.game = {
    version: "13.351",
    release: {
      version: "13.351",
      generation: 13,
      build: 351
    },
    world: {
      id: "world-a",
      title: "World A"
    },
    user: {
      id: "u1",
      name: "GM",
      role: 4,
      isGM: true
    },
    users: {
      contents: [{ id: "u1", name: "GM", active: true, role: 4, isGM: true }]
    },
    settings: {
      get: (_moduleId, key) =>
        ({
          playerLayouts: {},
          sceneProfiles: {},
          sceneCamera: {},
          debugRenderer: true
        })[key]
    },
    modules: {
      get: () => ({
        active: true,
        version: "1.5.5"
      })
    },
    i18n: {
      localize: (key) => key
    }
  };
  globalThis.ui = {
    webrtc: null,
    notifications: {
      info: () => {},
      error: () => {}
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
            this.id = "app-1";
          }
        }
      }
    }
  };
}

test("support report html renders output and actions", async () => {
  installSupportEnv();
  const { buildHtml } = await import("../../scripts/support-report-app.js");

  const html = buildHtml({
    shellId: "shell-id",
    reportId: "report-id",
    title: "Support",
    description: "Desc",
    playerName: "GM",
    reportText: "{\n  \"ok\": true\n}"
  });

  assert.match(html, /report-id/);
  assert.match(html, /copy-report/);
  assert.match(html, /open-issue/);
  assert.match(html, /refresh-report/);
});

test("support report copies current report to clipboard", async () => {
  installSupportEnv();
  let copiedText = null;
  let infoMessage = null;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "TestBrowser/1.0",
      language: "es-ES",
      clipboard: {
        writeText: async (value) => {
          copiedText = value;
        }
      }
    }
  });
  globalThis.ui.notifications.info = (message) => {
    infoMessage = message;
  };

  const { SupportReportApp } = await import("../../scripts/support-report-app.js");
  const app = new SupportReportApp({ selectedUserId: "u1" });
  app.reportText = "{\"ok\":true}";

  await app.copyReport();

  assert.equal(copiedText, "{\"ok\":true}");
  assert.equal(infoMessage, "charlemos-camera-layout.ui.supportReport.notifications.copied");
});

test("support report opens issue tracker", async () => {
  installSupportEnv();
  let openArgs = null;
  globalThis.window = {
    open: (...args) => {
      openArgs = args;
    }
  };

  const { SupportReportApp } = await import("../../scripts/support-report-app.js");
  const app = new SupportReportApp({ selectedUserId: "u1" });

  app.openIssuePage();

  assert.deepEqual(openArgs, [
    "https://github.com/HonzoNebro/Charlemos-Camera-Layout/issues/new/choose",
    "_blank",
    "noopener"
  ]);
});
