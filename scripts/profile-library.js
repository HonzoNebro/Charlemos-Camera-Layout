import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { cloneConfiguration, configurationEqual, writeConfigurationBlocks } from "./edit-session.js";
import { normalizeOverlayConfiguration } from "./overlay-bounds.js";

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeId(value) {
  return typeof value === "string" && value.trim() !== "" && !["__proto__", "prototype", "constructor", "__unresolved__"].includes(value);
}

function safeTree(value) {
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, child]) => safeId(key) && safeTree(child));
}

export function templateFromProfile(name, profile, revision = 1) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) throw new Error("templateNameInvalid");
  if (!record(profile) || !record(profile.layouts) || !safeTree(profile)) throw new Error("templateInvalid");
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("templateInvalid");
  const mode = profile.cameraControlMode ?? "native";
  if (!["native", "module"].includes(mode)) throw new Error("templateInvalid");
  const layouts = Object.fromEntries(Object.entries(profile.layouts).map(([id, layout]) => {
    if (!safeId(id) || !record(layout) || ["overlay", "geometry", "relative", "crop", "nameStyle"].some((key) => layout[key] != null && !record(layout[key]))) throw new Error("templateInvalid");
    const next = cloneConfiguration(layout);
    if (next.overlay) next.overlay = normalizeOverlayConfiguration(next.overlay);
    if (next.relative?.targetUserId && !safeId(next.relative.targetUserId)) throw new Error("templateInvalid");
    return [id, next];
  }));
  if (!Object.keys(layouts).length) throw new Error("profileEmpty");
  return { name: name.trim(), revision, profile: { cameraControlMode: mode, layouts } };
}

export function normalizeProfileLibrary(value) {
  if (!record(value) || !safeTree(value)) throw new Error("templateInvalid");
  return Object.fromEntries(Object.entries(value).map(([id, entry]) => {
    if (!safeId(id) || !record(entry)) throw new Error("templateInvalid");
    return [id, templateFromProfile(entry.name, entry.profile, entry.revision)];
  }));
}

export function readProfileLibrary() {
  return cloneConfiguration(game.settings.get(MODULE_ID, SETTINGS_KEYS.PROFILE_LIBRARY) ?? {});
}

export function templateUserIds(template) {
  const ids = new Set(Object.keys(template.profile.layouts));
  for (const layout of Object.values(template.profile.layouts)) if (layout.relative?.targetUserId) ids.add(layout.relative.targetUserId);
  return [...ids];
}

export function profileWithTemplate(template, destination, mappings, users) {
  const entry = templateFromProfile(template.name, template.profile, template.revision);
  const available = new Set(users.map((user) => user.id));
  const targets = templateUserIds(entry).map((id) => mappings[id]);
  if (targets.some((id) => id !== "" && (!safeId(id) || !available.has(id)))) throw new Error("unknownReferences");
  const included = targets.filter(Boolean);
  if (new Set(included).size !== included.length) throw new Error("duplicateDestination");
  const layouts = Object.fromEntries(Object.entries(entry.profile.layouts).flatMap(([id, source]) => {
    const target = mappings[id];
    if (!target) return [];
    const layout = cloneConfiguration(source);
    if (layout.relative?.targetUserId) {
      const relativeTarget = mappings[layout.relative.targetUserId];
      if (!relativeTarget) throw new Error("missingRelativeTarget");
      layout.relative.targetUserId = relativeTarget;
    }
    return [[target, layout]];
  }));
  if (!Object.keys(layouts).length) throw new Error("profileEmpty");
  return { ...cloneConfiguration(destination), enabled: true, cameraControlMode: entry.profile.cameraControlMode, layouts: { ...cloneConfiguration(destination?.layouts ?? {}), ...layouts } };
}

export async function writeProfileTemplate(id, entry, expected) {
  if (!game.user?.isGM) return { ok: false, reason: "permission" };
  if (!safeId(id)) return { ok: false, reason: "templateInvalid" };
  const before = readProfileLibrary();
  if (!configurationEqual(before[id], expected)) return { ok: false, reason: "templateChanged" };
  let after;
  try {
    normalizeProfileLibrary(before);
    after = cloneConfiguration(before);
    if (entry === null) delete after[id];
    else after[id] = templateFromProfile(entry.name, entry.profile, entry.revision);
  } catch (error) { return { ok: false, reason: error.message }; }
  return writeConfigurationBlocks([{ key: SETTINGS_KEYS.PROFILE_LIBRARY, before, after }], {
    read: () => readProfileLibrary(),
    write: (key, value) => game.settings.set(MODULE_ID, key, value)
  });
}
