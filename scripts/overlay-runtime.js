import { visualOverflow } from "./overlay-bounds.js";

const runtimeEntries = new Map();
const entriesByView = new WeakMap();
const pendingSpacing = new Set();

let resizeObserver = null;
let spacingFrame = null;

function numericStyle(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function computedStyle(element) {
  const ownerWindow = element?.ownerDocument?.defaultView ?? globalThis.window;
  return ownerWindow?.getComputedStyle?.(element) ?? null;
}

function captureDockStyle(entry) {
  if (entry.nativeDockStyle || !entry.viewElement?.style) return;
  const viewElement = entry.viewElement;
  const computed = computedStyle(viewElement);
  entry.nativeDockStyle = {
    marginTop: viewElement.style.marginTop ?? "",
    marginRight: viewElement.style.marginRight ?? "",
    marginBottom: viewElement.style.marginBottom ?? "",
    marginLeft: viewElement.style.marginLeft ?? "",
    flexShrink: viewElement.style.flexShrink ?? "",
    base: {
      top: numericStyle(computed?.marginTop),
      right: numericStyle(computed?.marginRight),
      bottom: numericStyle(computed?.marginBottom),
      left: numericStyle(computed?.marginLeft)
    }
  };
}

function restoreDockStyle(entry) {
  const native = entry.nativeDockStyle;
  const style = entry.viewElement?.style;
  if (!native || !style) return;
  style.marginTop = native.marginTop;
  style.marginRight = native.marginRight;
  style.marginBottom = native.marginBottom;
  style.marginLeft = native.marginLeft;
  style.flexShrink = native.flexShrink;
  entry.nativeDockStyle = null;
  entry.spacing = null;
}

export function calculateOverlayDockSpacing(viewRect, overlayRect) {
  return visualOverflow(viewRect, overlayRect);
}

function applyDockSpacing(entry) {
  if (!entry.expanded || entry.popout || entry.viewElement?.isConnected === false) return;
  const viewRect = entry.viewElement?.getBoundingClientRect?.();
  const overlayRect = entry.overlayElement?.getBoundingClientRect?.();
  if (!viewRect || !overlayRect) return;
  captureDockStyle(entry);
  const base = entry.nativeDockStyle?.base;
  if (!base) return;
  const spacing = calculateOverlayDockSpacing(viewRect, overlayRect);
  entry.spacing = spacing;
  entry.viewElement.style.marginTop = `${base.top + spacing.top}px`;
  entry.viewElement.style.marginRight = `${base.right + spacing.right}px`;
  entry.viewElement.style.marginBottom = `${base.bottom + spacing.bottom}px`;
  entry.viewElement.style.marginLeft = `${base.left + spacing.left}px`;
  entry.viewElement.style.flexShrink = "0";
}

function flushSpacing() {
  spacingFrame = null;
  const keys = [...pendingSpacing];
  pendingSpacing.clear();
  keys.forEach((key) => {
    const entry = runtimeEntries.get(key);
    if (entry) applyDockSpacing(entry);
  });
}

function scheduleFrame(callback) {
  if (typeof globalThis.window?.requestAnimationFrame === "function") return globalThis.window.requestAnimationFrame(callback);
  if (typeof globalThis.window?.setTimeout === "function") return globalThis.window.setTimeout(callback, 0);
  callback();
  return null;
}

function scheduleDockSpacing(entry) {
  pendingSpacing.add(entry.key);
  if (spacingFrame !== null) return;
  spacingFrame = scheduleFrame(flushSpacing);
}

function sharedResizeObserver() {
  if (resizeObserver || typeof globalThis.ResizeObserver !== "function") return resizeObserver;
  resizeObserver = new globalThis.ResizeObserver((records) => {
    records.forEach((record) => {
      const entry = entriesByView.get(record.target);
      if (entry) scheduleDockSpacing(entry);
    });
  });
  return resizeObserver;
}

function stopObserving(entry) {
  resizeObserver?.unobserve?.(entry.viewElement);
  entriesByView.delete(entry.viewElement);
}

function syncObservation(entry) {
  stopObserving(entry);
  if (!entry.expanded || entry.popout) {
    restoreDockStyle(entry);
    return;
  }
  entriesByView.set(entry.viewElement, entry);
  sharedResizeObserver()?.observe?.(entry.viewElement);
  scheduleDockSpacing(entry);
}

function removeOverlayElement(overlayElement) {
  const mediaElement = overlayElement?.querySelector?.(".charlemos-camera-overlay-video");
  if (mediaElement) {
    mediaElement.pause?.();
    mediaElement.removeAttribute?.("src");
    mediaElement.load?.();
  }
  overlayElement?.remove?.();
}

function detachEntry(entry) {
  if (!entry) return;
  stopObserving(entry);
  pendingSpacing.delete(entry.key);
  restoreDockStyle(entry);
  entry.viewElement?.classList?.remove?.("charlemos-overlay-expanded");
  entry.viewElement?.classList?.remove?.("charlemos-overlay-dock-spaced");
}

function disposeEntry(entry, removeOverlay) {
  if (!entry) return;
  detachEntry(entry);
  entry.onDispose?.();
  if (removeOverlay) removeOverlayElement(entry.overlayElement);
}

export function reconcileAnchoredOverlay(options) {
  const key = `${options.sceneId ?? "none"}:${options.userId}`;
  runtimeEntries.forEach((entry, existingKey) => {
    if (existingKey === key || entry.userId !== options.userId) return;
    if (entry.viewElement === options.viewElement) {
      detachEntry(entry);
      if (entry.overlayElement !== options.overlayElement) removeOverlayElement(entry.overlayElement);
    } else {
      disposeEntry(entry, true);
    }
    runtimeEntries.delete(existingKey);
  });
  const previous = runtimeEntries.get(key);
  if (previous && previous.viewElement !== options.viewElement) disposeEntry(previous, true);
  if (previous?.viewElement === options.viewElement && previous.overlayElement !== options.overlayElement) {
    removeOverlayElement(previous.overlayElement);
  }
  const entry = previous?.viewElement === options.viewElement ? previous : { key };
  entry.sceneId = options.sceneId ?? null;
  entry.userId = options.userId;
  entry.viewElement = options.viewElement;
  entry.overlayElement = options.overlayElement;
  entry.expanded = Boolean(options.expanded);
  entry.popout = Boolean(options.popout);
  entry.onDispose = typeof options.onDispose === "function" ? options.onDispose : null;
  runtimeEntries.set(key, entry);
  entry.viewElement?.classList?.toggle?.("charlemos-overlay-expanded", entry.expanded);
  entry.viewElement?.classList?.toggle?.("charlemos-overlay-dock-spaced", entry.expanded && !entry.popout);
  syncObservation(entry);
  return key;
}

export function cleanupAnchoredOverlays(activeKeys = new Set()) {
  runtimeEntries.forEach((entry, key) => {
    if (activeKeys.has(key)) return;
    disposeEntry(entry, true);
    runtimeEntries.delete(key);
  });
}

export function removeAnchoredOverlay(sceneId, userId) {
  const key = `${sceneId ?? "none"}:${userId}`;
  const entry = runtimeEntries.get(key);
  if (!entry) return false;
  disposeEntry(entry, true);
  runtimeEntries.delete(key);
  return true;
}

export function clearAnchoredOverlays() {
  cleanupAnchoredOverlays(new Set());
  resizeObserver?.disconnect?.();
  resizeObserver = null;
}

export function anchoredOverlaySnapshot(sceneId, userId) {
  const entry = runtimeEntries.get(`${sceneId ?? "none"}:${userId}`);
  if (!entry) return null;
  return {
    sceneId: entry.sceneId,
    userId: entry.userId,
    expanded: entry.expanded,
    popout: entry.popout,
    spacing: entry.spacing,
    viewRect: entry.viewElement?.getBoundingClientRect?.() ?? null,
    overlayRect: entry.overlayElement?.getBoundingClientRect?.() ?? null
  };
}
