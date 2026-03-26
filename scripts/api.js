import { MODULE_ID } from "./constants.js";
import { getPlayerLayout, updatePlayerLayout, buildVideoStyle } from "./camera-style-service.js";
import { setPlayerOverlay, setPlayerNameStyle, setPlayerVideoFilter, setPlayerGeometry } from "./overlay-service.js";
import { exportLayoutToMacro, exportSceneProfileToMacro } from "./macro-exporter.js";
import { applySceneProfile, getSceneCamera, getSceneProfile, resetSceneProfile, setSceneCamera } from "./scene-camera.js";
import { setControlsVisibility } from "./ui-controls.js";
import { getApp, setLoadedSceneProfileDraft } from "./state.js";
import { dumpRendererDebugSnapshot } from "./live-camera-renderer.js";

function openConfig() {
  const app = getApp();
  if (!app) return;
  app.render(true);
}

function loadSceneProfileDraft(sceneId, payload) {
  setLoadedSceneProfileDraft(sceneId, payload);
  openConfig();
  ui.notifications.info(game.i18n.localize(`${MODULE_ID}.ui.config.notifications.macroLoaded`));
}

export function createApi() {
  return {
    getPlayerLayout,
    updatePlayerLayout,
    buildVideoStyle,
    setPlayerOverlay,
    setPlayerNameStyle,
    setPlayerVideoFilter,
    setPlayerGeometry,
    exportLayoutToMacro,
    exportSceneProfileToMacro,
    loadSceneProfileDraft,
    applySceneProfile,
    resetSceneProfile,
    getSceneProfile,
    getSceneCamera,
    setSceneCamera,
    setControlsVisibility,
    dumpRendererDebugSnapshot,
    openConfig
  };
}
