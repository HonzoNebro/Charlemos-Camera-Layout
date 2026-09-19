import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { EditSession, cloneConfiguration, configurationEqual, writeConfigurationBlocks } from "./edit-session.js";
import { normalizeRoleVariants } from "./role-variants.js";

let session = null;

export function readSceneConfiguration(sceneId) {
  const profile = game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES)?.[sceneId];
  const background = game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA)?.[sceneId] ?? null;
  return cloneConfiguration({ profile: profile ?? { enabled: false, cameraControlMode: "native", layouts: {} }, background });
}

export function getEditSession() {
  return session;
}

export function beginEditSession(sceneId) {
  if (session) return session;
  if (!sceneId) return null;
  session = new EditSession(sceneId, readSceneConfiguration(sceneId));
  return session;
}

export function endEditSession() {
  session = null;
}

export function previewConfiguration(sceneId) {
  if (!globalThis.game?.user?.isGM || !session?.preview || session.sceneId !== sceneId) return null;
  if (globalThis.canvas?.scene?.id !== sceneId) return null;
  if (globalThis.canvas?.ready === false) return null;
  return session.draft;
}

export function editSessionProblem(value = session) {
  if (!value) return "sceneRequired";
  if (game.scenes?.get && !game.scenes.get(value.sceneId)) return "sceneDeleted";
  if (globalThis.canvas?.scene?.id !== value.sceneId) return "sceneChanged";
  if (!game.user?.isGM) return "permission";
  if (value.conflicts.length) return "conflicts";
  const changedUsers = new Set(value.changes.filter((change) => change.path[1] === "layouts").map((change) => change.path[2]));
  for (const change of value.changes) {
    if (change.path[1] !== "roleVariants") continue;
    if (change.path[3] === "layouts" && change.path[4]) changedUsers.add(change.path[4]);
    else {
      const variants = change.path[2] ? { [change.path[2]]: value.draft.profile.roleVariants?.[change.path[2]] } : value.draft.profile.roleVariants;
      for (const variant of Object.values(variants ?? {})) for (const id of Object.keys(variant?.layouts ?? {})) changedUsers.add(id);
    }
  }
  if (game.users?.get && [...changedUsers].some((id) => id && !game.users.get(id))) return "userDeleted";
  return null;
}

export async function applyEditSession(value = session) {
  if (!value || value.busy) return { ok: false, reason: "busy" };
  const contextProblem = editSessionProblem(value);
  if (["sceneChanged", "sceneDeleted", "permission"].includes(contextProblem)) return { ok: false, reason: contextProblem };
  value.reconcile(readSceneConfiguration(value.sceneId));
  const reason = editSessionProblem(value);
  if (reason) return { ok: false, reason };
  try { if (Object.hasOwn(value.draft.profile, "roleVariants")) normalizeRoleVariants(value.draft.profile.roleVariants); }
  catch { return { ok: false, reason: "roleVariantsInvalid" }; }
  const writes = [];
  for (const [field, key] of [["profile", SETTINGS_KEYS.SCENE_PROFILES], ["background", SETTINGS_KEYS.SCENE_CAMERA]]) {
    if (configurationEqual(value.base[field], value.draft[field])) continue;
    const before = cloneConfiguration(game.settings.get(MODULE_ID, key) ?? {});
    const after = cloneConfiguration(before);
    if (value.draft[field] === null) delete after[value.sceneId];
    else after[value.sceneId] = cloneConfiguration(value.draft[field]);
    writes.push({ key, before, after });
  }
  value.busy = true;
  try {
    const result = await writeConfigurationBlocks(writes, {
      read: (key) => game.settings.get(MODULE_ID, key) ?? {},
      write: (key, data) => game.settings.set(MODULE_ID, key, data)
    });
    if (result.ok) value.accept(readSceneConfiguration(value.sceneId));
    else value.reconcile(readSceneConfiguration(value.sceneId));
    console.debug(`${MODULE_ID} | editor save`, { sceneId: value.sceneId, ok: result.ok, recovery: result.recovery });
    return result;
  } finally {
    value.busy = false;
  }
}
