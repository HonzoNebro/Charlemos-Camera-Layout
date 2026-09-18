import { MODULE_ID } from "./constants.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { configurationChanges } from "./edit-session.js";
import { nameFontSelect } from "./name-config-app.js";

export const FIELD_GROUPS = {
  layout: ["layoutMode", "top", "left", "width", "height", "relativeTargetUserId", "relativePlacement", "relativeGap"],
  masks: ["cropTop", "cropRight", "cropBottom", "cropLeft"],
  effects: ["transform", "filter", "clipPath", "geometryBorderRadius", "geometryTransparentFrame"],
  resource: ["overlayEnabled", "overlayImage", "overlayOpacity"],
  fit: ["overlayFitMode", "overlayAnchor"],
  bounds: ["overlayBoundsMode", "overlayBoundsTop", "overlayBoundsRight", "overlayBoundsBottom", "overlayBoundsLeft"],
  placement: ["overlayOffsetX", "overlayOffsetY", "overlayScale", "overlayRotate"],
  tint: ["overlayTintEnabled", "overlayTintColor", "overlayTintOpacity", "overlayTintBlendMode"],
  text: ["nameVisible", "nameSource", "nameText"],
  font: ["nameColorFromUser", "nameColor", "nameFont", "nameFontSize", "nameLineHeight", "nameFontWeight", "nameFontStyle"],
  namePlacement: ["namePosition", "nameTextAlign", "nameOffset", "namePaddingX", "namePaddingY"],
  appearance: ["nameCustomBackground", "nameBackgroundColor", "nameBackgroundOpacity", "nameCustomBorder", "nameBorderColor", "nameBorderWidth", "nameBorderRadius"]
};

const CHOICES = {
  layoutMode: ["absolute", "relative"],
  overlayBoundsMode: ["camera", "expanded"],
  overlayFitMode: ["auto", "cover", "contain", "fill"],
  overlayAnchor: ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
  overlayTintBlendMode: ["normal", "multiply", "screen", "overlay", "soft-light"],
  nameSource: ["user", "character", "alternate", "custom"],
  namePosition: ["top", "bottom"],
  nameTextAlign: ["left", "center", "right", "justify"],
  nameFontWeight: ["400", "500", "600", "700"],
  nameFontStyle: ["normal", "italic"],
  relativePlacement: ["none", "above", "below", "left-of", "right-of", "above-left", "above-center", "above-right", "below-left", "below-center", "below-right", "left-top", "left-center", "left-bottom", "right-top", "right-center", "right-bottom"]
};

export function escapeEditorHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function editorText(key) {
  return game.i18n.localize(`${MODULE_ID}.ui.editor.${key}`);
}

export function editorButton(action, key, attributes = "") {
  return `<button type="button" data-editor-action="${action}" ${attributes}>${escapeEditorHtml(editorText(key))}</button>`;
}

function configText(key) {
  return game.i18n.localize(`${MODULE_ID}.ui.config.${key}`);
}

function choiceLabel(name, value) {
  const group = { overlayFitMode: "overlayFit", overlayTintBlendMode: "overlayBlend", overlayBoundsMode: "overlayBounds" }[name] ?? name;
  const suffix = value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  const key = `${MODULE_ID}.ui.config.${group}.${suffix}`;
  const label = game.i18n.localize(key);
  return label === key ? value : label;
}

export function selectControl(name, value, items) {
  return `<select name="${escapeEditorHtml(name)}"${name.startsWith("unit-") ? ` aria-label="${escapeEditorHtml(editorText("unit"))}"` : name.startsWith("slot-") ? ` aria-label="${escapeEditorHtml(editorText("camera"))} ${Number(name.slice(5)) + 1}"` : ""}>${items.map((item) =>
    `<option value="${escapeEditorHtml(item.id)}"${String(value ?? "") === String(item.id) ? " selected" : ""}>${escapeEditorHtml(item.label)}</option>`
  ).join("")}</select>`;
}

export function simpleLength(value) {
  const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|%|vw|vh)?$/.exec(String(value ?? "").trim());
  return match ? { value: Number(match[1]), unit: match[2] ?? "px" } : null;
}

function lengthControl(name, value) {
  const parsed = simpleLength(value);
  if (value && !parsed) return `<input name="${name}" value="${escapeEditorHtml(value)}"><small>${escapeEditorHtml(editorText("customCss"))}</small>`;
  return `<div class="charlemos-length"><input type="number" step="any" data-length="${name}" value="${parsed?.value ?? ""}" aria-label="${escapeEditorHtml(configText(`fields.${name}`))}">${selectControl(`unit-${name}`, parsed?.unit ?? "px", ["px", "%", "vw", "vh"].map((unit) => ({ id: unit, label: unit })))}</div>`;
}

