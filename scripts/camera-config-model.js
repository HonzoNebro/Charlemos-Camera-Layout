function parseFloatNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function nullableText(value) {
  if (value === "" || value === null || value === undefined) return null;
  return value;
}

function nullableCss(value) {
  const text = nullableText(value);
  if (text === null) return null;
  return text.trim();
}

function normalizeLayoutLength(value) {
  const text = nullableCss(value);
  if (text === null) return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return `${text}px`;
  return text;
}

function visibleFrom(layout) {
  return layout?.nameStyle?.visible !== false;
}

function overlayEnabledFrom(layout) {
  return Boolean(layout?.overlay?.enabled);
}

function overlayOffsetValue(layout, axis) {
  return nullableText(layout?.overlay?.offset?.[axis]) ?? "";
}

function overlayScaleFrom(layout) {
  return parseFloatNumber(layout?.overlay?.scale) ?? 1;
}

function overlayRotateFrom(layout) {
  return parseFloatNumber(layout?.overlay?.rotate) ?? 0;
}

function overlayTintEnabledFrom(layout) {
  return Boolean(layout?.overlay?.tint?.enabled);
}

function overlayTintColorFrom(layout) {
  return nullableText(layout?.overlay?.tint?.color) ?? "#000000";
}

function overlayTintOpacityFrom(layout) {
  return parseFloatNumber(layout?.overlay?.tint?.opacity) ?? 0;
}

function overlayTintBlendModeFrom(layout) {
  return nullableText(layout?.overlay?.tint?.blendMode) ?? "normal";
}

const OVERLAY_FIT_MODE_VALUES = new Set(["auto", "cover", "contain", "fill"]);
const OVERLAY_ANCHOR_VALUES = new Set([
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
]);

function normalizedOverlayFitMode(value) {
  const text = String(value ?? "").trim();
  if (!text) return "auto";
  if (OVERLAY_FIT_MODE_VALUES.has(text)) return text;
  return "auto";
}

function normalizedOverlayAnchor(value) {
  const text = String(value ?? "").trim();
  if (!text) return "center";
  if (OVERLAY_ANCHOR_VALUES.has(text)) return text;
  return "center";
}

function nameSourceFrom(layout) {
  return nullableText(layout?.nameStyle?.source) ?? "user";
}

function nameColorFromUser(layout) {
  return Boolean(layout?.nameStyle?.colorFromUser);
}

const NAME_TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);
const NAME_FONT_WEIGHT_VALUES = new Set(["400", "500", "600", "700"]);
const NAME_FONT_STYLE_VALUES = new Set(["normal", "italic"]);
const LAYOUT_MODE_VALUES = new Set(["absolute", "relative"]);
const RELATIVE_PLACEMENT_VALUES = new Set([
  "none",
  "above",
  "below",
  "left-of",
  "right-of",
  "above-left",
  "above-center",
  "above-right",
  "below-left",
  "below-center",
  "below-right",
  "left-top",
  "left-center",
  "left-bottom",
  "right-top",
  "right-center",
  "right-bottom"
]);

function normalizedNameTextAlign(value) {
  const text = nullableText(value);
  if (!text) return "center";
  if (NAME_TEXT_ALIGN_VALUES.has(text)) return text;
  return "center";
}

function normalizedNameFontWeight(value) {
  const text = String(value ?? "").trim();
  if (!text) return "600";
  if (NAME_FONT_WEIGHT_VALUES.has(text)) return text;
  return "600";
}

function normalizedNameFontStyle(value) {
  const text = nullableText(value);
  if (!text) return "normal";
  if (NAME_FONT_STYLE_VALUES.has(text)) return text;
  return "normal";
}

export function normalizedLayoutMode(value) {
  const text = String(value ?? "").trim();
  if (!text) return "absolute";
  if (LAYOUT_MODE_VALUES.has(text)) return text;
  return "absolute";
}

function cropValue(layout, side) {
  return nullableText(layout?.crop?.[side]) ?? "";
}

function relativeTargetFrom(layout) {
  return nullableText(layout?.relative?.targetUserId) ?? "";
}

