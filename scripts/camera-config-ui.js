import { MODULE_ID } from "./constants.js";
import { addEffect, availableEffectItems, removeEffect, usedEffectIds } from "./css-effects.js";
import { localize, readChecked, readText, setFieldValue } from "./camera-config-shared.js";

export function appId(suffix = "form") {
  return `${MODULE_ID}-${suffix}`;
}

export function textInput(name, value) {
  return `<input type="text" name="${name}" value="${foundry.utils.escapeHTML(String(value ?? ""))}">`;
}

export function numberInput(name, value, min, max, step) {
  const minAttr = min !== null ? ` min="${min}"` : "";
  const maxAttr = max !== null ? ` max="${max}"` : "";
  const stepAttr = step !== null ? ` step="${step}"` : "";
  return `<input type="number" name="${name}" value="${value}"${minAttr}${maxAttr}${stepAttr}>`;
}

export function checkboxInput(name, checked) {
  const checkedAttr = checked ? " checked" : "";
  return `<input type="checkbox" name="${name}"${checkedAttr}>`;
}

export function colorInput(name, value) {
  return `<input type="color" name="${name}" value="${foundry.utils.escapeHTML(String(value ?? "#ffffff"))}">`;
}

export function rowHtml(label, field) {
  return `<label class="charlemos-field"><span class="charlemos-field-label">${label}</span>${field}</label>`;
}

export function helpText(helpKey) {
  return `<small class="charlemos-field-help">${localize(`ui.config.help.${helpKey}`)}</small>`;
}

export function rowWithHelp(labelKey, field, helpKey) {
  const label = localize(`ui.config.fields.${labelKey}`);
  return rowHtml(`${label}${helpText(helpKey)}`, field);
}

export function sectionHtml(title, description, rows) {
  return `<section class="charlemos-section"><h3>${title}</h3><p class="charlemos-section-desc">${description}</p>${rows.join("")}</section>`;
}

export function optionTag(user, selectedId) {
  const selectedAttr = user.id === selectedId ? " selected" : "";
  return `<option value="${user.id}"${selectedAttr}>${foundry.utils.escapeHTML(user.name)}</option>`;
}

export function playerSelectHtml(users, selectedId, selectId = `${MODULE_ID}-player-select`) {
  const options = users.map((user) => optionTag(user, selectedId)).join("");
  return `<select id="${selectId}" name="playerId">${options}</select>`;
}

