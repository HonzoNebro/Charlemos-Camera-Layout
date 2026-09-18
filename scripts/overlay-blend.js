export const OVERLAY_BLEND_MODES = ["auto", "normal", "screen", "soft-light"];

export function normalizeOverlayBlendMode(value) {
  return OVERLAY_BLEND_MODES.includes(value) ? value : "auto";
}
