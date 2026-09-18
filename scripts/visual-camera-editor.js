import { resolveEditorCameraView } from "./camera-video-source.js";
import { viewSupportsModuleGeometry } from "./live-camera-renderer.js";
import { inferLayoutMode } from "./camera-config-model.js";
import { simpleLength, editorText as t } from "./editor-fields.js";

export function lengthPixels(value, axis, context, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = simpleLength(value);
  if (!parsed) return null;
  const factor = { px: 1, "%": context[axis] / 100, vw: context.viewportWidth / 100, vh: context.viewportHeight / 100 }[parsed.unit];
  return parsed.value * factor;
}

export function pixelsLength(value, original, axis, context) {
  const unit = simpleLength(original)?.unit ?? "px";
  const factor = { px: 1, "%": context[axis] / 100, vw: context.viewportWidth / 100, vh: context.viewportHeight / 100 }[unit];
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return `${Math.round(value / factor * 1000) / 1000}${unit}`;
}

export function snapCoordinate(value, size, guides, tolerance = 8) {
  let best = { value, distance: tolerance + 1, guide: null };
  for (const guide of guides) {
    for (const offset of [0, size / 2, size]) {
      const distance = Math.abs(guide - value - offset);
      if (distance <= tolerance && distance < best.distance) best = { value: guide - offset, distance, guide };
    }
  }
  return best;
}

export class VisualCameraEditor {
  constructor({ session, onUpdate, onCommit, onProblem }) {
    this.session = session;
    this.onUpdate = onUpdate;
    this.onCommit = onCommit;
    this.onProblem = onProblem;
    this.element = "camera";
    this.snap = true;
    this.lockRatio = false;
    this.nodes = [];
    this.gesture = null;
  }

  reconcile(userId) {
    if (this.gesture) {
      if (!this.view?.isConnected) this.finish(false);
      return;
    }
    this.clearNodes();
    if (globalThis.canvas?.scene?.id !== this.session.sceneId || globalThis.canvas?.ready === false || !this.session.preview) return;
    const view = resolveEditorCameraView(userId);
    if (!view || view.closest?.(".minimized")) return;
    this.userId = userId;
    this.view = view;
    const doc = view.ownerDocument;
    const root = doc.createElement("div");
    root.className = "charlemos-visual-editor";
    root.dataset.charlemosAnchorUserId = userId;
    root.dataset.charlemosSceneId = this.session.sceneId;
    root.setAttribute("aria-label", t("visualEditor"));
    const caption = doc.createElement("span");
    caption.className = "charlemos-editor-caption";
    caption.textContent = `${globalThis.game?.users?.get?.(userId)?.name ?? userId} · ${t(this.element)}`;
    root.appendChild(caption);
    const layout = this.session.draft.profile.layouts[userId] ?? {};
    const moduleOwned = this.session.draft.profile.cameraControlMode === "module" && viewSupportsModuleGeometry(view);
    const actions = this.element === "camera" ? moduleOwned ? ["move", "n", "ne", "e", "se", "s", "sw", "w", "nw"] : [] :
      this.element === "overlay" ? ["move", "scale", "rotate", "bounds-top", "bounds-right", "bounds-bottom", "bounds-left"] : ["offset"];
    for (const action of actions) {
      if (action === "move" && this.element === "camera" && inferLayoutMode(layout) === "relative") continue;
      const handle = doc.createElement("button");
      handle.type = "button";
      handle.className = `charlemos-visual-handle charlemos-handle-${action}`;
      handle.textContent = t(`handle-${action}`);
      handle.setAttribute("aria-label", `${t(this.element)}: ${handle.textContent}`);
      handle.addEventListener("pointerdown", (event) => this.start(event, action));
      root.appendChild(handle);
    }
    view.appendChild(root);
    this.nodes.push(root);
    const Resize = doc.defaultView?.ResizeObserver;
    if (Resize) {
      this.resizeObserver = new Resize(() => this.drawRects());
      this.resizeObserver.observe(view);
    }
    this.drawRects();
  }