function cycleDetectedFrom(startUserId, layoutsByUserId) {
  const visited = new Set();
  let currentUserId = startUserId;
  while (currentUserId) {
    if (visited.has(currentUserId)) return true;
    visited.add(currentUserId);
    const layout = layoutsByUserId?.[currentUserId];
    if (inferLayoutMode(layout) !== "relative") return false;
    const targetUserId = relativeTargetFrom(layout);
    if (!targetUserId) return false;
    currentUserId = targetUserId;
  }
  return false;
}

export function inferLayoutMode(layout) {
  const explicit = normalizedLayoutMode(layout?.layoutMode);
  if (layout?.layoutMode) return explicit;
  const legacyPosition = String(layout?.position ?? "").trim();
  if (legacyPosition === "relative") return "relative";
  if (relativeTargetFrom(layout)) return "relative";
  return "absolute";
}

function normalizedRelativePlacement(value) {
  const text = String(value ?? "").trim();
  if (!text) return "none";
  if (RELATIVE_PLACEMENT_VALUES.has(text)) return text;
  return "none";
}

export function validateLayoutFormData(selectedUserId, formData, layoutsByUserId = {}, users = []) {
  const errors = [];
  const warnings = [];
  if (normalizedLayoutMode(formData?.layoutMode) !== "relative") return { errors, warnings };

  const targetUserId = nullableText(formData?.relativeTargetUserId);
  const placement = normalizedRelativePlacement(formData?.relativePlacement);
  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  if (!targetUserId) errors.push("relativeTargetRequired");
  if (targetUserId && selectedUserId && targetUserId === selectedUserId) errors.push("relativeTargetSelf");
  if (placement === "none") errors.push("relativePlacementRequired");
  if (targetUserId && !usersById.has(targetUserId)) warnings.push("relativeTargetMissing");
  if (targetUserId && usersById.get(targetUserId)?.active === false) warnings.push("relativeTargetOffline");

  if (selectedUserId && targetUserId && targetUserId !== selectedUserId) {
    const nextLayouts = {
      ...(layoutsByUserId ?? {}),
      [selectedUserId]: {
        ...((layoutsByUserId ?? {})[selectedUserId] ?? {}),
        ...buildLayoutPatch(formData)
      }
    };
    if (cycleDetectedFrom(selectedUserId, nextLayouts)) errors.push("relativeCycle");
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)]
  };
}

export function buildFormData(layout) {
  return {
    layoutMode: inferLayoutMode(layout),
    top: nullableText(layout?.top) ?? "",
    left: nullableText(layout?.left) ?? "",
    width: nullableText(layout?.width) ?? "",
    height: nullableText(layout?.height) ?? "",
    relativeTargetUserId: relativeTargetFrom(layout),
    relativePlacement: normalizedRelativePlacement(layout?.relative?.placement),
    relativeGap: nullableText(layout?.relative?.gap) ?? "",
    cropTop: cropValue(layout, "top"),
    cropRight: cropValue(layout, "right"),
    cropBottom: cropValue(layout, "bottom"),
    cropLeft: cropValue(layout, "left"),
    transform: nullableText(layout?.transform) ?? "",
    filter: nullableText(layout?.filter) ?? "",
    clipPath: nullableText(layout?.clipPath) ?? "",
    overlayEnabled: overlayEnabledFrom(layout),
    overlayImage: nullableText(layout?.overlay?.imageUrl) ?? "",
    overlayOpacity: layout?.overlay?.opacity ?? 1,
    overlayOffsetX: overlayOffsetValue(layout, "x"),
    overlayOffsetY: overlayOffsetValue(layout, "y"),
    overlayScale: overlayScaleFrom(layout),
    overlayRotate: overlayRotateFrom(layout),
    overlayFitMode: normalizedOverlayFitMode(layout?.overlay?.fitMode),
    overlayAnchor: normalizedOverlayAnchor(layout?.overlay?.anchor),
    overlayTintEnabled: overlayTintEnabledFrom(layout),
    overlayTintColor: overlayTintColorFrom(layout),
    overlayTintOpacity: overlayTintOpacityFrom(layout),
    overlayTintBlendMode: overlayTintBlendModeFrom(layout),
    nameVisible: visibleFrom(layout),
    nameSource: nameSourceFrom(layout),
    nameText: nullableText(layout?.nameStyle?.text) ?? "",
    nameColorFromUser: nameColorFromUser(layout),
    nameColor: nullableText(layout?.nameStyle?.color) ?? "#ffffff",
    nameFont: nullableText(layout?.nameStyle?.fontFamily) ?? "",
    namePosition: nullableText(layout?.nameStyle?.position) ?? "bottom",
    nameTextAlign: normalizedNameTextAlign(layout?.nameStyle?.textAlign),
    nameFontWeight: normalizedNameFontWeight(layout?.nameStyle?.fontWeight),
    nameFontStyle: normalizedNameFontStyle(layout?.nameStyle?.fontStyle),
    geometryBorderRadius: nullableText(layout?.geometry?.borderRadius) ?? "",
    geometryTransparentFrame: Boolean(layout?.geometry?.transparentFrame),
    geometrySkewX: layout?.geometry?.skewX ?? 0,
    geometrySkewY: layout?.geometry?.skewY ?? 0
  };
}

