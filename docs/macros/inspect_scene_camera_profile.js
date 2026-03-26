const MODULE_ID = "charlemos-camera-layout-config-hub-split-windows";

const sceneId = canvas?.scene?.id;
const profiles = game.settings.get(MODULE_ID, "sceneProfiles") || {};
const globalLayouts = game.settings.get(MODULE_ID, "playerLayouts") || {};

if (!sceneId) {
  ui.notifications.warn("No active scene");
  return;
}

const profile = profiles[sceneId] || { enabled: false, layouts: {} };
const users = game.users.contents.map((u) => {
  const sceneLayout = profile.layouts?.[u.id] || null;
  const globalLayout = globalLayouts[u.id] || null;
  return {
    userId: u.id,
    userName: u.name,
    sceneProfileEnabled: profile.enabled,
    hasSceneLayout: !!sceneLayout,
    hasGlobalLayout: !!globalLayout,
    sceneLayout,
    globalLayout
  };
});

console.log("[Charlemos] Scene camera profile", {
  sceneId,
  profile,
  users
});
console.table(users.map((u) => ({
  userId: u.userId,
  userName: u.userName,
  sceneProfileEnabled: u.sceneProfileEnabled,
  hasSceneLayout: u.hasSceneLayout,
  hasGlobalLayout: u.hasGlobalLayout
})));

ui.notifications.info("Scene camera profile dumped to console");
