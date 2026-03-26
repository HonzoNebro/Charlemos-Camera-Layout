import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { exportSceneProfileToMacro } from "./macro-exporter.js";
import { getAllPlayerLayouts, getPlayerLayout, replacePlayerLayout, setAllPlayerLayouts } from "./camera-style-service.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { replaceAppContent } from "./dom-replace.js";
import { addEffect, availableEffectItems, removeEffect, usedEffectIds } from "./css-effects.js";
import { applySceneProfile, getSceneProfile, getSceneProfileLayout, resetSceneProfile, sceneProfileEnabled } from "./scene-camera.js";
import { clearLoadedSceneProfileDraft, getLoadedSceneProfileDraft } from "./state.js";
import { NameConfigApp } from "./name-config-app.js";

function titleKey() {
  return `${MODULE_ID}.ui.config.title`;
}

function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
}

function selectedUser(users, selectedUserId) {
  const selected = users.find((user) => user.id === selectedUserId);
  if (selected) return selected;
  return users[0] ?? null;
}

function usersForConfig() {
  return game.users.filter((user) => user.active);
}

function appId() {
  return `${MODULE_ID}-form`;
}

function currentSceneId() {
  return canvas.scene?.id ?? null;
}

function loadedDraftLayouts(sceneId) {
  const draft = getLoadedSceneProfileDraft(sceneId);
  if (!draft) return null;
  return draft.layouts ?? null;
}

const LEGACY_LAYOUT_KEYS = ["preset", "snap", "resize", "position", "top", "left", "width", "height"];
const CONFIG_EXPORT_VERSION = 1;

function cloneValue(value) {
  return foundry.utils.deepClone(value ?? {});
}

function sanitizeLayout(layout) {
  const next = cloneValue(layout);
  LEGACY_LAYOUT_KEYS.forEach((key) => {
    delete next[key];
  });
  if (next.geometry) {
    next.geometry = {
      borderRadius: next.geometry.borderRadius ?? null
    };
  }
  return next;
}

function sanitizeLayouts(layouts) {
  const next = {};
  Object.entries(layouts ?? {}).forEach(([playerId, layout]) => {
    next[playerId] = sanitizeLayout(layout);
  });
  return next;
}

function readText(form, name) {
  return form.elements.namedItem(name)?.value ?? "";
}

function readChecked(form, name) {
  return Boolean(form.elements.namedItem(name)?.checked);
}

function readFormData(form) {
  return {
    cropTop: readText(form, "cropTop"),
    cropRight: readText(form, "cropRight"),
    cropBottom: readText(form, "cropBottom"),
    cropLeft: readText(form, "cropLeft"),
    transform: readText(form, "transform"),
    filter: readText(form, "filter"),
    clipPath: readText(form, "clipPath"),
    overlayEnabled: readChecked(form, "overlayEnabled"),
    overlayImage: readText(form, "overlayImage"),
    overlayOpacity: readText(form, "overlayOpacity"),
    overlayOffsetX: readText(form, "overlayOffsetX"),
    overlayOffsetY: readText(form, "overlayOffsetY"),
    overlayScale: readText(form, "overlayScale"),
    overlayRotate: readText(form, "overlayRotate"),
    overlayTintEnabled: readChecked(form, "overlayTintEnabled"),
    overlayTintColor: readText(form, "overlayTintColor"),
    overlayTintOpacity: readText(form, "overlayTintOpacity"),
    overlayTintBlendMode: readText(form, "overlayTintBlendMode"),
    nameVisible: readChecked(form, "nameVisible"),
    nameSource: readText(form, "nameSource"),
    nameText: readText(form, "nameText"),
    nameColorFromUser: readChecked(form, "nameColorFromUser"),
    nameColor: readText(form, "nameColor"),
    nameFont: readText(form, "nameFont"),
    namePosition: readText(form, "namePosition"),
    geometryBorderRadius: readText(form, "geometryBorderRadius")
  };
}

function setFieldValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field) return;
  field.value = String(value ?? "");
}

function optionTag(user, selectedId) {
  const selectedAttr = user.id === selectedId ? " selected" : "";
  return `<option value="${user.id}"${selectedAttr}>${foundry.utils.escapeHTML(user.name)}</option>`;
}