function buildOverlayPayload(formData) {
  return {
    enabled: Boolean(formData.overlayEnabled),
    imageUrl: nullableText(formData.overlayImage),
    opacity: parseFloatNumber(formData.overlayOpacity) ?? 1,
    offset: {
      x: normalizeLayoutLength(formData.overlayOffsetX),
      y: normalizeLayoutLength(formData.overlayOffsetY)
    },
    scale: parseFloatNumber(formData.overlayScale) ?? 1,
    rotate: parseFloatNumber(formData.overlayRotate) ?? 0,
    fitMode: normalizedOverlayFitMode(formData.overlayFitMode),
    anchor: normalizedOverlayAnchor(formData.overlayAnchor),
    tint: {
      enabled: Boolean(formData.overlayTintEnabled),
      color: nullableText(formData.overlayTintColor) ?? "#000000",
      opacity: parseFloatNumber(formData.overlayTintOpacity) ?? 0,
      blendMode: nullableText(formData.overlayTintBlendMode) ?? "normal"
    }
  };
}

function buildNameStylePayload(formData) {
  return {
    visible: Boolean(formData.nameVisible),
    source: nullableText(formData.nameSource) ?? "user",
    text: nullableText(formData.nameText),
    colorFromUser: Boolean(formData.nameColorFromUser),
    color: nullableText(formData.nameColor),
    fontFamily: nullableText(formData.nameFont),
    position: nullableText(formData.namePosition) ?? "bottom",
    textAlign: normalizedNameTextAlign(formData.nameTextAlign),
    fontWeight: normalizedNameFontWeight(formData.nameFontWeight),
    fontStyle: normalizedNameFontStyle(formData.nameFontStyle)
  };
}

function buildGeometryPayload(formData) {
  return {
    borderRadius: normalizeLayoutLength(formData.geometryBorderRadius),
    transparentFrame: Boolean(formData.geometryTransparentFrame)
  };
}

function buildRelativePayload(formData) {
  const layoutMode = normalizedLayoutMode(formData.layoutMode);
  const placement = normalizedRelativePlacement(formData.relativePlacement);
  const targetUserId = nullableText(formData.relativeTargetUserId);
  if (layoutMode !== "relative") {
    return {
      targetUserId: null,
      placement: "none",
      gap: null
    };
  }
  return {
    targetUserId,
    placement,
    gap: normalizeLayoutLength(formData.relativeGap)
  };
}

export function buildLayoutPatch(formData) {
  const layoutMode = normalizedLayoutMode(formData.layoutMode);
  return {
    layoutMode,
    position: "absolute",
    top: normalizeLayoutLength(formData.top),
    left: normalizeLayoutLength(formData.left),
    width: normalizeLayoutLength(formData.width),
    height: normalizeLayoutLength(formData.height),
    relative: buildRelativePayload(formData),
    crop: {
      top: normalizeLayoutLength(formData.cropTop),
      right: normalizeLayoutLength(formData.cropRight),
      bottom: normalizeLayoutLength(formData.cropBottom),
      left: normalizeLayoutLength(formData.cropLeft)
    },
    transform: nullableText(formData.transform),
    filter: nullableText(formData.filter),
    clipPath: nullableCss(formData.clipPath),
    overlay: buildOverlayPayload(formData),
    nameStyle: buildNameStylePayload(formData),
    geometry: buildGeometryPayload(formData)
  };
}

export function buildNameStylePatch(formData) {
  return {
    nameStyle: buildNameStylePayload(formData)
  };
}
