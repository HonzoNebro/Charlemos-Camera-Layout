import { MODULE_ID } from "./constants.js";
import { appId, rowHtml, sectionHtml, selectFromItems } from "./camera-config-ui.js";
import { currentSceneId, finalizeSubwindowSave, localize, usersForConfig } from "./camera-config-shared.js";
import { replaceAppContent } from "./dom-replace.js";
import { getSceneBackgroundStatus } from "./scene-background-renderer.js";
import { getSceneCamera, normalizeSceneCameraFit, resetSceneCamera, setSceneCamera } from "./scene-camera.js";

const STATUS_VALUES = new Set(["disabled", "waiting", "unavailable", "active"]);
let activeApp = null;

function titleKey() {
  return `${MODULE_ID}.ui.sceneBackground.title`;
}

function normalizedStatus(value) {
  return STATUS_VALUES.has(value) ? value : "waiting";
}

export function sceneBackgroundStatus(sceneCamera, status, sceneId) {
  if (!sceneCamera?.playerId) return "disabled";
  if (status?.sceneId !== sceneId || status?.playerId !== sceneCamera.playerId) return "waiting";
  return normalizedStatus(status.state);
}

function sourceOption(user, selectedId) {
  const selectedAttr = user.id === selectedId ? " selected" : "";
  const offlineSuffix = user.active ? "" : ` ${foundry.utils.escapeHTML(localize("ui.config.common.offline"))}`;
  return `<option value="${foundry.utils.escapeHTML(user.id)}"${selectedAttr}>${foundry.utils.escapeHTML(user.name)}${offlineSuffix}</option>`;
}

export function sourceSelectHtml(users, selectedId) {
  const disabledSelected = selectedId ? "" : " selected";
  const disabled = `<option value=""${disabledSelected}>${foundry.utils.escapeHTML(localize("ui.sceneBackground.source.disabled"))}</option>`;
  const options = users.map((user) => sourceOption(user, selectedId));
  if (selectedId && !users.some((user) => user.id === selectedId)) {
    options.unshift(
      `<option value="${foundry.utils.escapeHTML(selectedId)}" selected>${foundry.utils.escapeHTML(localize("ui.sceneBackground.source.unavailable").replace("{id}", selectedId))}</option>`
    );
  }
  return `<select name="playerId">${[disabled, ...options].join("")}</select>`;
}

function fitSelectHtml(fit) {
  return selectFromItems(
    "fit",
    normalizeSceneCameraFit(fit),
    ["cover", "contain", "fill"].map((id) => ({
      id,
      label: localize(`ui.sceneBackground.fit.${id}`)
    }))
  );
}

function statusHtml(state) {
  const normalized = normalizedStatus(state);
  return [
    `<div class="charlemos-scene-background-status charlemos-scene-background-status-${normalized}" data-scene-background-status="${normalized}">`,
    `<strong>${foundry.utils.escapeHTML(localize(`ui.sceneBackground.status.${normalized}`))}</strong>`,
    `<span>${foundry.utils.escapeHTML(localize(`ui.sceneBackground.status.${normalized}Desc`))}</span>`,
    `</div>`
  ].join("");
}

function configSection(context) {
  return sectionHtml(localize("ui.sceneBackground.section"), localize("ui.sceneBackground.sectionDesc"), [
    rowHtml(
      `${localize("ui.sceneBackground.fields.source")}<small class="charlemos-field-help">${localize("ui.sceneBackground.help.source")}</small>`,
      sourceSelectHtml(context.users, context.playerId)
    ),
    rowHtml(
      `${localize("ui.sceneBackground.fields.fit")}<small class="charlemos-field-help">${localize("ui.sceneBackground.help.fit")}</small>`,
      fitSelectHtml(context.fit)
    ),
    statusHtml(context.status)
  ]);
}

