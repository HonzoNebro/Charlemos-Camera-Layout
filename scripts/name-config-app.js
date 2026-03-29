import { MODULE_ID } from "./constants.js";
import { buildFormData, buildNameStylePatch } from "./camera-config-model.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, checkboxInput, colorInput, numberInput, rowWithHelp, sectionHtml, selectFromItems, textInput } from "./camera-config-ui.js";
import { currentSceneId, finalizeSubwindowSave, loadLayoutForUser, localize, readChecked, readText, saveLayoutPatchForUser, selectedUser, usersForConfig } from "./camera-config-shared.js";

function titleKey() {
  return `${MODULE_ID}.ui.name.title`;
}

function readFormData(form) {
  return {
    nameVisible: readChecked(form, "nameVisible"),
    nameSource: readText(form, "nameSource"),
    nameText: readText(form, "nameText"),
    nameColorFromUser: readChecked(form, "nameColorFromUser"),
    nameColor: readText(form, "nameColor"),
    nameFont: readText(form, "nameFont"),
    nameFontSize: readText(form, "nameFontSize"),
    nameLineHeight: readText(form, "nameLineHeight"),
    namePosition: readText(form, "namePosition"),
    nameOffset: readText(form, "nameOffset"),
    namePaddingX: readText(form, "namePaddingX"),
    namePaddingY: readText(form, "namePaddingY"),
    nameCustomBackground: readChecked(form, "nameCustomBackground"),
    nameBackgroundColor: readText(form, "nameBackgroundColor"),
    nameBackgroundOpacity: readText(form, "nameBackgroundOpacity"),
    nameCustomBorder: readChecked(form, "nameCustomBorder"),
    nameBorderColor: readText(form, "nameBorderColor"),
    nameBorderWidth: readText(form, "nameBorderWidth"),
    nameBorderRadius: readText(form, "nameBorderRadius"),
    nameTextAlign: readText(form, "nameTextAlign"),
    nameFontWeight: readText(form, "nameFontWeight"),
    nameFontStyle: readText(form, "nameFontStyle")
  };
}

function namePositionSelect(value) {
  const items = [
    { id: "top", label: localize("ui.config.namePosition.top") },
    { id: "bottom", label: localize("ui.config.namePosition.bottom") }
  ];
  return selectFromItems("namePosition", value, items);
}

