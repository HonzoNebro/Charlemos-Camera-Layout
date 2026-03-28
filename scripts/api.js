import { MODULE_ID } from "./constants.js";
import { getPlayerLayout, updatePlayerLayout, buildVideoStyle } from "./camera-style-service.js";
import { setPlayerOverlay, setPlayerNameStyle, setPlayerVideoFilter, setPlayerGeometry } from "./overlay-service.js";
import { exportLayoutToMacro, exportSceneProfileToMacro } from "./macro-exporter.js";
import { applySceneProfile, getSceneCamera, getSceneProfile, resetSceneProfile, setSceneCamera } from "./scene-camera.js";
import { sanitizeLayouts } from "./camera-config-shared.js";
import { setControlsVisibility } from "./ui-controls.js";
import { getApp, setLoadedSceneProfileDraft } from "./state.js";
import { applyCameraLayoutsNow, dumpRendererDebugSnapshot } from "./live-camera-renderer.js";
import { dumpModuleDebugReport } from "./debug-report.js";

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

async function applySceneProfileDraft(sceneId, payload) {
  const cameraControlMode = String(payload?.cameraControlMode ?? "native").trim() || "native";
  const layouts = sanitizeLayouts(payload?.layouts ?? {}, cameraControlMode);
  setLoadedSceneProfileDraft(sceneId, {
    cameraControlMode,
    layouts
  });
  await applySceneProfile(sceneId, layouts, { cameraControlMode });
  applyCameraLayoutsNow();
  const app = getApp();
  if (app) await app.render(true);
  console.debug(`${MODULE_ID} | scene profile draft applied`, { sceneId, cameraControlMode, layoutCount: Object.keys(layouts).length });
  ui.notifications.info(game.i18n.localize(`${MODULE_ID}.ui.config.notifications.macroApplied`));
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
    applySceneProfileDraft,
    applySceneProfile,
    resetSceneProfile,
    getSceneProfile,
    getSceneCamera,
    setSceneCamera,
    setControlsVisibility,
    dumpRendererDebugSnapshot,
    dumpModuleDebugReport,
    openConfig
  };
}
