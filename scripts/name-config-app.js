import { MODULE_ID } from "./constants.js";
import { getAllPlayerLayouts, getPlayerLayout, replacePlayerLayout, setAllPlayerLayouts } from "./camera-style-service.js";
import { buildFormData, buildNameStylePatch } from "./camera-config-model.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { replaceAppContent } from "./dom-replace.js";
import { applySceneProfile, getSceneProfile, getSceneProfileLayout, sceneProfileEnabled } from "./scene-camera.js";
import { clearLoadedSceneProfileDraft, getLoadedSceneProfileDraft } from "./state.js";

function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
}

function titleKey() {
  return `${MODULE_ID}.ui.name.title`;
}

function usersForConfig() {
  return game.users.filter((user) => user.active);
}

function selectedUser(users, selectedUserId) {
  const selected = users.find((user) => user.id === selectedUserId);
  if (selected) return selected;
  return users[0] ?? null;
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
    nameVisible: readChecked(form, "nameVisible"),
    nameSource: readText(form, "nameSource"),
    nameText: readText(form, "nameText"),
    nameColorFromUser: readChecked(form, "nameColorFromUser"),
    nameColor: readText(form, "nameColor"),
    nameFont: readText(form, "nameFont"),
    namePosition: readText(form, "namePosition"),
    nameTextAlign: readText(form, "nameTextAlign"),
    nameFontWeight: readText(form, "nameFontWeight"),
    nameFontStyle: readText(form, "nameFontStyle")
  };
}

function optionTag(user, selectedId) {
  const selectedAttr = user.id === selectedId ? " selected" : "";
  return `<option value="${user.id}"${selectedAttr}>${foundry.utils.escapeHTML(user.name)}</option>`;
}

function playerSelectHtml(users, selectedId) {
  const options = users.map((user) => optionTag(user, selectedId)).join("");
  return `<select id="${MODULE_ID}-name-player-select" name="playerId">${options}</select>`;
}