export function selectFromItems(name, value, items) {
  const selectedValue = String(value ?? "");
  const options = items
    .map((item) => {
      const selectedAttr = selectedValue === item.id ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="${name}">${options}</select>`;
}

export function overlayImageField(value) {
  return [
    `<div class="charlemos-image-field">`,
    textInput("overlayImage", value),
    `<button type="button" data-action="pick-overlay-image">${localize("ui.config.actions.pickFile")}</button>`,
    `</div>`
  ].join("");
}

export function overlayTintBlendModeSelect(value) {
  const items = [
    { id: "normal", key: "ui.config.overlayBlend.normal" },
    { id: "multiply", key: "ui.config.overlayBlend.multiply" },
    { id: "screen", key: "ui.config.overlayBlend.screen" },
    { id: "overlay", key: "ui.config.overlayBlend.overlay" },
    { id: "soft-light", key: "ui.config.overlayBlend.softLight" }
  ];
  return selectFromItems("overlayTintBlendMode", value, items.map((item) => ({ id: item.id, label: localize(item.key) })));
}

export function overlayFitModeSelect(value) {
  const items = [
    { id: "auto", label: localize("ui.config.overlayFit.auto") },
    { id: "cover", label: localize("ui.config.overlayFit.cover") },
    { id: "contain", label: localize("ui.config.overlayFit.contain") },
    { id: "fill", label: localize("ui.config.overlayFit.fill") }
  ];
  return selectFromItems("overlayFitMode", value, items);
}

export function overlayAnchorSelect(value) {
  const items = [
    { id: "center", label: localize("ui.config.overlayAnchor.center") },
    { id: "top", label: localize("ui.config.overlayAnchor.top") },
    { id: "bottom", label: localize("ui.config.overlayAnchor.bottom") },
    { id: "left", label: localize("ui.config.overlayAnchor.left") },
    { id: "right", label: localize("ui.config.overlayAnchor.right") },
    { id: "top-left", label: localize("ui.config.overlayAnchor.topLeft") },
    { id: "top-right", label: localize("ui.config.overlayAnchor.topRight") },
    { id: "bottom-left", label: localize("ui.config.overlayAnchor.bottomLeft") },
    { id: "bottom-right", label: localize("ui.config.overlayAnchor.bottomRight") }
  ];
  return selectFromItems("overlayAnchor", value, items);
}

function effectLabel(effectId) {
  const key = `ui.config.effect.${effectId}`;
  const localized = localize(key);
  const fullKey = `${MODULE_ID}.${key}`;
  if (localized === fullKey) return effectId;
  return localized;
}

function optionHtml(value, label) {
  return `<option value="${value}">${foundry.utils.escapeHTML(label)}</option>`;
}

function effectOptions(kind, currentValue) {
  const items = availableEffectItems(kind, currentValue);
  const placeholder = optionHtml("", localize("ui.config.actions.effectPlaceholder"));
  const values = items.map((item) => optionHtml(item.id, effectLabel(item.id)));
  return [placeholder, ...values].join("");
}

function usedEffectPills(kind, currentValue) {
  const ids = usedEffectIds(currentValue);
  return ids
    .map((id) => `<button type="button" class="charlemos-pill" data-action="effect-remove" data-effect-kind="${kind}" data-effect-id="${id}">${foundry.utils.escapeHTML(effectLabel(id))}</button>`)
    .join("");
}

export function effectEditor(kind, fieldName, value) {
  const options = effectOptions(kind, value);
  const pills = usedEffectPills(kind, value);
  return [
    `<div class="charlemos-effect-editor">`,
    textInput(fieldName, value),
    `<div class="charlemos-effect-controls">`,
    `<select data-effect-select="${kind}">${options}</select>`,
    `<button type="button" data-action="effect-add" data-effect-kind="${kind}" data-effect-input="${fieldName}">${localize("ui.config.actions.addEffect")}</button>`,
    `</div>`,
    `<div class="charlemos-pill-list" data-effect-used="${kind}">${pills}</div>`,
    `</div>`
  ].join("");
}

export function refreshEffectUi(form, kind, inputName) {
  const currentValue = readText(form, inputName);
  const select = form.querySelector(`[data-effect-select="${kind}"]`);
  if (select) select.innerHTML = effectOptions(kind, currentValue);
  const used = form.querySelector(`[data-effect-used="${kind}"]`);
  if (used) used.innerHTML = usedEffectPills(kind, currentValue);
}

export function bindEffectEditor(form) {
  form.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest("button");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "effect-add") {
      const kind = target.dataset.effectKind;
      const inputName = target.dataset.effectInput;
      const select = form.querySelector(`[data-effect-select="${kind}"]`);
      if (!select?.value) return;
      const currentValue = readText(form, inputName);
      const nextValue = addEffect(kind, currentValue, select.value);
      setFieldValue(form, inputName, nextValue);
      refreshEffectUi(form, kind, inputName);
    }
    if (action === "effect-remove") {
      const kind = target.dataset.effectKind;
      const effectId = target.dataset.effectId;
      const currentValue = readText(form, kind);
      const nextValue = removeEffect(kind, currentValue, effectId);
      setFieldValue(form, kind, nextValue);
      refreshEffectUi(form, kind, kind);
    }
  });
  form.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
    const fieldName = event.target.name;
    if (!["transform", "filter", "clipPath"].includes(fieldName)) return;
    refreshEffectUi(form, fieldName, fieldName);
  });
}

export function bindOverlayTintMode(form) {
  const source = form.elements.namedItem("overlayTintEnabled");
  if (!source) return;
  const sync = () => {
    const enabled = readChecked(form, "overlayTintEnabled");
    const colorInput = form.elements.namedItem("overlayTintColor");
    const opacityInput = form.elements.namedItem("overlayTintOpacity");
    const blendInput = form.elements.namedItem("overlayTintBlendMode");
    if (colorInput) colorInput.disabled = !enabled;
    if (opacityInput) opacityInput.disabled = !enabled;
    if (blendInput) blendInput.disabled = !enabled;
  };
  source.addEventListener("change", sync);
  sync();
}
