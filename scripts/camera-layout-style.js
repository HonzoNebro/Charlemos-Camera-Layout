function numeric(value, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cssLength(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  return text;
}

function parseHexColor(color) {
  const text = String(color ?? "").trim();
  if (/^#[\da-fA-F]{6}$/.test(text)) {
    return {
      r: Number.parseInt(text.slice(1, 3), 16),
      g: Number.parseInt(text.slice(3, 5), 16),
      b: Number.parseInt(text.slice(5, 7), 16)
    };
  }
  if (/^#[\da-fA-F]{3}$/.test(text)) {
    return {
      r: Number.parseInt(text[1] + text[1], 16),
      g: Number.parseInt(text[2] + text[2], 16),
      b: Number.parseInt(text[3] + text[3], 16)
    };
  }
  return null;
}

function overlayTint(layout) {
  if (!layout?.overlay?.tint?.enabled) return "";
  const channels = parseHexColor(layout?.overlay?.tint?.color);
  if (!channels) return "";
  const opacity = clamp(numeric(layout?.overlay?.tint?.opacity, 0), 0, 1);
  if (opacity <= 0) return "";
  return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${opacity})`;
}

function overlayTransform(layout) {
  const x = cssLength(layout?.overlay?.offset?.x, "0px");
  const y = cssLength(layout?.overlay?.offset?.y, "0px");
  const scale = clamp(numeric(layout?.overlay?.scale, 1), 0.01, 100);
  const rotate = numeric(layout?.overlay?.rotate, 0);
  if (x === "0px" && y === "0px" && scale === 1 && rotate === 0) return "";
  return `translate(${x}, ${y}) scale(${scale}) rotate(${rotate}deg)`;
}

function overlayMixBlendMode(imageUrl) {
  const text = String(imageUrl ?? "").toLowerCase();
  if (!text) return "normal";
  if (text.includes("/frame") || text.includes("/frames/")) return "screen";
  return "normal";
}

function overlayPathExtension(imageUrl) {
  const text = String(imageUrl ?? "").trim().toLowerCase();
  if (!text) return "";
  const clean = text.split(/[?#]/, 1)[0];
  const match = clean.match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
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

function anchorToBackgroundPosition(anchor) {
  if (anchor === "top") return "center top";
  if (anchor === "bottom") return "center bottom";
  if (anchor === "left") return "left center";
  if (anchor === "right") return "right center";
  if (anchor === "top-left") return "left top";
  if (anchor === "top-right") return "right top";
  if (anchor === "bottom-left") return "left bottom";
  if (anchor === "bottom-right") return "right bottom";
  return "center center";
}

function overlayObjectFit(layout, imageUrl) {
  const fitMode = normalizedOverlayFitMode(layout?.overlay?.fitMode);
  if (fitMode === "cover") return "cover";
  if (fitMode === "contain") return "contain";
  if (fitMode === "fill") return "fill";
  const text = String(imageUrl ?? "").toLowerCase();
  if (!text) return "cover";
  if (text.includes("/frame") || text.includes("/frames/")) return "fill";
  return "cover";
}

function overlayObjectPosition(layout) {
  return anchorToBackgroundPosition(normalizedOverlayAnchor(layout?.overlay?.anchor));
}

const ALTERNATE_NAME_INTERVAL_MS = 4000;
const NAME_TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);
const NAME_FONT_WEIGHT_VALUES = new Set(["400", "500", "600", "700"]);
const NAME_FONT_STYLE_VALUES = new Set(["normal", "italic"]);

function alternateName(userName, characterName, nowMs) {
  const period = Math.floor(nowMs / ALTERNATE_NAME_INTERVAL_MS) % 2;
  return period === 0 ? userName : characterName;
}

function resolvedName(layout, context) {
  const source = layout?.nameStyle?.source ?? "user";
  const userName = context?.userName ?? "";
  const characterName = context?.characterName ?? userName;
  if (source === "custom") return layout?.nameStyle?.text ?? userName;
  if (source === "character") return characterName;
  if (source === "alternate") return alternateName(userName, characterName, context?.nowMs ?? Date.now());
  return userName;
}

function resolvedColor(layout, context) {
  const fromUser = Boolean(layout?.nameStyle?.colorFromUser);
  if (fromUser) return context?.userColor ?? layout?.nameStyle?.color ?? "";
  return layout?.nameStyle?.color ?? "";
}

function resolvedTextAlign(layout) {
  const value = String(layout?.nameStyle?.textAlign ?? "").trim();
  if (!value) return "center";
  if (!NAME_TEXT_ALIGN_VALUES.has(value)) return "center";
  return value;
}

function resolvedFontWeight(layout) {
  const value = String(layout?.nameStyle?.fontWeight ?? "").trim();
  if (!value) return "600";
  if (!NAME_FONT_WEIGHT_VALUES.has(value)) return "600";
  return value;
}

function resolvedFontStyle(layout) {
  const value = String(layout?.nameStyle?.fontStyle ?? "").trim();
  if (!value) return "normal";
  if (!NAME_FONT_STYLE_VALUES.has(value)) return "normal";
  return value;
}

export function composeTransform(baseTransform, geometry) {
  const skewX = numeric(geometry?.skewX, 0);
  const skewY = numeric(geometry?.skewY, 0);
  const hasSkew = skewX !== 0 || skewY !== 0;
  const base = String(baseTransform ?? "").trim();
  if (!hasSkew) return base;
  const skew = `skew(${skewX}deg, ${skewY}deg)`;
  if (!base) return skew;
  return `${base} ${skew}`.trim();
}

export function overlayMediaKind(imageUrl) {
  const extension = overlayPathExtension(imageUrl);
  if (["webm", "mp4", "m4v", "mov", "ogv", "ogg"].includes(extension)) return "video";
  return "image";
}

export function overlayStyle(layout) {
  const enabled = Boolean(layout?.overlay?.enabled);
  if (!enabled) {
    return {
      display: "none",
      backgroundImage: "",
      backgroundBlendMode: "normal",
      mixBlendMode: "normal",
      opacity: "1",
      transform: "",
      transformOrigin: "center",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundRepeat: ""
    };
  }
  const image = layout?.overlay?.imageUrl;
  const opacityValue = numeric(layout?.overlay?.opacity, 1);
  return {
    display: "block",
    backgroundImage: "",
    backgroundSize: "",
    backgroundPosition: "",
    backgroundRepeat: "",
    backgroundBlendMode: "normal",
    mixBlendMode: overlayMixBlendMode(image),
    opacity: String(clamp(opacityValue, 0, 1)),
    transform: overlayTransform(layout),
    transformOrigin: "center"
  };
}

export function overlayMediaStyle(layout) {
  return {
    display: String(layout?.overlay?.imageUrl ?? "").trim() ? "block" : "none",
    objectFit: overlayObjectFit(layout, layout?.overlay?.imageUrl),
    objectPosition: overlayObjectPosition(layout)
  };
}

export function overlayTintStyle(layout) {
  const tint = overlayTint(layout);
  if (!tint) {
    return {
      display: "none",
      backgroundColor: "",
      mixBlendMode: "normal"
    };
  }
  return {
    display: "block",
    backgroundColor: tint,
    mixBlendMode: layout?.overlay?.tint?.blendMode ?? "normal"
  };
}

export function nameStyle(layout, context = {}) {
  const visible = layout?.nameStyle?.visible !== false;
  const position = layout?.nameStyle?.position === "top" ? "top" : "bottom";
  return {
    display: visible ? "block" : "none",
    color: resolvedColor(layout, context),
    fontFamily: layout?.nameStyle?.fontFamily ?? "",
    textAlign: resolvedTextAlign(layout),
    fontWeight: resolvedFontWeight(layout),
    fontStyle: resolvedFontStyle(layout),
    text: resolvedName(layout, context),
    position
  };
}
