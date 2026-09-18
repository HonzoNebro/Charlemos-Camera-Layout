import { cloneConfiguration } from "./edit-session.js";

export function sceneProfileEntries(profiles, scenes, users) {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const userIds = new Set(users.map((user) => user.id));
  return Object.entries(profiles ?? {}).map(([id, profile]) => ({
    id, name: sceneMap.get(id)?.name ?? id, missing: !sceneMap.has(id),
    enabled: Boolean(profile.enabled), cameraControlMode: profile.cameraControlMode ?? "native",
    cameras: Object.keys(profile.layouts ?? {}).length,
    missingUsers: Object.keys(profile.layouts ?? {}).filter((userId) => !userIds.has(userId))
  })).sort((a, b) => Number(a.missing) - Number(b.missing) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function duplicateSceneComposition(source, destination, users) {
  const ids = Object.keys(source?.layouts ?? {});
  const available = new Set(users.map((user) => user.id));
  if (ids.some((id) => !available.has(id))) throw new Error("profileMissingUsers");
  if (!ids.length) throw new Error("profileEmpty");
  const next = cloneConfiguration(destination ?? {});
  next.enabled = true;
  next.cameraControlMode = source.cameraControlMode ?? "native";
  next.layouts = { ...next.layouts, ...cloneConfiguration(source.layouts) };
  for (const id of ids) if (next.layouts[id].overlay) delete next.layouts[id].overlay.userId;
  return { profile: next, replaced: ids.filter((id) => destination?.layouts?.[id]), added: ids.filter((id) => !destination?.layouts?.[id]) };
}

export function uniqueCompositionMacroName(sceneName, stateLabel, names, fallback) {
  const base = `${sceneName || fallback} — ${stateLabel}`;
  const existing = new Set(names);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base} (${suffix})`)) suffix++;
  return `${base} (${suffix})`;
}
