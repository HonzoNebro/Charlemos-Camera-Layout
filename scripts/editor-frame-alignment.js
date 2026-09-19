import { expandedOverlayBounds } from "./overlay-bounds.js";
import { simpleLength } from "./editor-fields.js";
import { pixelsLength } from "./visual-camera-editor.js";

export const FRAME_ALIGNMENTS = ["left", "center", "right", "top", "middle", "bottom"];

export function alignedFrameOffset(overlay, alignment, context) {
  if (!FRAME_ALIGNMENTS.includes(alignment)) return null;
  const { width, height } = context;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const axis = ["left", "center", "right"].includes(alignment) ? "x" : "y";
  const dimension = axis === "x" ? "width" : "height";
  const original = overlay?.offset?.[axis];
  if (original && !simpleLength(original)) return null;
  const bounds = expandedOverlayBounds(overlay) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const w = width * (1 + (bounds.left + bounds.right) / 100);
  const h = height * (1 + (bounds.top + bounds.bottom) / 100);
  const scale = Number(overlay?.scale ?? 1);
  const angle = Number(overlay?.rotate ?? 0) * Math.PI / 180;
  if (!Number.isFinite(scale) || scale < 0.01 || scale > 100 || !Number.isFinite(angle)) return null;
  const extent = scale * (axis === "x" ? Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle)) : Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle)));
  const center = axis === "x" ? w / 2 - width * bounds.left / 100 : h / 2 - height * bounds.top / 100;
  const target = ["left", "top"].includes(alignment) ? extent / 2 : ["right", "bottom"].includes(alignment) ? context[dimension] - extent / 2 : context[dimension] / 2;
  const value = pixelsLength(target - center, original, dimension, { ...context, width: w, height: h });
  return value === null ? null : { axis, value };
}

export function applyFrameAlignment(session, userId, alignment, context) {
  if (!session || session.busy || !userId) return false;
  const overlay = session.draft.profile.layouts?.[userId]?.overlay;
  const result = alignedFrameOffset(overlay, alignment, context);
  if (!result) return false;
  session.beginGesture();
  session.edit(["profile", "layouts", userId, "overlay", "offset", result.axis], result.value);
  session.edit(["profile", "enabled"], true);
  session.endGesture();
  session.preview = true;
  return true;
}