function control(name, value, users) {
  if (name === "nameFont") return nameFontSelect(value);
  if (name === "relativeTargetUserId") return selectControl(name, value, [{ id: "", label: "—" }, ...(value && !users.some((user) => user.id === value) ? [{ id: value, label: `${editorText("unavailable")} (${value})` }] : []), ...users.map((user) => ({ id: user.id, label: user.name }))]);
  if (CHOICES[name]) return selectControl(name, value, CHOICES[name].map((id) => ({ id, label: choiceLabel(name, id) })));
  if (typeof value === "boolean") return `<input name="${name}" type="checkbox"${value ? " checked" : ""}>`;
  if (/Color$/.test(name)) return `<input name="${name}" type="color" value="${escapeEditorHtml(value)}">`;
  if (/Opacity$/.test(name)) return `<input name="${name}" type="number" min="0" max="1" step="0.01" value="${value}">`;
  if (/^overlayBounds(Top|Right|Bottom|Left)$/.test(name)) return `<input name="${name}" type="number" min="0" max="500" step="0.1" value="${value}"> %`;
  if (["overlayScale", "overlayRotate"].includes(name)) return `<input name="${name}" type="number" step="any"${name === "overlayScale" ? ' min="0.01"' : ""} value="${value}">`;
  if (/^(top|left|width|height|relativeGap|crop\w+|overlayOffset[XY]|geometryBorderRadius|name(FontSize|Offset|Padding[XY]|BorderWidth|BorderRadius))$/.test(name)) return lengthControl(name, value);
  return `<input name="${name}" value="${escapeEditorHtml(value)}">`;
}

export function cameraFieldsHtml(layout, section, users, prefix, { geometryAvailable = true } = {}) {
  const values = buildFormData(layout);
  const groups = { layout: ["layout", "masks"], effects: ["effects"], overlay: ["resource", "fit", "bounds", "placement", "tint"], name: ["text", "font", "namePlacement", "appearance"] }[section] ?? [];
  return groups.map((group) => `<fieldset><legend>${escapeEditorHtml(editorText(group))}</legend>${FIELD_GROUPS[group].map((name) => {
    const id = `${prefix}-${name}`;
    const disabled = fieldDisabled(name, values, geometryAvailable);
    let input = control(name, values[name], users).replace(/<(input|select)\b/, `<$1 id="${id}" aria-describedby="${id}-help"`);
    if (disabled) input = input.replace(/<(input|select)\b/g, "<$1 disabled");
    const row = `<div class="charlemos-field"><label for="${id}">${escapeEditorHtml(configText(`fields.${name}`))}</label>${input}<small id="${id}-help">${escapeEditorHtml(configText(`help.${name}`))}</small></div>`;
    return ["transform", "filter", "clipPath"].includes(name) ? `<details><summary>${escapeEditorHtml(editorText("advanced"))}: ${escapeEditorHtml(configText(`fields.${name}`))}</summary>${row}</details>` : row;
  }).join("")}</fieldset>`).join("");
}

export function fieldDisabled(name, values, geometryAvailable) {
  if (FIELD_GROUPS.layout.includes(name)) {
    if (!geometryAvailable) return true;
    if (["top", "left"].includes(name)) return values.layoutMode === "relative";
    if (name.startsWith("relative")) return values.layoutMode !== "relative";
  }
  if (name === "geometryTransparentFrame") return !geometryAvailable;
  if (/^overlayBounds(Top|Right|Bottom|Left)$/.test(name)) return values.overlayBoundsMode !== "expanded";
  if (name.startsWith("overlayTint") && name !== "overlayTintEnabled") return !values.overlayTintEnabled;
  if (name === "nameText") return values.nameSource !== "custom";
  if (name === "nameColor") return values.nameColorFromUser;
  if (["nameBackgroundColor", "nameBackgroundOpacity"].includes(name)) return !values.nameCustomBackground;
  if (["nameBorderColor", "nameBorderWidth", "nameBorderRadius"].includes(name)) return !values.nameCustomBorder;
  return false;
}

export function updateCameraField(session, userId, name, value) {
  const path = ["profile", "layouts", userId];
  const layout = session.draft.profile.layouts[userId] ?? {};
  const before = buildFormData(layout);
  if (!Object.hasOwn(before, name)) return;
  const changes = configurationChanges(buildLayoutPatch(before), buildLayoutPatch({ ...before, [name]: value }));
  session.beginGesture();
  for (const change of changes) session.edit([...path, ...change.path], change.after);
  session.edit(["profile", "enabled"], true);
  session.endGesture();
}
