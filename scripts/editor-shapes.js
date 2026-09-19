export const SHAPE_FIELDS = {
  circle: { radius: [0, 100, 45, "%"], x: [0, 100, 50, "%"], y: [0, 100, 50, "%"] },
  ellipse: { rx: [0, 100, 40, "%"], ry: [0, 100, 30, "%"], x: [0, 100, 50, "%"], y: [0, 100, 50, "%"] },
  inset: { top: [0, 100, 0, "%"], right: [0, 100, 0, "%"], bottom: [0, 100, 0, "%"], left: [0, 100, 0, "%"], round: [0, 500, 0, "px"] },
  polygon: {
    x1: [0, 100, 50, "%"], y1: [0, 100, 0, "%"], x2: [0, 100, 100, "%"], y2: [0, 100, 50, "%"],
    x3: [0, 100, 50, "%"], y3: [0, 100, 100, "%"], x4: [0, 100, 0, "%"], y4: [0, 100, 50, "%"]
  }
};

const number = "(\\d+(?:\\.\\d+)?|\\.\\d+)";

export function parseGuidedShape(css) {
  const value = String(css ?? "").trim();
  for (const kind of ["circle", "ellipse"]) {
    const radii = kind === "circle" ? `${number}%` : `${number}%\\s+${number}%`;
    const match = value.match(new RegExp(`^${kind}\\(${radii}(?:\\s+at\\s+${number}%\\s+${number}%)?\\)$`));
    if (!match) continue;
    const fields = kind === "circle" ? ["radius", "x", "y"] : ["rx", "ry", "x", "y"];
    const values = Object.fromEntries(fields.map((field, index) => [field, match[index + 1] === undefined ? 50 : Number(match[index + 1])]));
    return guidedShapeCss(kind, values) ? { kind, values } : null;
  }
  const match = value.match(/^inset\(([^()]+)% round (\d+(?:\.\d+)?|\.\d+)px\)$/);
  if (match) {
    const tokens = `${match[1]}%`.split(/\s+/);
    if (tokens.length > 4 || !tokens.every((token) => /^\d*\.?\d+%$/.test(token))) return null;
    const parts = tokens.map((token) => Number(token.slice(0, -1)));
    const [top, right = top, bottom = top, left = right] = parts;
    const values = { top, right, bottom, left, round: Number(match[2]) };
    return guidedShapeCss("inset", values) ? { kind: "inset", values } : null;
  }
  const polygon = value.match(new RegExp(`^polygon\\(\\s*${number}%\\s+${number}%\\s*,\\s*${number}%\\s+${number}%\\s*,\\s*${number}%\\s+${number}%\\s*,\\s*${number}%\\s+${number}%\\s*\\)$`));
  if (!polygon) return null;
  const polygonValues = Object.fromEntries(["x1", "y1", "x2", "y2", "x3", "y3", "x4", "y4"].map((field, index) => [field, Number(polygon[index + 1])]));
  return guidedShapeCss("polygon", polygonValues) ? { kind: "polygon", values: polygonValues } : null;
}

export function guidedShapeCss(kind, values) {
  const fields = Object.hasOwn(SHAPE_FIELDS, kind) ? SHAPE_FIELDS[kind] : null;
  if (!fields || Object.entries(fields).some(([key, [min, max]]) => !Number.isFinite(values[key]) || values[key] < min || values[key] > max)) return null;
  const v = Object.fromEntries(Object.keys(fields).map((key) => [key, Math.round(values[key] * 1000) / 1000]));
  if (kind === "circle") return `circle(${v.radius}% at ${v.x}% ${v.y}%)`;
  if (kind === "ellipse") return `ellipse(${v.rx}% ${v.ry}% at ${v.x}% ${v.y}%)`;
  if (v.top + v.bottom > 100 || v.left + v.right > 100) return null;
  if (kind === "inset") return `inset(${v.top}% ${v.right}% ${v.bottom}% ${v.left}% round ${v.round}px)`;
  return `polygon(${v.x1}% ${v.y1}%, ${v.x2}% ${v.y2}%, ${v.x3}% ${v.y3}%, ${v.x4}% ${v.y4}%)`;
}

export function updateGuidedShape(css, field, value) {
  const shape = parseGuidedShape(css);
  if (!shape || !Object.hasOwn(SHAPE_FIELDS[shape.kind], field) || String(value).trim() === "") return null;
  return guidedShapeCss(shape.kind, { ...shape.values, [field]: Number(value) });
}
