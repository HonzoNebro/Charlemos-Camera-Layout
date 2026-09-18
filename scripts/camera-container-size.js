const managed = new WeakMap();

export function restoreCameraContainerSize(view) {
  const record = managed.get(view);
  if (!record) return;
  for (const [key, value] of Object.entries(record.applied)) {
    if (record.container.style[key] === value) record.container.style[key] = record.before[key];
  }
  managed.delete(view);
}

export function syncCameraContainerSize(view, enabled) {
  restoreCameraContainerSize(view);
  if (!enabled || !(view?.clientWidth > 0 && view?.clientHeight > 0)) return;
  const container = view.querySelector?.(".video-container, .camera-container-popout, .camera-container");
  if (!container?.style || container === view || !container.querySelector?.("video")) return;
  const computed = container.ownerDocument?.defaultView?.getComputedStyle?.(container);
  if (computed?.display === "none" || computed?.visibility === "hidden") return;
  const applied = {};
  if (container.clientWidth === 0) applied.width = "100%";
  if (container.clientHeight === 0) applied.height = "100%";
  if (!Object.keys(applied).length) return;
  const before = Object.fromEntries(Object.keys(applied).map((key) => [key, container.style[key] ?? ""]));
  Object.assign(container.style, applied);
  managed.set(view, { container, before, applied });
}