function textInput(name, value) {
  return `<input type="text" name="${name}" value="${foundry.utils.escapeHTML(String(value ?? ""))}">`;
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

function selectFromItems(name, value, items) {
  const options = items
    .map((item) => {
      const selectedAttr = String(value ?? "") === item.id ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${item.label}</option>`;
    })
    .join("");
  return `<select name="${name}">${options}</select>`;
}

function nameTextAlignSelect(value) {
  const items = [
    { id: "left", label: localize("ui.config.nameAlign.left") },
    { id: "center", label: localize("ui.config.nameAlign.center") },
    { id: "right", label: localize("ui.config.nameAlign.right") },
    { id: "justify", label: localize("ui.config.nameAlign.justify") }
  ];
  return selectFromItems("nameTextAlign", value, items);
}

function nameFontWeightSelect(value) {
  const items = [
    { id: "400", label: localize("ui.config.nameWeight.400") },
    { id: "500", label: localize("ui.config.nameWeight.500") },
    { id: "600", label: localize("ui.config.nameWeight.600") },
    { id: "700", label: localize("ui.config.nameWeight.700") }
  ];
  return selectFromItems("nameFontWeight", value, items);
}

function nameFontStyleSelect(value) {
  const items = [
    { id: "normal", label: localize("ui.config.nameFontStyle.normal") },
    { id: "italic", label: localize("ui.config.nameFontStyle.italic") }
  ];
  return selectFromItems("nameFontStyle", value, items);
}

function normalizeFoundryFontOption(value, labelFallback = "") {
  const css = String(value ?? "").trim();
  if (!css) return null;
  const label = String(labelFallback || css).trim();
  return { css, label };
}

function collectFoundryFontOptions(raw) {
  const options = [];
  if (!raw) return options;
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (typeof item === "string") {
        const option = normalizeFoundryFontOption(item, item);
        if (option) options.push(option);
        return;
      }
      if (!item || typeof item !== "object") return;
      const css = item.family ?? item.fontFamily ?? item.css ?? item.id ?? "";
      const label = item.label ?? item.name ?? css;
      const option = normalizeFoundryFontOption(css, label);
      if (option) options.push(option);
    });
    return options;
  }
  if (typeof raw === "object") {
    Object.entries(raw).forEach(([key, value]) => {
      if (typeof value === "string") {
        const option = normalizeFoundryFontOption(key, value);
        if (option) options.push(option);
        return;
      }
      if (value && typeof value === "object") {
        const css = value.family ?? value.fontFamily ?? value.css ?? key;
        const label = value.label ?? value.name ?? value.family ?? key;
        const option = normalizeFoundryFontOption(css, label);
        if (option) options.push(option);
        return;
      }
      const option = normalizeFoundryFontOption(key, key);
      if (option) options.push(option);
    });
  }
  return options;
}

function foundryFontOptions() {
  const fontConfigClass = foundry?.applications?.settings?.menus?.FontConfig;
  if (!fontConfigClass) return [];
  let options = [];
  if (typeof fontConfigClass.getAvailableFontChoices === "function") {
    try {
      options = collectFoundryFontOptions(fontConfigClass.getAvailableFontChoices());
    } catch (_error) {
      options = [];
    }
  }
  if (options.length === 0 && typeof fontConfigClass.getAvailableFonts === "function") {
    try {
      options = collectFoundryFontOptions(fontConfigClass.getAvailableFonts());
    } catch (_error) {
      options = [];
    }
  }
  const deduped = [];
  const seen = new Set();
  options.forEach((option) => {
    const key = option.css.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(option);
  });
  deduped.sort((a, b) => a.label.localeCompare(b.label));
  return deduped;
}

function nameFontSelect(value) {
  const options = [{ css: "", label: localize("ui.config.font.inherit") }, ...foundryFontOptions()];
  const known = options.find((item) => item.css === (value ?? ""));
  const dynamic = !known && value ? [{ css: value, label: `${localize("ui.config.font.custom")} (${value})` }] : [];
  const all = [...options, ...dynamic];
  const optionTags = all
    .map((item) => {
      const selectedAttr = item.css === (value ?? "") ? " selected" : "";
      return `<option value="${foundry.utils.escapeHTML(item.css)}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="nameFont">${optionTags}</select>`;
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

function nameSection(formData) {
  return sectionHtml(localize("ui.config.sections.name"), localize("ui.config.sections.nameDesc"), [
    rowWithHelp("nameVisible", checkboxInput("nameVisible", formData.nameVisible), "nameVisible"),
    rowWithHelp("nameSource", nameSourceSelect(formData.nameSource), "nameSource"),
    rowWithHelp("nameText", textInput("nameText", formData.nameText), "nameText"),
    rowWithHelp("nameColorFromUser", checkboxInput("nameColorFromUser", formData.nameColorFromUser), "nameColorFromUser"),
    rowWithHelp("nameColor", colorInput("nameColor", formData.nameColor), "nameColor"),
    rowWithHelp("nameFont", nameFontSelect(formData.nameFont), "nameFont"),
    rowWithHelp("nameFontWeight", nameFontWeightSelect(formData.nameFontWeight), "nameFontWeight"),
    rowWithHelp("nameFontStyle", nameFontStyleSelect(formData.nameFontStyle), "nameFontStyle"),
    rowWithHelp("nameTextAlign", nameTextAlignSelect(formData.nameTextAlign), "nameTextAlign"),
    rowWithHelp("namePosition", namePositionSelect(formData.namePosition), "namePosition")
  ]);
}

function appId() {
  return `${MODULE_ID}-name-form`;
}

function actionsHtml() {
  return [
    `<div class="charlemos-actions">`,
    `<button type="submit">${localize("ui.config.actions.save")}</button>`,
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
    nameSection(context.formData),
    `</div>`,
    actionsHtml(),
    `</form>`,
    `</div>`
  ].join("");
}

export class NameConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-name-config`,
    tag: "section",
    window: {
      title: titleKey()
    },
    position: {
      width: 560,
      height: 620
    }
  };

  constructor(options = {}) {
    super(options);
    this.selectedUserId = options.selectedUserId ?? game.user?.id ?? null;
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
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
      title: game.i18n.localize(titleKey()),
      users,
      selectedUserId: this.selectedUserId,
      formData: buildFormData(layout)
    };
  }

  async _renderHTML(context, _options) {
    return buildHtml(context);
  }

  _replaceHTML(result, content, _options) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    this.bindPlayerChange();
    this.bindSubmit();
    this.bindNameSourceMode();
    this.bindNameColorMode();
  }

  bindPlayerChange() {
    const select = document.getElementById(`${MODULE_ID}-name-player-select`);
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

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const sceneId = currentSceneId();
    const formData = readFormData(form);
    const patch = buildNameStylePatch(formData);
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
    if (this.onSaved) this.onSaved();
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | name config saved`, { playerId: this.selectedUserId, patch });
  }
}