function playerSelectHtml(users, selectedId) {
  const options = users.map((user) => optionTag(user, selectedId)).join("");
  return `<select id="${MODULE_ID}-player-select" name="playerId">${options}</select>`;
}

function textInput(name, value) {
  return `<input type="text" name="${name}" value="${foundry.utils.escapeHTML(String(value ?? ""))}">`;
}

function numberInput(name, value, min, max, step) {
  const minAttr = min !== null ? ` min="${min}"` : "";
  const maxAttr = max !== null ? ` max="${max}"` : "";
  const stepAttr = step !== null ? ` step="${step}"` : "";
  return `<input type="number" name="${name}" value="${value}"${minAttr}${maxAttr}${stepAttr}>`;
}

function checkboxInput(name, checked) {
  const checkedAttr = checked ? " checked" : "";
  return `<input type="checkbox" name="${name}"${checkedAttr}>`;
}

function colorInput(name, value) {
  return `<input type="color" name="${name}" value="${foundry.utils.escapeHTML(String(value ?? "#ffffff"))}">`;
}

function namePositionSelect(value) {
  const selectedTop = value === "top" ? " selected" : "";
  const selectedBottom = value === "bottom" ? " selected" : "";
  return [
    `<select name="namePosition">`,
    `<option value="top"${selectedTop}>${localize("ui.config.namePosition.top")}</option>`,
    `<option value="bottom"${selectedBottom}>${localize("ui.config.namePosition.bottom")}</option>`,
    `</select>`
  ].join("");
}

function nameSourceSelect(value) {
  const selectedUser = value === "user" ? " selected" : "";
  const selectedCharacter = value === "character" ? " selected" : "";
  const selectedAlternate = value === "alternate" ? " selected" : "";
  const selectedCustom = value === "custom" ? " selected" : "";
  return [
    `<select name="nameSource">`,
    `<option value="user"${selectedUser}>${localize("ui.config.nameSource.user")}</option>`,
    `<option value="character"${selectedCharacter}>${localize("ui.config.nameSource.character")}</option>`,
    `<option value="alternate"${selectedAlternate}>${localize("ui.config.nameSource.alternate")}</option>`,
    `<option value="custom"${selectedCustom}>${localize("ui.config.nameSource.custom")}</option>`,
    `</select>`
  ].join("");
}

