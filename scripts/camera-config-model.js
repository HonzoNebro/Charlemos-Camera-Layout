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

function positionFrom(layout) {
  return nullableText(layout?.position) ?? "absolute";
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

function snapEnabledFrom(layout) {
  return Boolean(layout?.snap?.enabled);
}

function snapSizeFrom(layout) {
  return layout?.snap?.size ?? 10;
}

function nameSourceFrom(layout) {
  return nullableText(layout?.nameStyle?.source) ?? "user";
}

function nameColorFromUser(layout) {
  return Boolean(layout?.nameStyle?.colorFromUser);
}

function resizeAspectFrom(layout) {
  return nullableText(layout?.resize?.aspectMode) ?? "free";
}

function cropValue(layout, side) {
  return nullableText(layout?.crop?.[side]) ?? "";
}

export function buildFormData(layout) {
  return {
    preset: nullableText(layout?.preset) ?? "manual",
    snapEnabled: snapEnabledFrom(layout),
    snapSize: snapSizeFrom(layout),
    resizeAspect: resizeAspectFrom(layout),
    position: positionFrom(layout),
    top: nullableText(layout?.top) ?? "",
    left: nullableText(layout?.left) ?? "",
    width: nullableText(layout?.width) ?? "",
    height: nullableText(layout?.height) ?? "",
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
    geometryBorderRadius: nullableText(layout?.geometry?.borderRadius) ?? "",
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
    position: nullableText(formData.namePosition)
  };
}

function buildGeometryPayload(formData) {
  return {
    borderRadius: nullableCss(formData.geometryBorderRadius)
  };
}

export function buildLayoutPatch(formData) {
  return {
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
