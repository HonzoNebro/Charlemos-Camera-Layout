const EFFECTS = {
  transform: [
    { id: "rotate", value: "rotate(2deg)" },
    { id: "scale", value: "scale(1.05)" },
    { id: "translateX", value: "translateX(12px)" },
    { id: "translateY", value: "translateY(12px)" },
    { id: "skewX", value: "skewX(5deg)" },
    { id: "skewY", value: "skewY(5deg)" }
  ],
  filter: [
    { id: "grayscale", value: "grayscale(0.4)" },
    { id: "contrast", value: "contrast(1.2)" },
    { id: "brightness", value: "brightness(1.1)" },
    { id: "blur", value: "blur(1px)" },
    { id: "sepia", value: "sepia(0.2)" },
    { id: "saturate", value: "saturate(1.3)" }
  ],
  clipPath: [
    { id: "circle", value: "circle(45%)" },
    { id: "ellipse", value: "ellipse(40% 30%)" },
    { id: "inset", value: "inset(8% round 10px)" },
    { id: "polygon", value: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }
  ]
};

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function findEffect(kind, effectId) {
  return (EFFECTS[kind] ?? []).find((item) => item.id === effectId) ?? null;
}

export function effectCatalog(kind) {
  return EFFECTS[kind] ?? [];
}

export function effectDefaultValue(kind, effectId) {
  return findEffect(kind, effectId)?.value ?? "";
}

export function usedEffectIds(value) {
  const matches = normalizeValue(value).match(/([a-zA-Z][a-zA-Z0-9-]*)\s*\(/g) ?? [];
  return matches.map((item) => item.replace("(", "").trim());
}

export function availableEffectItems(kind, value) {
  const used = new Set(usedEffectIds(value));
  return effectCatalog(kind).filter((item) => !used.has(item.id));
}

function joinTokens(tokens) {
  return tokens.filter((token) => token && token.trim().length > 0).join(" ").trim();
}

export function addEffect(kind, value, effectId) {
  const current = normalizeValue(value);
  const defaultValue = effectDefaultValue(kind, effectId);
  if (!defaultValue) return current;
  if (kind === "clipPath") return defaultValue;
  const used = new Set(usedEffectIds(current));
  if (used.has(effectId)) return current;
  return joinTokens([current, defaultValue]);
}

export function removeEffect(kind, value, effectId) {
  const current = normalizeValue(value);
  if (!current) return "";
  if (kind === "clipPath") return "";
  const pattern = new RegExp(`${effectId}\\s*\\([^)]*\\)`, "g");
  return joinTokens(current.replace(pattern, " ").split(/\s+/));
}