function nameFontSelect(value) {
  const options = [
    { id: "inherit", label: localize("ui.config.font.inherit"), css: "" },
    { id: "georgia", label: "Georgia", css: "Georgia, serif" },
    { id: "times", label: "Times New Roman", css: "'Times New Roman', serif" },
    { id: "trebuchet", label: "Trebuchet MS", css: "'Trebuchet MS', sans-serif" },
    { id: "arial", label: "Arial", css: "Arial, sans-serif" },
    { id: "verdana", label: "Verdana", css: "Verdana, sans-serif" },
    { id: "courier", label: "Courier New", css: "'Courier New', monospace" },
    { id: "lora", label: "Lora", css: "'Lora', serif" }
  ];
  const known = options.find((item) => item.css === (value ?? ""));
  const dynamic = !known && value ? [{ id: "custom", label: `${localize("ui.config.font.custom")} (${value})`, css: value }] : [];
  const all = [...options, ...dynamic];
  const optionTags = all
    .map((item) => {
      const selectedAttr = item.css === (value ?? "") ? " selected" : "";
      return `<option value="${foundry.utils.escapeHTML(item.css)}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="nameFont">${optionTags}</select>`;
}

function overlayImageField(value) {
  return [
    `<div class="charlemos-image-field">`,
    textInput("overlayImage", value),
    `<button type="button" data-action="pick-overlay-image">${localize("ui.config.actions.pickFile")}</button>`,
    `</div>`
  ].join("");
}

function overlayTintBlendModeSelect(value) {
  const items = [
    { id: "normal", key: "ui.config.overlayBlend.normal" },
    { id: "multiply", key: "ui.config.overlayBlend.multiply" },
    { id: "screen", key: "ui.config.overlayBlend.screen" },
    { id: "overlay", key: "ui.config.overlayBlend.overlay" },
    { id: "soft-light", key: "ui.config.overlayBlend.softLight" }
  ];
  const options = items
    .map((item) => {
      const selectedAttr = (value ?? "normal") === item.id ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${localize(item.key)}</option>`;
    })
    .join("");
  return `<select name="overlayTintBlendMode">${options}</select>`;
}

function optionHtml(value, label) {
  return `<option value="${value}">${label}</option>`;
}

function effectLabel(effectId) {
  const key = `ui.config.effect.${effectId}`;
  const localized = localize(key);
  const fullKey = `${MODULE_ID}.${key}`;
  if (localized === fullKey) return effectId;
  return localized;
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
    .map((id) => {
      return `<button type="button" class="charlemos-pill" data-action="effect-remove" data-effect-kind="${kind}" data-effect-id="${id}">${effectLabel(id)}</button>`;
    })
    .join("");
}

function clipPathEffectOptions(currentValue) {
  const base = availableEffectItems("clipPath", currentValue);
  const placeholder = optionHtml("", localize("ui.config.actions.effectPlaceholder"));
  const values = base.map((item) => optionHtml(item.id, effectLabel(item.id)));
  return [placeholder, ...values].join("");
}

function clipPathPills(currentValue) {
  return usedEffectPills("clipPath", currentValue);
}

function effectEditor(kind, fieldName, value) {
  const options = kind === "clipPath" ? clipPathEffectOptions(value) : effectOptions(kind, value);
  const pills = kind === "clipPath" ? clipPathPills(value) : usedEffectPills(kind, value);
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

function rowHtml(label, field) {
  return `<label class="charlemos-field"><span class="charlemos-field-label">${label}</span>${field}</label>`;
}

function helpText(helpKey) {
  return `<small class="charlemos-field-help">${localize(`ui.config.help.${helpKey}`)}</small>`;
}

function rowWithHelp(labelKey, field, helpKey) {
  const label = localize(`ui.config.fields.${labelKey}`);
  return rowHtml(`${label}${helpText(helpKey)}`, field);
}

function sectionHtml(title, description, rows) {
  return `<section class="charlemos-section"><h3>${title}</h3><p class="charlemos-section-desc">${description}</p>${rows.join("")}</section>`;
}

function layoutSection(formData) {
  return sectionHtml(localize("ui.config.sections.layout"), localize("ui.config.sections.layoutDesc"), [
    rowWithHelp("cropTop", textInput("cropTop", formData.cropTop), "cropTop"),
    rowWithHelp("cropRight", textInput("cropRight", formData.cropRight), "cropRight"),
    rowWithHelp("cropBottom", textInput("cropBottom", formData.cropBottom), "cropBottom"),
    rowWithHelp("cropLeft", textInput("cropLeft", formData.cropLeft), "cropLeft")
  ]);
}

function effectsSection(formData) {
  return sectionHtml(localize("ui.config.sections.effects"), localize("ui.config.sections.effectsDesc"), [
    rowWithHelp("transform", effectEditor("transform", "transform", formData.transform), "transform"),
    rowWithHelp("filter", effectEditor("filter", "filter", formData.filter), "filter"),
    rowWithHelp("clipPath", effectEditor("clipPath", "clipPath", formData.clipPath), "clipPath"),
    rowWithHelp("geometryBorderRadius", textInput("geometryBorderRadius", formData.geometryBorderRadius), "geometryBorderRadius")
  ]);
}

function overlaySection(formData) {
  return sectionHtml(localize("ui.config.sections.overlay"), localize("ui.config.sections.overlayDesc"), [
    rowWithHelp("overlayEnabled", checkboxInput("overlayEnabled", formData.overlayEnabled), "overlayEnabled"),
    rowWithHelp("overlayImage", overlayImageField(formData.overlayImage), "overlayImage"),
    rowWithHelp("overlayOpacity", numberInput("overlayOpacity", formData.overlayOpacity, 0, 1, 0.05), "overlayOpacity"),
    rowWithHelp("overlayOffsetX", textInput("overlayOffsetX", formData.overlayOffsetX), "overlayOffsetX"),
    rowWithHelp("overlayOffsetY", textInput("overlayOffsetY", formData.overlayOffsetY), "overlayOffsetY"),
    rowWithHelp("overlayScale", numberInput("overlayScale", formData.overlayScale, 0.01, null, 0.01), "overlayScale"),
    rowWithHelp("overlayRotate", numberInput("overlayRotate", formData.overlayRotate, null, null, 0.1), "overlayRotate"),
    rowWithHelp("overlayTintEnabled", checkboxInput("overlayTintEnabled", formData.overlayTintEnabled), "overlayTintEnabled"),
    rowWithHelp("overlayTintColor", colorInput("overlayTintColor", formData.overlayTintColor), "overlayTintColor"),
    rowWithHelp("overlayTintOpacity", numberInput("overlayTintOpacity", formData.overlayTintOpacity, 0, 1, 0.05), "overlayTintOpacity"),
    rowWithHelp("overlayTintBlendMode", overlayTintBlendModeSelect(formData.overlayTintBlendMode), "overlayTintBlendMode")
  ]);
}

function nameSourceLabel(value) {
  if (value === "character") return localize("ui.config.nameSource.character");
  if (value === "alternate") return localize("ui.config.nameSource.alternate");
  if (value === "custom") return localize("ui.config.nameSource.custom");
  return localize("ui.config.nameSource.user");
}

function namePositionLabel(value) {
  if (value === "top") return localize("ui.config.namePosition.top");
  return localize("ui.config.namePosition.bottom");
}

function nameSection(formData) {
  const source = nameSourceLabel(formData.nameSource);
  const position = namePositionLabel(formData.namePosition);
  const visible = formData.nameVisible ? localize("ui.config.common.enabled") : localize("ui.config.common.disabled");
  const summary = `${localize("ui.config.fields.nameVisible")}: ${visible} · ${localize("ui.config.fields.nameSource")}: ${source} · ${localize("ui.config.fields.namePosition")}: ${position}`;
  return sectionHtml(localize("ui.config.sections.name"), localize("ui.config.sections.nameDesc"), [
    `<p class="charlemos-name-summary">${foundry.utils.escapeHTML(summary)}</p>`,
    `<div class="charlemos-inline-action"><button type="button" data-action="open-name-config">${localize("ui.config.actions.openNameConfig")}</button></div>`
  ]);
}

function actionsHtml(sceneId) {
  const resetDisabled = sceneId ? "" : " disabled";
  return [
    `<div class="charlemos-actions">`,
    `<button type="submit">${localize("ui.config.actions.save")}</button>`,
    `<button type="button" data-action="export">${localize("ui.config.actions.export")}</button>`,
    `<button type="button" data-action="export-json">${localize("ui.config.actions.exportJson")}</button>`,
    `<button type="button" data-action="import-json">${localize("ui.config.actions.importJson")}</button>`,
    `<button type="button" data-action="reset-scene-profile"${resetDisabled}>${localize("ui.config.actions.resetSceneProfile")}</button>`,
    `</div>`
  ].join("");
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<label class="charlemos-field">`,
    `<span class="charlemos-field-label">${localize("ui.config.fields.player")}${helpText("player")}</span>`,
    playerSelectHtml(context.users, context.selectedUserId),
    `</label>`,
    `<form id="${appId()}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    layoutSection(context.formData),
    effectsSection(context.formData),
    overlaySection(context.formData),
    nameSection(context.formData),
    `</div>`,
    actionsHtml(context.sceneId),
    `</form>`,
    `</div>`
  ].join("");
}

export class CameraConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-config`,
    tag: "section",
    window: {
      title: titleKey()
    },
    position: {
      width: 640,
      height: 760
    }
  };

  constructor(options = {}) {
    super(options);
    this.selectedUserId = game.user?.id ?? null;
  }

  async _prepareContext() {
    const users = usersForConfig();
    const selected = selectedUser(users, this.selectedUserId);
    this.selectedUserId = selected?.id ?? null;
    const sceneId = currentSceneId();
    const draftLayouts = loadedDraftLayouts(sceneId);
    let layout = null;
    if (this.selectedUserId) {
      if (draftLayouts?.[this.selectedUserId]) layout = draftLayouts[this.selectedUserId];
      else if (sceneProfileEnabled()) layout = getSceneProfileLayout(this.selectedUserId) ?? getPlayerLayout(this.selectedUserId);
      else layout = getPlayerLayout(this.selectedUserId);
    }
    return {
      moduleId: MODULE_ID,
      title: game.i18n.localize(titleKey()),
      users,
      sceneId,
      selectedUserId: this.selectedUserId,
      sceneProfileEnabled: sceneProfileEnabled(),
      formData: buildFormData(layout)
    };
  }

  async _renderHTML(context, options) {
    return buildHtml(context);
  }

  _replaceHTML(result, content, options) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    this.bindPlayerChange();
    this.bindSubmit();
    this.bindActions();
    this.bindOverlayControls();
    this.bindOverlayTintMode();
    this.bindEffectButtons();
    this.bindNameSourceMode();
    this.bindNameColorMode();
  }

  bindPlayerChange() {
    const select = document.getElementById(`${MODULE_ID}-player-select`);
    if (!select) return;
    select.addEventListener("change", (event) => {
      this.selectedUserId = event.currentTarget.value;
      this.render(true);
    });
  }

  bindSubmit() {
    const form = document.getElementById(appId());
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
  }

  bindActions() {
    const root = document.getElementById(appId());
    if (!root) return;
    root.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "export") {
        await this.exportCurrentLayout(root);
      }
      if (action === "export-json") {
        await this.exportJsonConfig();
      }
      if (action === "import-json") {
        await this.importJsonConfig();
      }
      if (action === "reset-scene-profile") {
        await this.resetCurrentSceneProfile();
      }
      if (action === "open-name-config") {
        this.openNameConfig();
      }
    });
  }

  bindOverlayControls() {
    const form = document.getElementById(appId());
    if (!form) return;
    form.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "pick-overlay-image") {
        event.preventDefault();
        this.openOverlayFilePicker(form);
      }
    });
  }

  bindEffectButtons() {
    const form = document.getElementById(appId());
    if (!form) return;
    form.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest("button");
      if (!target) return;
      const action = target.dataset.action;
      if (action === "effect-add") {
        const kind = target.dataset.effectKind;
        const inputName = target.dataset.effectInput;
        this.addEffectFromSelector(form, kind, inputName);
      }
      if (action === "effect-remove") {
        const kind = target.dataset.effectKind;
        const effectId = target.dataset.effectId;
        this.removeEffectFromInput(form, kind, effectId);
      }
    });
    form.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
      if (event.target.dataset.borderRadiusInput !== undefined) {
        const number = Number.parseInt(event.target.value || "0", 10);
        if (Number.isNaN(number)) return;
        setFieldValue(form, "geometryBorderRadius", `${Math.max(0, number)}px`);
        return;
      }
      const fieldName = event.target.name;
      if (!["transform", "filter", "clipPath"].includes(fieldName)) return;
      this.refreshEffectUi(form, fieldName, fieldName);
    });
  }

  bindOverlayTintMode() {
    const form = document.getElementById(appId());
    if (!form) return;
    const source = form.elements.namedItem("overlayTintEnabled");
    if (!source) return;
    source.addEventListener("change", () => {
      this.syncOverlayTintMode(form);
    });
    this.syncOverlayTintMode(form);
  }

  bindNameSourceMode() {
    const form = document.getElementById(appId());
    if (!form) return;
    const source = form.elements.namedItem("nameSource");
    if (!source) return;
    source.addEventListener("change", () => {
      this.syncNameSourceMode(form);
    });
    this.syncNameSourceMode(form);
  }

  bindNameColorMode() {
    const form = document.getElementById(appId());
    if (!form) return;
    const source = form.elements.namedItem("nameColorFromUser");
    if (!source) return;
    source.addEventListener("change", () => {
      this.syncNameColorMode(form);
    });
    this.syncNameColorMode(form);
  }

  addEffectFromSelector(form, kind, inputName) {
    const select = form.querySelector(`[data-effect-select="${kind}"]`);
    if (!select) return;
    if (!select.value) return;
    const currentValue = readText(form, inputName);
    const nextValue = addEffect(kind, currentValue, select.value);
    setFieldValue(form, inputName, nextValue);
    this.refreshEffectUi(form, kind, inputName);
  }

  removeEffectFromInput(form, kind, effectId) {
    const inputName = kind;
    const currentValue = readText(form, inputName);
    const nextValue = removeEffect(kind, currentValue, effectId);
    setFieldValue(form, inputName, nextValue);
    this.refreshEffectUi(form, kind, inputName);
  }

  refreshEffectUi(form, kind, inputName) {
    const currentValue = readText(form, inputName);
    const select = form.querySelector(`[data-effect-select="${kind}"]`);
    if (select) {
      const options = kind === "clipPath" ? clipPathEffectOptions(currentValue) : effectOptions(kind, currentValue);
      select.innerHTML = options;
    }
    const used = form.querySelector(`[data-effect-used="${kind}"]`);
    if (used) used.innerHTML = kind === "clipPath" ? clipPathPills(currentValue) : usedEffectPills(kind, currentValue);
  }

  syncNameSourceMode(form) {
    const nameSource = readText(form, "nameSource");
    const customInput = form.elements.namedItem("nameText");
    if (!customInput) return;
    customInput.disabled = nameSource !== "custom";
  }

  syncNameColorMode(form) {
    const colorFromUser = readChecked(form, "nameColorFromUser");
    const colorInput = form.elements.namedItem("nameColor");
    if (!colorInput) return;
    colorInput.disabled = colorFromUser;
  }

  syncOverlayTintMode(form) {
    const enabled = readChecked(form, "overlayTintEnabled");
    const colorInput = form.elements.namedItem("overlayTintColor");
    const opacityInput = form.elements.namedItem("overlayTintOpacity");
    const blendInput = form.elements.namedItem("overlayTintBlendMode");
    if (colorInput) colorInput.disabled = !enabled;
    if (opacityInput) opacityInput.disabled = !enabled;
    if (blendInput) blendInput.disabled = !enabled;
  }

  openNameConfig() {
    if (!this.selectedUserId) return;
    const app = new NameConfigApp({
      selectedUserId: this.selectedUserId
    });
    app.render(true);
  }

  openOverlayFilePicker(form) {
    if (typeof FilePicker === "undefined") return;
    const current = readText(form, "overlayImage");
    const picker = new FilePicker({
      type: "imagevideo",
      current,
      callback: (path) => {
        setFieldValue(form, "overlayImage", path);
      }
    });
    picker.render(true);
  }

  normalizeImportPayload(json) {
    if (!json || typeof json !== "object") return null;
    const settings = json.settings ?? json;
    const playerLayouts = sanitizeLayouts(settings.playerLayouts ?? {});
    const sceneProfiles = settings.sceneProfiles && typeof settings.sceneProfiles === "object" ? settings.sceneProfiles : {};
    const sceneCamera = settings.sceneCamera && typeof settings.sceneCamera === "object" ? settings.sceneCamera : {};
    return {
      playerLayouts,
      sceneProfiles,
      sceneCamera
    };
  }

  configExportPayload() {
    return {
      moduleId: MODULE_ID,
      version: CONFIG_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      settings: {
        playerLayouts: sanitizeLayouts(getAllPlayerLayouts()),
        sceneProfiles: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES) ?? {}),
        sceneCamera: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA) ?? {})
      }
    };
  }

  async exportJsonConfig() {
    const payload = this.configExportPayload();
    const serialized = JSON.stringify(payload, null, 2);
    const filename = `${MODULE_ID}-config.json`;
    saveDataToFile(serialized, "application/json", filename);
    ui.notifications.info(localize("ui.config.notifications.exportedJson"));
  }

  async importJsonConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (_error) {
        ui.notifications.error(localize("ui.config.notifications.importFailed"));
        return;
      }
      const payload = this.normalizeImportPayload(parsed);
      if (!payload) {
        ui.notifications.error(localize("ui.config.notifications.importFailed"));
        return;
      }
      await game.settings.set(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS, payload.playerLayouts);
      await game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES, payload.sceneProfiles);
      await game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA, payload.sceneCamera);
      clearLoadedSceneProfileDraft(currentSceneId());
      applyCameraLayoutsNow();
      await this.render(true);
      ui.notifications.info(localize("ui.config.notifications.importedJson"));
    });
    input.click();
  }

  async resetCurrentSceneProfile() {
    const sceneId = currentSceneId();
    if (!sceneId) return;
    await resetSceneProfile(sceneId);
    clearLoadedSceneProfileDraft(sceneId);
    applyCameraLayoutsNow();
    await this.render(true);
    ui.notifications.info(localize("ui.config.notifications.sceneProfileReset"));
  }

  shouldValidateOverlay(formData) {
    if (!formData.overlayEnabled) return false;
    return Boolean(String(formData.overlayImage ?? "").trim());
  }

  imageLoadPromise(path) {
    return new Promise((resolve) => {
      const image = new Image();
      const timeoutId = window.setTimeout(() => {
        resolve(false);
      }, 8000);
      image.onload = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };
      image.onerror = () => {
        window.clearTimeout(timeoutId);
        resolve(false);
      };
      image.src = path;
    });
  }

  async validateOverlayImage(formData) {
    if (!this.shouldValidateOverlay(formData)) return true;
    const path = String(formData.overlayImage ?? "").trim();
    return this.imageLoadPromise(path);
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const sceneId = currentSceneId();
    const formData = readFormData(form);
    const overlayValid = await this.validateOverlayImage(formData);
    if (!overlayValid) {
      ui.notifications.error(localize("ui.config.notifications.overlayImageInvalid"));
      return;
    }
    const patch = buildLayoutPatch(formData);
    delete patch.nameStyle;
    const draftLayouts = loadedDraftLayouts(sceneId);
    if (sceneId && draftLayouts) {
      const layouts = sanitizeLayouts(draftLayouts);
      const current = layouts[this.selectedUserId] ?? {};
      layouts[this.selectedUserId] = foundry.utils.mergeObject(current, patch, { inplace: false });
      await setAllPlayerLayouts(layouts);
      await applySceneProfile(sceneId, layouts);
      clearLoadedSceneProfileDraft(sceneId);
    } else {
      const currentGlobalLayout = sanitizeLayout(getPlayerLayout(this.selectedUserId));
      const nextGlobalLayout = foundry.utils.mergeObject(currentGlobalLayout, patch, { inplace: false });
      await replacePlayerLayout(this.selectedUserId, nextGlobalLayout);
      if (sceneId) {
        const sceneLayouts = sanitizeLayouts(getSceneProfile()?.layouts ?? getAllPlayerLayouts());
        const currentSceneLayout = sceneLayouts[this.selectedUserId] ?? nextGlobalLayout;
        sceneLayouts[this.selectedUserId] = foundry.utils.mergeObject(currentSceneLayout, patch, { inplace: false });
        await applySceneProfile(sceneId, sceneLayouts);
      }
    }
    applyCameraLayoutsNow();
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | config saved`, { playerId: this.selectedUserId, patch });
  }

  async exportCurrentLayout(form) {
    const sceneId = currentSceneId();
    if (!this.selectedUserId || !sceneId) return;
    const formData = readFormData(form);
    const basePatch = buildLayoutPatch(formData);
    delete basePatch.nameStyle;
    const defaultName = game.i18n.localize(`${MODULE_ID}.macro.sceneDefaultName`);
    const promptMessage = localize("ui.config.prompts.macroName");
    const entered = window.prompt(promptMessage, defaultName);
    if (entered === null) return;
    const macroName = entered.trim() || defaultName;
    const draftLayouts = loadedDraftLayouts(sceneId);
    const currentSceneLayouts = getSceneProfile()?.layouts;
    const layouts = sanitizeLayouts(draftLayouts ?? currentSceneLayouts ?? getAllPlayerLayouts());
    layouts[this.selectedUserId] = foundry.utils.mergeObject(layouts[this.selectedUserId] ?? {}, basePatch, { inplace: false });
    const macro = await exportSceneProfileToMacro(sceneId, layouts, macroName);
    ui.notifications.info(localize("ui.config.notifications.exported"));
    console.debug(`${MODULE_ID} | scene config exported`, { sceneId, macroId: macro.id });
  }
}
