import { cloneConfiguration, setConfigurationValue, configurationValue } from "./edit-session.js";
import { normalizeOverlayBounds } from "./overlay-bounds.js";
import { normalizeOverlayBlendMode } from "./overlay-blend.js";

export const CAMERA_AUDIENCES = ["base", "gm", "player"];

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeTree(value) {
  return !value || typeof value !== "object" || Object.entries(value).every(([key, child]) =>
    !["__proto__", "constructor", "prototype"].includes(key) && safeTree(child));
}

function partialLayout(value) {
  if (!record(value) || !safeTree(value) || ["overlay", "geometry", "relative", "crop", "nameStyle"].some((key) => value[key] != null && !record(value[key]))) throw new Error("roleVariantsInvalid");
  const next = cloneConfiguration(value);
  if (next.overlay) {
    delete next.overlay.userId;
    if (Object.hasOwn(next.overlay, "blendMode")) next.overlay.blendMode = normalizeOverlayBlendMode(next.overlay.blendMode);
    if (next.overlay.bounds) {
      if (!record(next.overlay.bounds)) throw new Error("roleVariantsInvalid");
      const bounds = normalizeOverlayBounds(next.overlay.bounds);
      next.overlay.bounds = Object.fromEntries(Object.keys(next.overlay.bounds).filter((key) => Object.hasOwn(bounds, key)).map((key) => [key, bounds[key]]));
    }
  }
  return next;
}

export function normalizeRoleVariants(value) {
  if (!record(value) || !safeTree(value)) throw new Error("roleVariantsInvalid");
  return Object.fromEntries(Object.entries(value).map(([role, variant]) => {
    if (!["gm", "player"].includes(role) || !record(variant) || Object.keys(variant).some((key) => !["layouts", "cameraControlMode"].includes(key))) throw new Error("roleVariantsInvalid");
    if (variant.cameraControlMode !== undefined && !["native", "module"].includes(variant.cameraControlMode)) throw new Error("roleVariantsInvalid");
    if (variant.layouts !== undefined && !record(variant.layouts)) throw new Error("roleVariantsInvalid");
    return [role, { ...cloneConfiguration(variant), ...(variant.layouts ? { layouts: Object.fromEntries(Object.entries(variant.layouts).map(([id, layout]) => [id, partialLayout(layout)])) } : {}) }];
  }));
}

function mergeVariant(base, patch) {
  let result = cloneConfiguration(base ?? {});
  for (const [key, value] of Object.entries(patch ?? {})) {
    result = setConfigurationValue(result, [key], record(value) ? mergeVariant(record(result[key]) ? result[key] : {}, value) : value);
  }
  return result;
}

export function profileForAudience(profile, audience) {
  if (!profile || audience === "base" || !["gm", "player"].includes(audience) || !profile.roleVariants) return profile;
  let variant;
  try { variant = normalizeRoleVariants(profile.roleVariants)[audience]; }
  catch { return profile; }
  if (!variant) return profile;
  return { ...profile, ...mergeVariant({ cameraControlMode: profile.cameraControlMode, layouts: profile.layouts ?? {} }, variant) };
}

export function cameraSessionForAudience(session, audience) {
  if (!session || !["gm", "player"].includes(audience)) return session;
  return new Proxy(session, {
    get(target, key) {
      if (key === "draft") return { ...target.draft, profile: profileForAudience(target.draft.profile, audience) };
      if (key === "edit") return (path, value) => {
        if (path[0] === "profile" && ["layouts", "cameraControlMode"].includes(path[1])) {
          const scopedPath = ["profile", "roleVariants", audience, ...path.slice(1)];
          if (value !== undefined || configurationValue(target.draft, scopedPath) !== undefined) target.edit(scopedPath, value);
        }
        else target.edit(path, value);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, key, value) { target[key] = value; return true; }
  });
}

export function roleVariantUserIds(profile) {
  const ids = new Set();
  for (const variant of Object.values(profile?.roleVariants ?? {})) {
    for (const [id, layout] of Object.entries(variant.layouts ?? {})) {
      ids.add(id);
      if (layout.relative?.targetUserId) ids.add(layout.relative.targetUserId);
    }
  }
  return [...ids];
}

export function profileCameraIds(profile) {
  return [...new Set([
    ...Object.keys(profile?.layouts ?? {}),
    ...Object.values(profile?.roleVariants ?? {}).flatMap((variant) => Object.keys(variant.layouts ?? {}))
  ])];
}

export function remapRoleVariants(value, mapLayouts) {
  return Object.fromEntries(Object.entries(normalizeRoleVariants(value)).map(([role, variant]) =>
    [role, { ...variant, ...(variant.layouts ? { layouts: mapLayouts(variant.layouts) } : {}) }]));
}
