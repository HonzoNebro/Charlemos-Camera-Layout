import test from "node:test";
import assert from "node:assert/strict";
import { replaceAppContent } from "../../scripts/dom-replace.js";
import { clearLoadedSceneProfileDraft } from "../../scripts/state.js";

test("replaceAppContent writes string html", () => {
  const content = { innerHTML: "", replaceChildren: () => {} };
  replaceAppContent(content, "<div>A</div>");
  assert.equal(content.innerHTML, "<div>A</div>");
});

test("replaceAppContent handles null result", () => {
  const content = { innerHTML: "x", replaceChildren: () => {} };
  replaceAppContent(content, null);
  assert.equal(content.innerHTML, "");
});

test("camera config hub html renders player selector and actions", async () => {
  globalThis.game = {
    i18n: {
      localize: (key) => key
    }
  };
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
  const { buildHtml } = await import("../../scripts/camera-config-app.js");

  const html = buildHtml({
    shellId: "shell-id",
    formId: "form-id",
    playerSelectId: "player-id",
    title: "Config",
    users: [{ id: "u1", name: "GM", active: true }],
    selectedUserId: "u1",
    formData: {
      layoutMode: "absolute",
      top: "",
      left: "",
      width: "",
      height: "",
      relativePlacement: "none",
      relativeTargetUserId: "",
      cropTop: "",
      cropRight: "",
      cropBottom: "",
      cropLeft: "",
      transform: "",
      filter: "",
      clipPath: "",
      geometryBorderRadius: "",
      overlayEnabled: false,
      overlayImage: "",
      overlayFitMode: "auto",
      overlayAnchor: "center",
      nameVisible: true,
      nameSource: "user",
      namePosition: "bottom"
    }
  });

  assert.match(html, /player-id/);
  assert.match(html, /open-layout-config/);
  assert.match(html, /reset-current-player/);
});

test("camera config exportCurrentLayout exports scene macro with scene control mode", async () => {
  clearLoadedSceneProfileDraft();

  let createdMacro = null;
  const settings = {
    playerLayouts: {
      u1: {
        filter: "blur(1px)"
      }
    },
    sceneProfiles: {
      "scene-a": {
        enabled: true,
        cameraControlMode: "module",
        layouts: {
          u1: {
            layoutMode: "absolute",
            top: "10px",
            left: "20px"
          }
        }
      }
    },
    sceneCamera: {}
  };

  globalThis.game = {
    i18n: {
      localize: (key) => key
    },
    user: {
      id: "u1"
    },
    settings: {
      get: (_moduleId, key) => settings[key]
    }
  };
  globalThis.canvas = {
    scene: {
      id: "scene-a"
    }
  };
  globalThis.window = {
    prompt: () => "Scene Draft"
  };
  globalThis.ui = {
    notifications: {
      info: () => {}
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
        ApplicationV2: class {}
      }
    }
  };
  globalThis.Macro = {
    create: async (data) => {
      createdMacro = data;
      return { id: "macro-1", ...data };
    }
  };

  const { CameraConfigApp } = await import("../../scripts/camera-config-app.js");

  const app = new CameraConfigApp();
  app.selectedUserId = "u1";

  await app.exportCurrentLayout();

  assert.ok(createdMacro);
  assert.equal(createdMacro.name, "Scene Draft");
  assert.equal(createdMacro.command.includes("applySceneProfileDraft"), true);
  assert.equal(createdMacro.command.includes("const sceneId = canvas.scene?.id;"), true);
  assert.equal(createdMacro.command.includes('"scene-a"'), false);
  assert.equal(createdMacro.command.includes('"cameraControlMode": "module"'), true);
  assert.equal(createdMacro.command.includes('"top": "10px"'), true);
  assert.equal(createdMacro.command.includes('"left": "20px"'), true);
});