export function buildSceneBackgroundHtml(context) {
  if (!context.sceneId) {
    return [
      `<div class="charlemos-config-shell">`,
      `<h2>${context.title}</h2>`,
      sectionHtml(localize("ui.config.noScene.title"), localize("ui.config.noScene.description"), []),
      `</div>`
    ].join("");
  }
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(localize("ui.sceneBackground.description"))}</p>`,
    `<form id="${context.formId}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    configSection(context),
    `</div>`,
    `<div class="charlemos-actions">`,
    `<button type="submit">${foundry.utils.escapeHTML(localize("ui.sceneBackground.actions.save"))}</button>`,
    `<button type="button" data-action="reset">${foundry.utils.escapeHTML(localize("ui.sceneBackground.actions.disable"))}</button>`,
    `</div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export function sceneBackgroundSummary(sceneCamera, users, status, sceneId = currentSceneId()) {
  if (!sceneCamera?.playerId) return localize("ui.sceneBackground.cardDisabled");
  const source = users.find((user) => user.id === sceneCamera.playerId);
  const sourceName = source?.name ?? localize("ui.sceneBackground.summary.unavailableSource");
  const fit = localize(`ui.sceneBackground.fit.${normalizeSceneCameraFit(sceneCamera.fit)}`);
  const state = localize(`ui.sceneBackground.status.${sceneBackgroundStatus(sceneCamera, status, sceneId)}`);
  return `${sourceName} · ${fit} · ${state}`;
}

export function refreshSceneBackgroundConfigIfOpen() {
  return activeApp?.refreshIfOpen?.();
}

function readFormData(form) {
  return {
    playerId: form.elements.namedItem("playerId")?.value ?? "",
    fit: normalizeSceneCameraFit(form.elements.namedItem("fit")?.value)
  };
}

export class SceneBackgroundConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-scene-background-config`,
    tag: "section",
    window: {
      title: titleKey(),
      resizable: true
    },
    position: {
      width: 620,
      height: 520
    }
  };

  constructor(options = {}) {
    super(options);
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
    activeApp = this;
  }

  scopedId(suffix) {
    return `${appId(suffix)}-${this.id}`;
  }

  async _prepareContext() {
    const sceneId = currentSceneId();
    const sceneCamera = sceneId ? getSceneCamera() : null;
    const status = getSceneBackgroundStatus();
    return {
      title: game.i18n.localize(titleKey()),
      sceneId,
      formId: this.scopedId("scene-background-form"),
      users: usersForConfig(),
      playerId: sceneCamera?.playerId ?? "",
      fit: normalizeSceneCameraFit(sceneCamera?.fit),
      status: sceneBackgroundStatus(sceneCamera, status, sceneId)
    };
  }

  async _renderHTML(context) {
    return buildSceneBackgroundHtml(context);
  }

  _replaceHTML(result, content) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    const form = document.getElementById(this.scopedId("scene-background-form"));
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
    form.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button || button.dataset.action !== "reset") return;
      await this.resetBackground();
    });
  }

  async refreshIfOpen() {
    if (!document.getElementById(this.scopedId("scene-background-form"))) return;
    await this.render(true);
  }

  async close(options = {}) {
    if (activeApp === this) activeApp = null;
    return super.close(options);
  }

  notifySceneRequired() {
    ui.notifications.warn(localize("ui.config.notifications.sceneRequired"));
  }

  async finishSave(notificationKey) {
    await finalizeSubwindowSave(this, this.onSaved);
    ui.notifications.info(localize(notificationKey));
  }

  async saveForm(form) {
    const sceneId = currentSceneId();
    if (!sceneId) {
      this.notifySceneRequired();
      return;
    }
    const formData = readFormData(form);
    if (!formData.playerId) {
      await resetSceneCamera(sceneId);
      await this.finishSave("ui.sceneBackground.notifications.disabled");
      return;
    }
    await setSceneCamera(sceneId, formData.playerId, { fit: formData.fit });
    await this.finishSave("ui.sceneBackground.notifications.saved");
  }

  async resetBackground() {
    const sceneId = currentSceneId();
    if (!sceneId) {
      this.notifySceneRequired();
      return;
    }
    await resetSceneCamera(sceneId);
    await this.finishSave("ui.sceneBackground.notifications.disabled");
  }
}
