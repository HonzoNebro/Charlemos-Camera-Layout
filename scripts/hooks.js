import { HOOKS, MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { initializeUiControls } from "./ui-controls.js";
import { createApi } from "./api.js";
import { CameraEditorApp } from "./camera-editor-app.js";
import { clearLoadedSceneProfileDraft, getApp, setApp } from "./state.js";
import { initializeLiveCameraRenderer } from "./live-camera-renderer.js";
import { initializeSceneBackgroundRenderer } from "./scene-background-renderer.js";
import { refreshSceneBackgroundConfigIfOpen } from "./scene-background-config-app.js";
import { migrateLegacySceneProfiles, pruneMissingSceneState, resetSceneCamera, resetSceneProfile } from "./scene-camera.js";

function registerInitHook() {
  Hooks.once(HOOKS.INIT, () => {
    registerSettings();
    console.debug(`${MODULE_ID} | init complete`);
  });
}

async function maintainSceneState() {
  if (!game.user?.isGM) return;
  try {
    await migrateLegacySceneProfiles();
    await pruneMissingSceneState((game.scenes?.contents ?? []).map((scene) => scene.id));
  } catch (error) {
    console.error(`${MODULE_ID} | scene state maintenance failed`, error);
  }
}

function registerReadyHook() {
  Hooks.once(HOOKS.READY, async () => {
    await maintainSceneState();
    const app = new CameraEditorApp();
    setApp(app);
    game.modules.get(MODULE_ID).api = createApi();
    initializeUiControls();
    initializeLiveCameraRenderer();
    initializeSceneBackgroundRenderer();
    console.debug(`${MODULE_ID} | ready complete`);
  });
}

function registerSceneCleanupHook() {
  Hooks.on("deleteScene", async (scene) => {
    if (!game.user?.isGM) return;
    const sceneId = scene?.id;
    if (!sceneId) return;
    await resetSceneProfile(sceneId);
    await resetSceneCamera(sceneId);
    clearLoadedSceneProfileDraft(sceneId);
  });
}

function registerSceneBackgroundStatusHook() {
  Hooks.on(HOOKS.SCENE_BACKGROUND_STATUS_CHANGED, () => {
    getApp()?.refreshIfOpen?.();
    refreshSceneBackgroundConfigIfOpen();
  });
}

export function registerHooks() {
  registerInitHook();
  registerReadyHook();
  registerSceneCleanupHook();
  registerSceneBackgroundStatusHook();
}
