import { cloneConfiguration } from "./edit-session.js";
import { roleVariantUserIds, normalizeRoleVariants, profileCameraIds } from "./role-variants.js";

export function sceneProfileEntries(profiles, scenes, users) {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const userIds = new Set(users.map((user) => user.id));
  return Object.entries(profiles ?? {}).map(([id, profile]) => ({
    id, name: sceneMap.get(id)?.name ?? id, missing: !sceneMap.has(id),
    enabled: Boolean(profile.enabled), cameraControlMode: profile.cameraControlMode ?? "native",
    cameras: profileCameraIds(profile).length,
    missingUsers: [...new Set([...Object.keys(profile.layouts ?? {}), ...roleVariantUserIds(profile)])].filter((userId) => !userIds.has(userId))
  })).sort((a, b) => Number(a.missing) - Number(b.missing) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function duplicateSceneComposition(source, destination, users) {
  const variants = normalizeRoleVariants(source?.roleVariants ?? {});
  const ids = [...new Set([...Object.keys(source?.layouts ?? {}), ...Object.values(variants).flatMap((variant) => Object.keys(variant.layouts ?? {}))])];
  const available = new Set(users.map((user) => user.id));
  if ([...ids, ...roleVariantUserIds(source)].some((id) => !available.has(id))) throw new Error("profileMissingUsers");
  if (!ids.length) throw new Error("profileEmpty");
  const next = cloneConfiguration(destination ?? {});
  next.enabled = true;
  next.cameraControlMode = source.cameraControlMode ?? "native";
  next.layouts = { ...next.layouts, ...cloneConfiguration(source.layouts) };
  for (const [role, variant] of Object.entries(variants)) {
    next.roleVariants ??= {};
    next.roleVariants[role] = { ...next.roleVariants[role], ...variant, layouts: { ...next.roleVariants[role]?.layouts, ...variant.layouts } };
  }
  for (const id of ids) if (next.layouts[id]?.overlay) delete next.layouts[id].overlay.userId;
  const existing = new Set(profileCameraIds(destination));
  return { profile: next, replaced: ids.filter((id) => existing.has(id)), added: ids.filter((id) => !existing.has(id)) };
}

export function uniqueCompositionMacroName(sceneName, stateLabel, names, fallback) {
  const base = `${sceneName || fallback} — ${stateLabel}`;
  const existing = new Set(names);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base} (${suffix})`)) suffix++;
  return `${base} (${suffix})`;
}
