import { HOOKS, MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { initializeUiControls } from "./ui-controls.js";
import { createApi } from "./api.js";
import { CameraConfigApp } from "./camera-config-app.js";
import { setApp } from "./state.js";
import { initializeLiveCameraRenderer } from "./live-camera-renderer.js";
import { migrateLegacySceneProfiles } from "./scene-camera.js";

function registerInitHook() {
  Hooks.once(HOOKS.INIT, () => {
    registerSettings();
    console.debug(`${MODULE_ID} | init complete`);
  });
}

function registerReadyHook() {
  Hooks.once(HOOKS.READY, async () => {
    await migrateLegacySceneProfiles();
    const app = new CameraConfigApp();
    setApp(app);
    game.modules.get(MODULE_ID).api = createApi();
    initializeUiControls();
    initializeLiveCameraRenderer();
    console.debug(`${MODULE_ID} | ready complete`);
  });
}

export function registerHooks() {
  registerInitHook();
  registerReadyHook();
}