function nameSourceSelect(value) {
  const items = [
    { id: "user", label: localize("ui.config.nameSource.user") },
    { id: "character", label: localize("ui.config.nameSource.character") },
    { id: "alternate", label: localize("ui.config.nameSource.alternate") },
    { id: "custom", label: localize("ui.config.nameSource.custom") }
  ];
  return selectFromItems("nameSource", value, items);
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

function nameTextSection(formData) {
  return sectionHtml(localize("ui.config.sections.name"), localize("ui.config.sections.nameDesc"), [
    rowWithHelp("nameVisible", checkboxInput("nameVisible", formData.nameVisible), "nameVisible"),
    rowWithHelp("nameSource", nameSourceSelect(formData.nameSource), "nameSource"),
    rowWithHelp("nameText", textInput("nameText", formData.nameText), "nameText"),
    rowWithHelp("nameColorFromUser", checkboxInput("nameColorFromUser", formData.nameColorFromUser), "nameColorFromUser"),
    rowWithHelp("nameColor", colorInput("nameColor", formData.nameColor), "nameColor"),
    rowWithHelp("nameFont", nameFontSelect(formData.nameFont), "nameFont"),
    rowWithHelp("nameFontSize", textInput("nameFontSize", formData.nameFontSize), "nameFontSize"),
    rowWithHelp("nameLineHeight", textInput("nameLineHeight", formData.nameLineHeight), "nameLineHeight"),
    rowWithHelp("nameFontWeight", nameFontWeightSelect(formData.nameFontWeight), "nameFontWeight"),
    rowWithHelp("nameFontStyle", nameFontStyleSelect(formData.nameFontStyle), "nameFontStyle"),
    rowWithHelp("nameTextAlign", nameTextAlignSelect(formData.nameTextAlign), "nameTextAlign")
  ]);
}

function namePlateSection(formData) {
  return sectionHtml(localize("ui.config.sections.namePlate"), localize("ui.config.sections.namePlateDesc"), [
    rowWithHelp("namePosition", namePositionSelect(formData.namePosition), "namePosition"),
    rowWithHelp("nameOffset", textInput("nameOffset", formData.nameOffset), "nameOffset"),
    rowWithHelp("namePaddingX", textInput("namePaddingX", formData.namePaddingX), "namePaddingX"),
    rowWithHelp("namePaddingY", textInput("namePaddingY", formData.namePaddingY), "namePaddingY"),
    rowWithHelp("nameCustomBackground", checkboxInput("nameCustomBackground", formData.nameCustomBackground), "nameCustomBackground"),
    rowWithHelp("nameBackgroundColor", colorInput("nameBackgroundColor", formData.nameBackgroundColor), "nameBackgroundColor"),
    rowWithHelp("nameBackgroundOpacity", numberInput("nameBackgroundOpacity", formData.nameBackgroundOpacity, 0, 1, 0.05), "nameBackgroundOpacity"),
    rowWithHelp("nameCustomBorder", checkboxInput("nameCustomBorder", formData.nameCustomBorder), "nameCustomBorder"),
    rowWithHelp("nameBorderColor", colorInput("nameBorderColor", formData.nameBorderColor), "nameBorderColor"),
    rowWithHelp("nameBorderWidth", textInput("nameBorderWidth", formData.nameBorderWidth), "nameBorderWidth"),
    rowWithHelp("nameBorderRadius", textInput("nameBorderRadius", formData.nameBorderRadius), "nameBorderRadius")
  ]);
}

function noSceneHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.playerName)}</p>`,
    sectionHtml(localize("ui.config.noScene.title"), localize("ui.config.noScene.description"), []),
    `</div>`
  ].join("");
}

function buildHtml(context) {
  if (!context.sceneId) return noSceneHtml(context);
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.playerName)}</p>`,
    `<form id="${context.formId}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    nameTextSection(context.formData),
    namePlateSection(context.formData),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.config.actions.save")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export class NameConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-name-config`,
    tag: "section",
    window: {
      title: titleKey(),
      resizable: true
    },
    position: {
      width: 760,
      height: 840
    }
  };

  constructor(options = {}) {
    super(options);
    this.selectedUserId = options.selectedUserId ?? game.user?.id ?? null;
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
  }

  scopedId(suffix) {
    return `${appId(suffix)}-${this.id}`;
  }

  async _prepareContext() {
    const users = usersForConfig();
    const selected = selectedUser(users, this.selectedUserId);
    this.selectedUserId = selected?.id ?? null;
    const layout = loadLayoutForUser(this.selectedUserId);
    return {
      title: game.i18n.localize(titleKey()),
      playerName: selected?.name ?? "",
      sceneId: currentSceneId(),
      formId: this.scopedId("name-form"),
      formData: buildFormData(layout)
    };
  }

  async _renderHTML(context) {
    return buildHtml(context);
  }

  _replaceHTML(result, content) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    const form = document.getElementById(this.scopedId("name-form"));
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
    this.bindNameSourceMode(form);
    this.bindNameColorMode(form);
    this.bindNameBackgroundMode(form);
    this.bindNameBorderMode(form);
  }

  bindNameSourceMode(form) {
    const source = form.elements.namedItem("nameSource");
    if (!source) return;
    const sync = () => {
      const customInput = form.elements.namedItem("nameText");
      if (!customInput) return;
      customInput.disabled = readText(form, "nameSource") !== "custom";
    };
    source.addEventListener("change", sync);
    sync();
  }

  bindNameColorMode(form) {
    const source = form.elements.namedItem("nameColorFromUser");
    if (!source) return;
    const sync = () => {
      const colorInput = form.elements.namedItem("nameColor");
      if (!colorInput) return;
      colorInput.disabled = readChecked(form, "nameColorFromUser");
    };
    source.addEventListener("change", sync);
    sync();
  }

  bindNameBackgroundMode(form) {
    const source = form.elements.namedItem("nameCustomBackground");
    if (!source) return;
    const sync = () => {
      const enabled = readChecked(form, "nameCustomBackground");
      const colorInput = form.elements.namedItem("nameBackgroundColor");
      const opacityInput = form.elements.namedItem("nameBackgroundOpacity");
      if (colorInput) colorInput.disabled = !enabled;
      if (opacityInput) opacityInput.disabled = !enabled;
    };
    source.addEventListener("change", sync);
    sync();
  }

  bindNameBorderMode(form) {
    const source = form.elements.namedItem("nameCustomBorder");
    if (!source) return;
    const sync = () => {
      const enabled = readChecked(form, "nameCustomBorder");
      const colorInput = form.elements.namedItem("nameBorderColor");
      const widthInput = form.elements.namedItem("nameBorderWidth");
      if (colorInput) colorInput.disabled = !enabled;
      if (widthInput) widthInput.disabled = !enabled;
    };
    source.addEventListener("change", sync);
    sync();
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    if (!currentSceneId()) {
      ui.notifications.warn(localize("ui.config.notifications.sceneRequired"));
      return;
    }
    const patch = buildNameStylePatch(readFormData(form));
    await saveLayoutPatchForUser(this.selectedUserId, patch);
    await finalizeSubwindowSave(this, this.onSaved);
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | name config saved`, { playerId: this.selectedUserId, patch });
  }
}
