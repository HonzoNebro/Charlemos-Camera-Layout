import test from "node:test";
import assert from "node:assert/strict";
import { clearLoadedSceneProfileDraft, setLoadedSceneProfileDraft } from "../../scripts/state.js";
import { collectModuleDebugReport } from "../../scripts/debug-report.js";

function installDebugEnv() {
  clearLoadedSceneProfileDraft();
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
      name: "Test Scene"
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
      contents: [
        { id: "u1", name: "GM", active: true, role: 4, isGM: true },
        { id: "u2", name: "Player", active: false, role: 1, isGM: false }
      ]
    },
    settings: {
      get: (_moduleId, key) =>
        ({
          playerLayouts: {
            u2: { filter: "blur(1px)" }
          },
          sceneProfiles: {
            "scene-a": {
              enabled: true,
              cameraControlMode: "module",
              layouts: {
                u2: { top: "10px", left: "20px" }
              }
            }
          },
          sceneCamera: {
            "scene-a": { playerId: "u2" }
          },
          debugRenderer: true
        })[key]
    },
    modules: {
      get: () => ({
        active: true,
        version: "1.5.4"
      })
    }
  };
  globalThis.ui = {
    webrtc: null
  };
  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value)
    }
  };
}

test("collectModuleDebugReport summarizes current scene, target user and settings", () => {
  installDebugEnv();
  setLoadedSceneProfileDraft("scene-a", {
    cameraControlMode: "module",
    layouts: {
      u2: { width: "300px" }
    }
  });

  const report = collectModuleDebugReport("u2", { includeRendererSnapshot: false });

  assert.equal(report.module.version, "1.5.4");
  assert.equal(report.module.debugRenderer, true);
  assert.equal(report.foundry.generation, 13);
  assert.equal(report.environment.userAgent, "TestBrowser/1.0");
  assert.equal(report.scene.id, "scene-a");
  assert.equal(report.scene.currentSceneProfile.cameraControlMode, "module");
  assert.equal(report.scene.sceneCamera.playerId, "u2");
  assert.equal(report.settingsSummary.globalLayoutCount, 1);
  assert.equal(report.settingsSummary.sceneProfileCount, 1);
  assert.equal(report.targetUser.userId, "u2");
  assert.equal(report.targetUser.globalLayout.filter, "blur(1px)");
  assert.equal(report.targetUser.sceneLayout.top, "10px");
  assert.equal(report.targetUser.draftLayout.width, "300px");
  assert.equal(report.rendererSnapshot, null);
});
