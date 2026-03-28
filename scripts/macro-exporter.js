import { MODULE_ID } from "./constants.js";

function buildCommand(layout, playerId) {
  const payload = JSON.stringify(layout, null, 2);
  return [
    `const moduleApi = game.modules.get("${MODULE_ID}")?.api;`,
    "if (!moduleApi) return;",
    `await moduleApi.updatePlayerLayout("${playerId}", ${payload});`
  ].join("\n");
}

function buildSceneCommand(profile) {
  const payload = JSON.stringify(profile, null, 2);
  return [
    `const moduleApi = game.modules.get("${MODULE_ID}")?.api;`,
    "if (!moduleApi) return;",
    "const sceneId = canvas.scene?.id;",
    "if (!sceneId) return;",
    `await moduleApi.applySceneProfileDraft(sceneId, ${payload});`
  ].join("\n");
}

function buildMacroData(name, command) {
  return {
    name,
    type: "script",
    scope: "global",
    command
  };
}

function sceneMacroArgs(sceneIdOrProfile, profileOrMacroName, maybeMacroName) {
  if (sceneIdOrProfile && typeof sceneIdOrProfile === "object" && !Array.isArray(sceneIdOrProfile)) {
    return {
      sourceSceneId: null,
      profile: sceneIdOrProfile,
      macroName: profileOrMacroName
    };
  }
  return {
    sourceSceneId: sceneIdOrProfile ?? null,
    profile: profileOrMacroName,
    macroName: maybeMacroName
  };
}

export async function exportLayoutToMacro(playerId, layout, macroName) {
  const name = macroName || game.i18n.localize(`${MODULE_ID}.macro.defaultName`);
  const command = buildCommand(layout, playerId);
  const macroData = buildMacroData(name, command);
  const macro = await Macro.create(macroData);
  console.debug(`${MODULE_ID} | macro exported`, { playerId, macroId: macro.id });
  return macro;
}

export async function exportSceneProfileToMacro(sceneIdOrProfile, profileOrMacroName, maybeMacroName) {
  const { sourceSceneId, profile, macroName } = sceneMacroArgs(sceneIdOrProfile, profileOrMacroName, maybeMacroName);
  const name = macroName || game.i18n.localize(`${MODULE_ID}.macro.sceneDefaultName`);
  const command = buildSceneCommand(profile);
  const macroData = buildMacroData(name, command);
  const macro = await Macro.create(macroData);
  console.debug(`${MODULE_ID} | scene macro exported`, {
    sourceSceneId,
    macroId: macro.id,
    cameraControlMode: profile?.cameraControlMode ?? "native",
    layoutCount: Object.keys(profile?.layouts ?? {}).length
  });
  return macro;
}
