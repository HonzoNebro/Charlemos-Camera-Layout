import { MODULE_ID } from "./constants.js";
import { exportSceneProfileToMacro } from "./macro-exporter.js";
import { buildFormData } from "./camera-config-model.js";
import { replaceAppContent } from "./dom-replace.js";
import { EffectsConfigApp } from "./effects-config-app.js";
import { LayoutConfigApp } from "./layout-config-app.js";
import { NameConfigApp } from "./name-config-app.js";
import { OverlayConfigApp } from "./overlay-config-app.js";
import {
  appId,
  helpText,
  playerSelectHtml,
  rowHtml,
  sectionHtml
} from "./camera-config-ui.js";
import {
  configExportPayload,
  currentSceneId,
  importJsonConfigFile,
  loadLayoutForUser,
  localize,
  loadedDraftLayouts,
  resetLayoutForUser,
  sanitizeLayouts,
  selectedUser,
  usersForConfig
} from "./camera-config-shared.js";
import { getAllPlayerLayouts } from "./camera-style-service.js";
import { getSceneProfile } from "./scene-camera.js";

function titleKey() {
  return `${MODULE_ID}.ui.config.title`;
}

function cropSummary(formData) {
  const values = [
    formData.cropTop ? `T ${formData.cropTop}` : null,
    formData.cropRight ? `R ${formData.cropRight}` : null,
    formData.cropBottom ? `B ${formData.cropBottom}` : null,
    formData.cropLeft ? `L ${formData.cropLeft}` : null
  ].filter(Boolean);
  return values.join(" · ") || localize("ui.config.summary.none");
}

function effectsSummary(formData) {
  const values = [];
  if (formData.transform) values.push(localize("ui.config.fields.transform"));
  if (formData.filter) values.push(localize("ui.config.fields.filter"));
  if (formData.clipPath) values.push(localize("ui.config.fields.clipPath"));
  if (formData.geometryBorderRadius) values.push(localize("ui.config.fields.geometryBorderRadius"));
  return values.join(" · ") || localize("ui.config.summary.none");
}

