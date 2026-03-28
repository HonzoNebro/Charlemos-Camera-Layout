const MODULE_ID = "charlemos-camera-layout";
const moduleApi = game.modules.get(MODULE_ID)?.api;

if (!moduleApi) {
  ui.notifications.error("Charlemos API not available");
  return;
}

const report = moduleApi.dumpModuleDebugReport(game.user?.id, { includeRendererSnapshot: true });
console.log("[Charlemos] Module debug report", report);
ui.notifications.info("Module debug report dumped to console");
