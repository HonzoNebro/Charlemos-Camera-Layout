import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { cloneConfiguration, configurationChanges, configurationEqual, setConfigurationValue, writeConfigurationBlocks } from "./edit-session.js";
import { normalizeOverlayConfiguration } from "./overlay-bounds.js";
import { normalizeOverlayBlendMode } from "./overlay-blend.js";
import { normalizeSceneCamera } from "./scene-camera.js";
import { normalizeProfileLibrary } from "./profile-library.js";
import { normalizeRoleVariants, roleVariantUserIds, remapRoleVariants } from "./role-variants.js";

export const CONFIG_BLOCKS = [SETTINGS_KEYS.PLAYER_LAYOUTS, SETTINGS_KEYS.SCENE_PROFILES, SETTINGS_KEYS.SCENE_CAMERA];
const OPTIONAL_CONFIG_BLOCKS = [SETTINGS_KEYS.PROFILE_LIBRARY];

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeTree(value) {
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, child]) => !["__proto__", "constructor", "prototype"].includes(key) && safeTree(child));
}

function layoutsValid(layouts) {
  return record(layouts) && Object.values(layouts).every((layout) => record(layout) &&
    ["overlay", "geometry", "relative", "crop", "nameStyle"].every((key) => layout[key] == null || record(layout[key])));
}

function normalizedLayouts(layouts) {
  return Object.fromEntries(Object.entries(layouts).map(([id, layout]) => {
    const result = cloneConfiguration(layout);
    if (result.overlay) {
      delete result.overlay.userId;
      if (Object.hasOwn(result.overlay, "blendMode")) result.overlay.blendMode = normalizeOverlayBlendMode(result.overlay.blendMode);
      if (result.overlay.bounds) {
        const bounds = normalizeOverlayConfiguration(result.overlay).bounds;
        result.overlay.bounds = Object.fromEntries(Object.keys(result.overlay.bounds).filter((key) => Object.hasOwn(bounds, key)).map((key) => [key, bounds[key]]));
      }
    }
    return [id, result];
  }));
}

export function importReferences(inspection) {
  const { settings } = inspection;
  const scenes = new Set([...Object.keys(settings.sceneProfiles ?? {}), ...Object.keys(settings.sceneCamera ?? {})]);
  const users = new Set(Object.keys(settings.playerLayouts ?? {}));
  for (const profile of Object.values(settings.sceneProfiles ?? {})) {
    for (const id of roleVariantUserIds(profile)) users.add(id);
    for (const [id, layout] of Object.entries(profile.layouts ?? {})) {
      users.add(id);
      if (layout.relative?.targetUserId) users.add(layout.relative.targetUserId);
    }
  }
  for (const camera of Object.values(settings.sceneCamera ?? {})) if (camera?.playerId) users.add(camera.playerId);
  return { scenes: [...scenes], users: [...users] };
}

export function importEntries(inspection) {
  const entries = [];
  for (const id of Object.keys(inspection.settings.playerLayouts ?? {})) entries.push(["playerLayouts", id]);
  for (const [sceneId, profile] of Object.entries(inspection.settings.sceneProfiles ?? {})) {
    for (const userId of Object.keys(profile.layouts ?? {})) entries.push(["sceneProfiles", sceneId, "layouts", userId]);
    for (const [role, variant] of Object.entries(profile.roleVariants ?? {})) {
      for (const userId of Object.keys(variant.layouts ?? {})) entries.push(["sceneProfiles", sceneId, "roleVariants", role, "layouts", userId]);
    }
  }
  for (const sceneId of Object.keys(inspection.settings.sceneCamera ?? {})) entries.push(["sceneCamera", sceneId]);
  for (const id of Object.keys(inspection.settings.profileLibrary ?? {})) entries.push(["profileLibrary", id]);
  return entries;
}

export function selectImportEntries(inspection, excluded = []) {
  let settings = cloneConfiguration(inspection.settings);
  for (const path of excluded) settings = setConfigurationValue(settings, path, undefined);
  return { ...inspection, settings };
}

export function remapConfigurationImport(inspection, mappings) {
  const references = importReferences(inspection);
  for (const kind of ["scenes", "users"]) {
    const targets = references[kind].map((id) => mappings[kind][id]);
    if (targets.some((id) => id === undefined || id === "__unresolved__")) throw new Error("unknownReferences");
    const selected = targets.filter(Boolean);
    if (new Set(selected).size !== selected.length) throw new Error("duplicateDestination");
  }
  const mapLayouts = (layouts) => Object.fromEntries(Object.entries(layouts ?? {}).flatMap(([id, value]) => {
    const target = mappings.users[id];
    if (!target) return [];
    const layout = cloneConfiguration(value);
    if (layout.relative?.targetUserId) {
      const relativeTarget = mappings.users[layout.relative.targetUserId];
      if (!relativeTarget) throw new Error("missingRelativeTarget");
      layout.relative.targetUserId = relativeTarget;
    }
    return [[target, layout]];
  }));
  const settings = {};
  if (inspection.present.includes("profileLibrary")) settings.profileLibrary = cloneConfiguration(inspection.settings.profileLibrary);
  if (inspection.present.includes("playerLayouts")) settings.playerLayouts = mapLayouts(inspection.settings.playerLayouts);
  if (inspection.present.includes("sceneProfiles")) settings.sceneProfiles = Object.fromEntries(Object.entries(inspection.settings.sceneProfiles).flatMap(([id, profile]) => {
    const target = mappings.scenes[id];
    return target ? [[target, { ...cloneConfiguration(profile), layouts: mapLayouts(profile.layouts), ...(profile.roleVariants ? { roleVariants: remapRoleVariants(profile.roleVariants, mapLayouts) } : {}) }]] : [];
  }));
  if (inspection.present.includes("sceneCamera")) settings.sceneCamera = Object.fromEntries(Object.entries(inspection.settings.sceneCamera).flatMap(([id, camera]) => {
    const target = mappings.scenes[id];
    if (camera === null) return target ? [[target, null]] : [];
    const playerId = mappings.users[camera.playerId];
    return target && playerId ? [[target, { ...camera, playerId }]] : [];
  }));
  return { ...inspection, settings };
}