  drawRects() {
    if (!this.nodes[0] || !this.view?.isConnected) return;
    const camera = this.view.getBoundingClientRect();
    let boundsOutline = this.nodes[0].querySelector('[data-outline="bounds"]');
    if (!boundsOutline) {
      boundsOutline = this.view.ownerDocument.createElement("span");
      boundsOutline.dataset.outline = "bounds";
      boundsOutline.className = "charlemos-editor-outline";
      boundsOutline.setAttribute("aria-hidden", "true");
      this.nodes[0].appendChild(boundsOutline);
    }
    const configured = this.session.draft.profile.layouts[this.userId]?.overlay?.bounds;
    const bounds = configured?.mode === "expanded" ? configured : {};
    Object.assign(boundsOutline.style, {
      left: `${-(bounds.left ?? 0)}%`, top: `${-(bounds.top ?? 0)}%`,
      width: `${100 + (bounds.left ?? 0) + (bounds.right ?? 0)}%`, height: `${100 + (bounds.top ?? 0) + (bounds.bottom ?? 0)}%`
    });
    for (const [kind, target] of [["overlay", this.view.querySelector(".charlemos-camera-overlay")], ["name", this.view.querySelector(".charlemos-camera-name")]]) {
      let outline = this.nodes[0].querySelector(`[data-outline="${kind}"]`);
      if (!target) { outline?.remove(); continue; }
      if (!outline) {
        outline = this.view.ownerDocument.createElement("span");
        outline.dataset.outline = kind;
        outline.className = "charlemos-editor-outline";
        this.nodes[0].appendChild(outline);
      }
      const rect = target.getBoundingClientRect();
      Object.assign(outline.style, { left: `${rect.left - camera.left}px`, top: `${rect.top - camera.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    }
  }

  start(event, action) {
    if (event.button !== 0 || this.gesture || this.session.busy) return;
    event.preventDefault();
    event.stopPropagation();
    const view = this.view;
    const rect = view.getBoundingClientRect();
    const win = view.ownerDocument.defaultView;
    const parent = view.offsetParent?.getBoundingClientRect() ?? { width: win.innerWidth, height: win.innerHeight };
    const context = { width: parent.width, height: parent.height, viewportWidth: win.innerWidth, viewportHeight: win.innerHeight };
    const layout = structuredClone(this.session.draft.profile.layouts[this.userId] ?? {});
    const relevant = this.element === "camera" ? ["top", "left", "width", "height"] : [];
    if (relevant.some((key) => layout[key] && !simpleLength(layout[key]))) {
      this.onProblem("convertBeforeDrag");
      return;
    }
    const overlay = view.querySelector(".charlemos-camera-overlay");
    const localContext = { ...context, width: this.element === "overlay" ? overlay?.offsetWidth ?? rect.width : rect.width, height: this.element === "overlay" ? overlay?.offsetHeight ?? rect.height : rect.height };
    if (this.element === "overlay" && action === "move" && ["x", "y"].some((axis) => layout.overlay?.offset?.[axis] && !simpleLength(layout.overlay.offset[axis]))) {
      this.onProblem("convertBeforeDrag");
      return;
    }
    if (this.element === "name" && layout.nameStyle?.offset && !simpleLength(layout.nameStyle.offset)) {
      this.onProblem("convertBeforeDrag");
      return;
    }
    this.session.beginGesture();
    this.gesture = { action, rect, layout, context, localContext, x: event.clientX, y: event.clientY, handle: event.currentTarget, pointerId: event.pointerId };
    this.gesture.handle.setPointerCapture(event.pointerId);
    this.moveListener = (move) => this.move(move);
    this.upListener = () => this.finish(false);
    this.cancelListener = () => this.finish(true);
    this.lostPointerListener = () => this.finish(false);
    this.keyListener = (key) => { if (key.key === "Escape") { key.preventDefault(); key.stopPropagation(); this.finish(true); } };
    this.gesture.handle.addEventListener("pointermove", this.moveListener);
    this.gesture.handle.addEventListener("pointerup", this.upListener);
    this.gesture.handle.addEventListener("pointercancel", this.cancelListener);
    this.gesture.handle.addEventListener("lostpointercapture", this.lostPointerListener);
    view.ownerDocument.addEventListener("keydown", this.keyListener, true);
  }

  move(event) {
    if (!this.gesture) return;
    event.preventDefault();
    event.stopPropagation();
    this.pendingPoint = { x: event.clientX, y: event.clientY };
    if (this.frame !== undefined) return;
    this.frame = this.view.ownerDocument.defaultView.requestAnimationFrame(() => {
      this.frame = undefined;
      this.applyPoint();
    });
  }

  applyPoint() {
    if (!this.gesture || !this.pendingPoint) return;
    const dx = this.pendingPoint.x - this.gesture.x;
    const dy = this.pendingPoint.y - this.gesture.y;
    this.pendingPoint = null;
    if (this.element === "camera") this.moveCamera(dx, dy);
    if (this.element === "overlay") this.moveOverlay(dx, dy);
    if (this.element === "name") {
      const { layout, localContext } = this.gesture;
      const initial = lengthPixels(layout.nameStyle?.offset, "height", localContext);
      this.edit(["nameStyle", "offset"], pixelsLength(initial + (layout.nameStyle?.position === "top" ? dy : -dy), layout.nameStyle?.offset, "height", localContext));
    }
    this.session.edit(["profile", "enabled"], true);
    this.onUpdate();
    this.drawRects();
  }

  edit(path, value) {
    if (value !== null) this.session.edit(["profile", "layouts", this.userId, ...path], value);
  }

  moveCamera(dx, dy) {
    const { layout, rect, action, context } = this.gesture;
    let left = lengthPixels(layout.left, "width", context, this.view.offsetLeft ?? rect.left);
    let top = lengthPixels(layout.top, "height", context, this.view.offsetTop ?? rect.top);
    let width = lengthPixels(layout.width, "width", context, rect.width);
    let height = lengthPixels(layout.height, "height", context, rect.height);
    if (action === "move") {
      const snapped = this.snap ? this.snapPosition(rect.left + dx, rect.top + dy, rect) : { x: rect.left + dx, y: rect.top + dy };
      left += snapped.x - rect.left;
      top += snapped.y - rect.top;
    } else {
      const relative = inferLayoutMode(layout) === "relative";
      const oldWidth = width;
      const oldHeight = height;
      if (action.includes("e")) width = Math.max(32, width + dx);
      if (action.includes("s")) height = Math.max(24, height + dy);
      if (action.includes("w")) width = Math.max(32, width - dx);
      if (action.includes("n")) height = Math.max(24, height - dy);
      if (this.lockRatio) {
        if (/[ew]/.test(action)) height = width * oldHeight / oldWidth;
        else width = height * oldWidth / oldHeight;
      }
      if (!relative && action.includes("w")) left += oldWidth - width;
      if (!relative && action.includes("n")) top += oldHeight - height;
    }
    if (inferLayoutMode(layout) !== "relative") {
      this.edit(["left"], pixelsLength(left, layout.left, "width", context));
      this.edit(["top"], pixelsLength(top, layout.top, "height", context));
    }
    if (action !== "move") {
      this.edit(["width"], pixelsLength(width, layout.width, "width", context));
      this.edit(["height"], pixelsLength(height, layout.height, "height", context));
    }
  }

  snapPosition(x, y, rect) {
    const win = this.view.ownerDocument.defaultView;
    const xs = [0, win.innerWidth / 2, win.innerWidth];
    const ys = [0, win.innerHeight / 2, win.innerHeight];
    for (const view of this.view.ownerDocument.querySelectorAll(".camera-view")) {
      if (view === this.view || !view.getClientRects().length) continue;
      const other = view.getBoundingClientRect();
      xs.push(other.left, other.left + other.width / 2, other.right);
      ys.push(other.top, other.top + other.height / 2, other.bottom);
    }
    const horizontal = snapCoordinate(x, rect.width, xs);
    const vertical = snapCoordinate(y, rect.height, ys);
    this.drawGuide("x", horizontal.guide);
    this.drawGuide("y", vertical.guide);
    return { x: horizontal.value, y: vertical.value };
  }

  drawGuide(axis, value) {
    let guide = this.nodes[0]?.querySelector(`[data-guide="${axis}"]`);
    if (!guide) {
      guide = this.view.ownerDocument.createElement("span");
      guide.dataset.guide = axis;
      guide.className = `charlemos-guide charlemos-guide-${axis}`;
      this.nodes[0]?.appendChild(guide);
    }
    guide.hidden = value === null;
    guide.style[axis === "x" ? "left" : "top"] = `${value ?? 0}px`;
  }

  moveOverlay(dx, dy) {
    const { layout, action, rect, localContext } = this.gesture;
    const overlay = layout.overlay ?? {};
    if (action === "move") {
      for (const [axis, delta, dimension] of [["x", dx, "width"], ["y", dy, "height"]]) {
        const initial = lengthPixels(overlay.offset?.[axis], dimension, localContext);
        this.edit(["overlay", "offset", axis], pixelsLength(initial + delta, overlay.offset?.[axis], dimension, localContext));
      }
    }
    if (action === "scale") this.edit(["overlay", "scale"], Math.max(0.01, (overlay.scale ?? 1) * (1 + dx / Math.max(1, rect.width))));
    if (action === "rotate") this.edit(["overlay", "rotate"], (overlay.rotate ?? 0) + dx * 0.5);
    if (action.startsWith("bounds-")) {
      const side = action.slice(7);
      const delta = { top: -dy / rect.height, bottom: dy / rect.height, left: -dx / rect.width, right: dx / rect.width }[side] * 100;
      this.edit(["overlay", "bounds", "mode"], "expanded");
      this.edit(["overlay", "bounds", side], Math.min(500, Math.max(0, (overlay.bounds?.[side] ?? 0) + delta)));
    }
  }

  finish(cancel) {
    if (!this.gesture) return;
    const { handle, pointerId } = this.gesture;
    if (this.frame !== undefined) this.view.ownerDocument.defaultView.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    if (!cancel) this.applyPoint();
    handle.removeEventListener("pointermove", this.moveListener);
    handle.removeEventListener("pointerup", this.upListener);
    handle.removeEventListener("pointercancel", this.cancelListener);
    handle.removeEventListener("lostpointercapture", this.lostPointerListener);
    this.view.ownerDocument.removeEventListener("keydown", this.keyListener, true);
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    this.session.endGesture(cancel);
    this.gesture = null;
    this.pendingPoint = null;
    this.onUpdate();
    this.onCommit();
  }

  clearNodes() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const node of this.nodes) node.remove();
    this.nodes = [];
  }

  destroy() {
    const commit = this.onCommit;
    this.onCommit = () => {};
    this.finish(false);
    this.onCommit = commit;
    this.clearNodes();
  }

  suspend() {
    this.destroy();
  }
}
