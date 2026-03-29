import { HOOKS, MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { initializeUiControls } from "./ui-controls.js";
import { createApi } from "./api.js";
import { CameraConfigApp } from "./camera-config-app.js";
import { clearLoadedSceneProfileDraft, setApp } from "./state.js";
import { initializeLiveCameraRenderer } from "./live-camera-renderer.js";
import { migrateLegacySceneProfiles, pruneMissingSceneState, resetSceneCamera, resetSceneProfile } from "./scene-camera.js";

function registerInitHook() {
  Hooks.once(HOOKS.INIT, () => {
    registerSettings();
    console.debug(`${MODULE_ID} | init complete`);
  });
}

function registerReadyHook() {
  Hooks.once(HOOKS.READY, async () => {
    await migrateLegacySceneProfiles();
    await pruneMissingSceneState((game.scenes?.contents ?? []).map((scene) => scene.id));
    const app = new CameraConfigApp();
    setApp(app);
    game.modules.get(MODULE_ID).api = createApi();
    initializeUiControls();
    initializeLiveCameraRenderer();
    console.debug(`${MODULE_ID} | ready complete`);
  });
}

function registerSceneCleanupHook() {
  Hooks.on("deleteScene", async (scene) => {
    const sceneId = scene?.id;
    if (!sceneId) return;
    await resetSceneProfile(sceneId);
    await resetSceneCamera(sceneId);
    clearLoadedSceneProfileDraft(sceneId);
  });
}

export function registerHooks() {
  registerInitHook();
  registerReadyHook();
  registerSceneCleanupHook();
}