export function inspectConfigurationImport(json) {
  if (!record(json) || !safeTree(json)) return null;
  if (json.moduleId !== undefined && json.moduleId !== MODULE_ID) return null;
  if (![1, 2].includes(Number(json.version ?? 1))) return null;
  const source = Object.hasOwn(json, "settings") ? json.settings : json;
  if (!record(source)) return null;
  const present = [...CONFIG_BLOCKS, ...OPTIONAL_CONFIG_BLOCKS].filter((key) => Object.hasOwn(source, key));
  if (!present.length || present.some((key) => !record(source[key]))) return null;
  if (source.playerLayouts && !layoutsValid(source.playerLayouts)) return null;
  if (source.sceneProfiles && !Object.values(source.sceneProfiles).every((profile) =>
    record(profile) && layoutsValid(profile.layouts ?? {}) &&
    (profile.enabled === undefined || typeof profile.enabled === "boolean") &&
    (profile.cameraControlMode === undefined || ["native", "module"].includes(profile.cameraControlMode))
  )) return null;
  if (source.sceneCamera && !Object.values(source.sceneCamera).every((camera) =>
    camera === null || (record(camera) && typeof camera.playerId === "string" && camera.playerId.trim())
  )) return null;
  const settings = cloneConfiguration(source);
  try {
    for (const profile of Object.values(settings.sceneProfiles ?? {})) if (Object.hasOwn(profile, "roleVariants")) profile.roleVariants = normalizeRoleVariants(profile.roleVariants);
  } catch { return null; }
  if (settings.profileLibrary) {
    try { settings.profileLibrary = normalizeProfileLibrary(settings.profileLibrary); }
    catch { return null; }
  }
  if (settings.playerLayouts) settings.playerLayouts = normalizedLayouts(settings.playerLayouts);
  if (settings.sceneProfiles) {
    settings.sceneProfiles = Object.fromEntries(Object.entries(settings.sceneProfiles).map(([id, profile]) => [id, {
      ...profile, layouts: normalizedLayouts(profile.layouts ?? {})
    }]));
  }
  if (settings.sceneCamera) settings.sceneCamera = Object.fromEntries(Object.entries(settings.sceneCamera).map(([id, camera]) => {
    if (camera === null) return [id, null];
    const normalized = normalizeSceneCamera(camera);
    if (!Object.hasOwn(camera, "fit")) delete normalized.fit;
    return [id, normalized];
  }));
  return { settings, present, complete: CONFIG_BLOCKS.every((key) => present.includes(key)) };
}

export function configurationBackup() {
  return {
    moduleId: MODULE_ID,
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: Object.fromEntries([...CONFIG_BLOCKS, ...OPTIONAL_CONFIG_BLOCKS].map((key) => [key, cloneConfiguration(game.settings.get(MODULE_ID, key) ?? {})]))
  };
}

function combine(target, source) {
  let result = cloneConfiguration(target ?? {});
  for (const [key, value] of Object.entries(source)) {
    result = setConfigurationValue(result, [key], record(value) ? combine(result[key], value) : value);
  }
  return result;
}

export function prepareConfigurationImport(inspection, current, { mode = "merge", selection } = {}) {
  if (!inspection || !["merge", "replace", "restore"].includes(mode)) throw new Error("invalidImport");
  if (mode === "restore" && !inspection.complete) throw new Error("incompleteBackup");
  const writes = [];
  for (const key of inspection.present) {
    const before = cloneConfiguration(current[key] ?? {});
    let after = mode === "restore" ? cloneConfiguration(inspection.settings[key]) : cloneConfiguration(before);
    if (mode !== "restore") {
      for (const [id, value] of Object.entries(inspection.settings[key])) {
        if (selection && !selection[key]?.includes(id)) continue;
        if (value === null) { delete after[id]; continue; }
        after[id] = mode === "merge" && key !== SETTINGS_KEYS.PROFILE_LIBRARY ? combine(before[id], value) : cloneConfiguration(value);
        if (mode === "replace" && key === "sceneProfiles") {
          after[id] = { ...cloneConfiguration(before[id] ?? {}), ...after[id], layouts: { ...cloneConfiguration(before[id]?.layouts ?? {}), ...after[id].layouts } };
          if (value.roleVariants) {
            after[id].roleVariants = cloneConfiguration(before[id]?.roleVariants ?? {});
            for (const [role, variant] of Object.entries(value.roleVariants)) {
              const previous = before[id]?.roleVariants?.[role] ?? {};
              after[id].roleVariants[role] = { ...cloneConfiguration(previous), ...variant, layouts: { ...cloneConfiguration(previous.layouts ?? {}), ...variant.layouts } };
            }
          }
        }
      }
    }
    if (!configurationEqual(before, after)) writes.push({ key, before, after });
  }
  return { mode, writes, changes: writes.flatMap((item) => configurationChanges(item.before, item.after, [item.key])) };
}

export async function applyConfigurationImport(plan) {
  if (!game.user?.isGM) return { ok: false, reason: "permission" };
  return writeConfigurationBlocks(plan.writes, {
    read: (key) => game.settings.get(MODULE_ID, key) ?? {},
    write: (key, value) => game.settings.set(MODULE_ID, key, value)
  });
}
