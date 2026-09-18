import { getSceneCamera as storedCamera, getSceneProfile as storedProfile } from "./scene-camera.js";
import { previewConfiguration } from "./edit-runtime.js";

export function getSceneProfile(scene) {
  const preview = previewConfiguration(scene?.id ?? globalThis.canvas?.scene?.id);
  return preview ? preview.profile : storedProfile(scene);
}

export function getSceneCamera(scene) {
  const preview = previewConfiguration(scene?.id ?? globalThis.canvas?.scene?.id);
  return preview ? preview.background : storedCamera(scene);
}

export function getSceneCameraControlMode(scene) {
  return getSceneProfile(scene)?.cameraControlMode === "module" ? "module" : "native";
}

export function sceneProfileEnabled(scene) {
  return Boolean(getSceneProfile(scene)?.enabled);
}

export function getSceneProfileLayout(playerId, scene) {
  const profile = getSceneProfile(scene);
  return profile?.enabled ? profile.layouts?.[playerId] ?? null : null;
}
