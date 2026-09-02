export const OVERLAY_BOUNDS_MODES = new Set(["camera", "expanded"]);
export const MAX_OVERLAY_BOUND_PERCENT = 500;

function boundedPercentage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_OVERLAY_BOUND_PERCENT, Math.max(0, parsed));
}

export function normalizeOverlayBounds(value) {
  const mode = OVERLAY_BOUNDS_MODES.has(String(value?.mode ?? "").trim()) ? String(value.mode).trim() : "camera";
  return {
    mode,
    top: boundedPercentage(value?.top),
    right: boundedPercentage(value?.right),
    bottom: boundedPercentage(value?.bottom),
    left: boundedPercentage(value?.left)
  };
}

export function normalizeOverlayConfiguration(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { userId: _userId, ...overlay } = value;
  return {
    ...overlay,
    bounds: normalizeOverlayBounds(value.bounds)
  };
}

export function expandedOverlayBounds(value) {
  const bounds = normalizeOverlayBounds(value?.bounds ?? value);
  return bounds.mode === "expanded" ? bounds : null;
}

export function overlayBoundsInset(value) {
  const bounds = expandedOverlayBounds(value);
  if (!bounds) return "0";
  return `-${bounds.top}% -${bounds.right}% -${bounds.bottom}% -${bounds.left}%`;
}

export function visualOverflow(viewRect, overlayRect) {
  if (!viewRect || !overlayRect) return { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    top: Math.max(0, viewRect.top - overlayRect.top),
    right: Math.max(0, overlayRect.right - viewRect.right),
    bottom: Math.max(0, overlayRect.bottom - viewRect.bottom),
    left: Math.max(0, viewRect.left - overlayRect.left)
  };
}