function overlaySummary(formData) {
  if (!formData.overlayEnabled) return localize("ui.config.common.disabled");
  const values = [localize("ui.config.common.enabled")];
  if (formData.overlayImage) values.push(localize("ui.config.fields.overlayImage"));
  values.push(localize(`ui.config.overlayFit.${formData.overlayFitMode || "auto"}`));
  const anchorKeyMap = {
    center: "center",
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
    "top-left": "topLeft",
    "top-right": "topRight",
    "bottom-left": "bottomLeft",
    "bottom-right": "bottomRight"
  };
  values.push(localize(`ui.config.overlayAnchor.${anchorKeyMap[formData.overlayAnchor || "center"]}`));
  return values.join(" · ");
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

function nameSummary(formData) {
  const visible = formData.nameVisible ? localize("ui.config.common.enabled") : localize("ui.config.common.disabled");
  return [
    `${localize("ui.config.fields.nameVisible")}: ${visible}`,
    `${localize("ui.config.fields.nameSource")}: ${nameSourceLabel(formData.nameSource)}`,
    `${localize("ui.config.fields.namePosition")}: ${namePositionLabel(formData.namePosition)}`
  ].join(" · ");
}

function buttonCard(action, title, description, summary) {
  return [
    `<section class="charlemos-config-card">`,
    `<div class="charlemos-config-card-copy">`,
    `<h3>${foundry.utils.escapeHTML(title)}</h3>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(description)}</p>`,
    `<p class="charlemos-config-card-summary">${foundry.utils.escapeHTML(summary)}</p>`,
    `</div>`,
    `<button type="button" data-action="${action}">${foundry.utils.escapeHTML(title)}</button>`,
    `</section>`
  ].join("");
}

function toolsSection(formData) {
  return sectionHtml(localize("ui.config.sections.tools"), localize("ui.config.sections.toolsDesc"), [
    `<div class="charlemos-config-grid">`,
    buttonCard(
      "open-layout-config",
      localize("ui.config.actions.openLayoutConfig"),
      localize("ui.config.sections.layoutDesc"),
      cropSummary(formData)
    ),
    buttonCard(
      "open-effects-config",
      localize("ui.config.actions.openEffectsConfig"),
      localize("ui.config.sections.effectsDesc"),
      effectsSummary(formData)
    ),
    buttonCard(
      "open-overlay-config",
      localize("ui.config.actions.openOverlayConfig"),
      localize("ui.config.sections.overlayDesc"),
      overlaySummary(formData)
    ),
    buttonCard(
      "open-name-config",
      localize("ui.config.actions.openNameConfig"),
      localize("ui.config.sections.nameDesc"),
      nameSummary(formData)
    ),
    `</div>`
  ]);
}

function actionsHtml() {
  return [
    `<div class="charlemos-actions">`,
    `<button type="button" data-action="export">${localize("ui.config.actions.export")}</button>`,
    `<button type="button" data-action="export-json">${localize("ui.config.actions.exportJson")}</button>`,
    `<button type="button" data-action="import-json">${localize("ui.config.actions.importJson")}</button>`,
    `<button type="button" data-action="reset-current-player">${localize("ui.config.actions.resetCurrentPlayer")}</button>`,
    `</div>`
  ].join("");
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    rowHtml(`${localize("ui.config.fields.player")}${helpText("player")}`, playerSelectHtml(context.users, context.selectedUserId)),
    `<form id="${appId("hub-form")}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    toolsSection(context.formData),
    `</div>`,
    actionsHtml(),
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
      height: 560
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
    const layout = loadLayoutForUser(this.selectedUserId);
    return {
      title: game.i18n.localize(titleKey()),
      users,
      sceneId: currentSceneId(),
      selectedUserId: this.selectedUserId,
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
    this.bindPlayerChange();
    this.bindActions();
  }

  bindPlayerChange() {
    const select = document.getElementById(`${MODULE_ID}-player-select`);
    if (!select) return;
    select.addEventListener("change", (event) => {
      this.selectedUserId = event.currentTarget.value;
      this.render(true);
    });
  }

  bindActions() {
    const root = document.getElementById(appId("hub-form"));
    if (!root) return;
    root.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "open-layout-config") this.openLayoutConfig();
      if (action === "open-effects-config") this.openEffectsConfig();
      if (action === "open-overlay-config") this.openOverlayConfig();
      if (action === "open-name-config") this.openNameConfig();
      if (action === "export") await this.exportCurrentLayout();
      if (action === "export-json") await this.exportJsonConfig();
      if (action === "import-json") await this.importJsonConfig();
      if (action === "reset-current-player") await this.resetCurrentPlayer();
    });
  }

  openLayoutConfig() {
    if (!this.selectedUserId) return;
    new LayoutConfigApp({ selectedUserId: this.selectedUserId, onSaved: () => this.render(true) }).render(true);
  }

  openEffectsConfig() {
    if (!this.selectedUserId) return;
    new EffectsConfigApp({ selectedUserId: this.selectedUserId, onSaved: () => this.render(true) }).render(true);
  }

  openOverlayConfig() {
    if (!this.selectedUserId) return;
    new OverlayConfigApp({ selectedUserId: this.selectedUserId, onSaved: () => this.render(true) }).render(true);
  }

  openNameConfig() {
    if (!this.selectedUserId) return;
    new NameConfigApp({ selectedUserId: this.selectedUserId, onSaved: () => this.render(true) }).render(true);
  }

  async exportJsonConfig() {
    const payload = configExportPayload();
    saveDataToFile(JSON.stringify(payload, null, 2), "application/json", `${MODULE_ID}-config.json`);
    ui.notifications.info(localize("ui.config.notifications.exportedJson"));
  }

  async importJsonConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ok = await importJsonConfigFile(file);
      if (!ok) {
        ui.notifications.error(localize("ui.config.notifications.importFailed"));
        return;
      }
      await this.render(true);
      ui.notifications.info(localize("ui.config.notifications.importedJson"));
    });
    input.click();
  }

  async resetCurrentPlayer() {
    if (!this.selectedUserId) return;
    const confirmed = window.confirm(localize("ui.config.prompts.resetCurrentPlayer"));
    if (!confirmed) return;
    const ok = await resetLayoutForUser(this.selectedUserId);
    if (!ok) return;
    await this.render(true);
    ui.notifications.info(localize("ui.config.notifications.currentPlayerReset"));
  }

  async exportCurrentLayout() {
    const sceneId = currentSceneId();
    if (!this.selectedUserId || !sceneId) return;
    const defaultName = game.i18n.localize(`${MODULE_ID}.macro.sceneDefaultName`);
    const entered = window.prompt(localize("ui.config.prompts.macroName"), defaultName);
    if (entered === null) return;
    const macroName = entered.trim() || defaultName;
    const draftLayouts = loadedDraftLayouts(sceneId);
    const currentSceneLayouts = getSceneProfile()?.layouts;
    const layouts = sanitizeLayouts(draftLayouts ?? currentSceneLayouts ?? getAllPlayerLayouts());
    const macro = await exportSceneProfileToMacro(sceneId, layouts, macroName);
    ui.notifications.info(localize("ui.config.notifications.exported"));
    console.debug(`${MODULE_ID} | scene config exported`, { sceneId, macroId: macro.id });
  }
}
