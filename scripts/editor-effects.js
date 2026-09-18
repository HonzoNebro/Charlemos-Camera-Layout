export const BASIC_EFFECTS = {
  rotate: { kind: "transform", unit: "deg", min: -180, max: 180, step: 1, default: 0 },
  scale: { kind: "transform", unit: "", min: 0.1, max: 4, step: 0.01, default: 1 },
  translateX: { kind: "transform", unit: "px", min: -500, max: 500, step: 1, default: 0 },
  translateY: { kind: "transform", unit: "px", min: -500, max: 500, step: 1, default: 0 },
  brightness: { kind: "filter", unit: "", min: 0, max: 3, step: 0.01, default: 1 },
  contrast: { kind: "filter", unit: "", min: 0, max: 3, step: 0.01, default: 1 },
  saturate: { kind: "filter", unit: "", min: 0, max: 3, step: 0.01, default: 1 },
  blur: { kind: "filter", unit: "px", min: 0, max: 30, step: 0.1, default: 0 }
};

export function parseBasicEffects(css, kind) {
  const text = String(css ?? "").trim();
  if (!text || text === "none") return [];
  const tokens = [...text.matchAll(/([a-zA-Z]+)\((-?(?:\d+(?:\.\d*)?|\.\d+))(px|deg)?\)/g)];
  if (tokens.map((match) => match[0]).join(" ") !== text.replace(/\s+/g, " ")) return null;
  const seen = new Set();
  for (const match of tokens) {
    const definition = BASIC_EFFECTS[match[1]];
    if (!definition || definition.kind !== kind || definition.unit !== (match[3] ?? "") || seen.has(match[1])) return null;
    seen.add(match[1]);
  }
  return tokens.map((match) => ({ id: match[1], value: Number(match[2]), text: match[0] }));
}

export function updateBasicEffect(css, id, value) {
  const definition = BASIC_EFFECTS[id];
  if (!definition) return null;
  const tokens = parseBasicEffects(css, definition.kind);
  if (!tokens) return null;
  const number = Number(value);
  if (value !== null && (!Number.isFinite(number) || number < definition.min || number > definition.max)) return null;
  const index = tokens.findIndex((token) => token.id === id);
  if (value === null) return tokens.filter((token) => token.id !== id).map((token) => token.text).join(" ");
  const text = `${id}(${number}${definition.unit})`;
  if (index < 0) tokens.push({ id, text });
  else tokens[index].text = text;
  return tokens.map((token) => token.text).join(" ");
}
