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

function overlayBackgroundSize(imageUrl) {
  const text = String(imageUrl ?? "").toLowerCase();
  if (!text) return "cover";
  if (text.includes("/frame") || text.includes("/frames/")) return "100% 100%";
  return "cover";
}

const ALTERNATE_NAME_INTERVAL_MS = 4000;

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
      transformOrigin: "center"
    };
  }
  const image = layout?.overlay?.imageUrl;
  const opacityValue = numeric(layout?.overlay?.opacity, 1);
  const tint = overlayTint(layout);
  const layers = [];
  if (tint) layers.push(`linear-gradient(${tint}, ${tint})`);
  if (image) layers.push(`url("${image}")`);
  return {
    display: "block",
    backgroundImage: layers.join(", "),
    backgroundSize: overlayBackgroundSize(image),
    backgroundBlendMode: layout?.overlay?.tint?.blendMode ?? "normal",
    mixBlendMode: overlayMixBlendMode(image),
    opacity: String(clamp(opacityValue, 0, 1)),
    transform: overlayTransform(layout),
    transformOrigin: "center"
  };
}

export function nameStyle(layout, context = {}) {
  const visible = layout?.nameStyle?.visible !== false;
  const top = layout?.nameStyle?.position === "top" ? "0.25rem" : "";
  const bottom = layout?.nameStyle?.position === "top" ? "" : "0.25rem";
  return {
    display: visible ? "block" : "none",
    color: resolvedColor(layout, context),
    fontFamily: layout?.nameStyle?.fontFamily ?? "",
    text: resolvedName(layout, context),
    top,
    bottom
  };
}
