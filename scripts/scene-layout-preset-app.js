import { MODULE_ID } from "./constants.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, checkboxInput, numberInput, rowWithHelp, sectionHtml, selectFromItems } from "./camera-config-ui.js";
import { currentSceneId, localize, usersForConfig } from "./camera-config-shared.js";
import { getAllPlayerLayouts } from "./camera-style-service.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { buildSceneLayoutPreset, getNarrativeSceneLayoutPresetIds } from "./scene-layout-presets.js";
import { applySceneProfile, getSceneProfile } from "./scene-camera.js";

function titleKey() {
  return `${MODULE_ID}.ui.scenePresets.title`;
}

function layoutTypeSelect(value) {
  return selectFromItems("layoutType", value, [
    { id: "grid", label: localize("ui.scenePresets.layoutType.grid") },
    { id: "narrative", label: localize("ui.scenePresets.layoutType.narrative") }
  ]);
}

function narrativePresetSelect(value) {
  const items = getNarrativeSceneLayoutPresetIds().map((id) => ({
    id,
    label: localize(`ui.scenePresets.preset.${id}`)
  }));
  return selectFromItems("presetId", value, items);
}

function unitModeSelect(value) {
  return selectFromItems("unitMode", value, [
    { id: "responsive", label: localize("ui.scenePresets.unitMode.responsive") },
    { id: "px", label: localize("ui.scenePresets.unitMode.px") }
  ]);
}

function userRow(userState) {
  const offlineSuffix = userState.active ? "" : ` ${foundry.utils.escapeHTML(localize("ui.config.common.offline"))}`;
  return [
    `<div class="charlemos-scene-user-row">`,
    `<label class="charlemos-scene-user-toggle">${checkboxInput(`include-${userState.id}`, userState.include)}<span>${foundry.utils.escapeHTML(userState.name)}${offlineSuffix}</span></label>`,
    `<input type="number" name="order-${userState.id}" value="${userState.order}" min="1" step="1">`,
    `</div>`
  ].join("");
}

function usersSection(userStates) {
  return sectionHtml(localize("ui.scenePresets.users"), localize("ui.scenePresets.usersDesc"), userStates.map((user) => userRow(user)));
}

function readFormData(form, fallbackUsers) {
  const userStates = fallbackUsers.map((user) => ({
    id: user.id,
    name: user.name,
    include: Boolean(form.elements.namedItem(`include-${user.id}`)?.checked),
    order: Number.parseInt(String(form.elements.namedItem(`order-${user.id}`)?.value ?? user.order), 10) || user.order
  }));
  return {
    layoutType: form.elements.namedItem("layoutType")?.value ?? "grid",
    presetId: form.elements.namedItem("presetId")?.value ?? "roleplayWide",
    rows: form.elements.namedItem("rows")?.value ?? "2",
    cols: form.elements.namedItem("cols")?.value ?? "2",
    unitMode: form.elements.namedItem("unitMode")?.value ?? "responsive",
    gap: form.elements.namedItem("gap")?.value ?? "2",
    marginX: form.elements.namedItem("marginX")?.value ?? "2",
    marginY: form.elements.namedItem("marginY")?.value ?? "2",
    users: userStates
  };
}

function layoutModeRows(formData) {
  const isGrid = formData.layoutType !== "narrative";
  const gridDisplay = isGrid ? "" : ' style="display:none"';
  const narrativeDisplay = isGrid ? ' style="display:none"' : "";
  return [
    rowWithHelp("scenePresetLayoutType", layoutTypeSelect(formData.layoutType), "scenePresetLayoutType"),
    `<div data-scene-grid-fields${gridDisplay}>`,
    rowWithHelp("scenePresetRows", numberInput("rows", formData.rows, 1, 6, 1), "scenePresetRows"),
    rowWithHelp("scenePresetCols", numberInput("cols", formData.cols, 1, 8, 1), "scenePresetCols"),
    `</div>`,
    `<div data-scene-narrative-fields${narrativeDisplay}>`,
    rowWithHelp("scenePresetNarrativeId", narrativePresetSelect(formData.presetId), "scenePresetNarrativeId"),
    `</div>`,
    rowWithHelp("scenePresetUnitMode", unitModeSelect(formData.unitMode), "scenePresetUnitMode"),
    rowWithHelp("scenePresetGap", numberInput("gap", formData.gap, 0, 128, 1), "scenePresetGap"),
    rowWithHelp("scenePresetMarginX", numberInput("marginX", formData.marginX, 0, 256, 1), "scenePresetMarginX"),
    rowWithHelp("scenePresetMarginY", numberInput("marginY", formData.marginY, 0, 256, 1), "scenePresetMarginY")
  ];
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.description)}</p>`,
    `<form id="${context.formId}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    sectionHtml(localize("ui.scenePresets.section"), localize("ui.scenePresets.sectionDesc"), layoutModeRows(context.formData)),
    usersSection(context.formData.users),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.scenePresets.actions.apply")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

function defaultUserStates() {
  return usersForConfig().map((user, index) => ({
    id: user.id,
    name: user.name,
    active: Boolean(user.active),
    include: Boolean(user.active),
    order: index + 1
  }));
}

function orderedSelectedUserIds(userStates) {
  return [...userStates]
    .filter((user) => user.include)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((user) => user.id);
}

function queryUserVideo(userId) {
  return document.querySelector(`.camera-view[data-user="${userId}"] video, .camera-view[data-user-id="${userId}"] video`);
}

function liveFeedDimensions(videoElement) {
  const width = Number(videoElement?.videoWidth);
  const height = Number(videoElement?.videoHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function representativeFeedDimensions(selectedUserIds) {
  const sizes = [];
  for (const userId of selectedUserIds) {
    const size = liveFeedDimensions(queryUserVideo(userId));
    if (size) sizes.push(size);
  }
  if (sizes.length === 0) {
    document.querySelectorAll(".camera-view video").forEach((videoElement) => {
      const size = liveFeedDimensions(videoElement);
      if (size) sizes.push(size);
    });
  }
  if (sizes.length === 0) return { width: 300, height: 300 };
  return sizes.sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

export class SceneLayoutPresetApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-scene-presets`,
    tag: "section",
    window: {
      title: titleKey(),
      resizable: true
    },
    position: {
      width: 760,
      height: 780
    }
  };

  constructor(options = {}) {
    super(options);
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
    this.formData = {
      layoutType: "grid",
      presetId: "roleplayWide",
      rows: 2,
      cols: 2,
      unitMode: "responsive",
      gap: 2,
      marginX: 2,
      marginY: 2,
      users: defaultUserStates()
    };
  }

  scopedId(suffix) {
    return `${appId(suffix)}-${this.id}`;
  }

  async _prepareContext() {
    const currentUsers = defaultUserStates();
    const currentById = new Map(currentUsers.map((user) => [user.id, user]));
    const preservedUsers = (this.formData.users ?? []).map((user) => ({
      ...currentById.get(user.id),
      ...user
    }));
    const mergedUsers = [
      ...preservedUsers.filter((user) => currentById.has(user.id)),
      ...currentUsers.filter((user) => !preservedUsers.some((state) => state.id === user.id))
    ];
    this.formData.users = mergedUsers;
    return {
      title: game.i18n.localize(titleKey()),
      description: localize("ui.scenePresets.description"),
      formId: this.scopedId("scene-preset-form"),
      formData: this.formData
    };
  }

  async _renderHTML(context) {
    return buildHtml(context);
  }

  _replaceHTML(result, content) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    const form = document.getElementById(this.scopedId("scene-preset-form"));
    if (!form) return;
    const layoutType = form.elements.namedItem("layoutType");
    const syncLayoutMode = () => {
      const isGrid = (layoutType?.value ?? "grid") !== "narrative";
      const gridFields = form.querySelector("[data-scene-grid-fields]");
      const narrativeFields = form.querySelector("[data-scene-narrative-fields]");
      if (gridFields) gridFields.style.display = isGrid ? "" : "none";
      if (narrativeFields) narrativeFields.style.display = isGrid ? "none" : "";
    };
    if (layoutType) layoutType.addEventListener("change", syncLayoutMode);
    syncLayoutMode();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.applyPreset(form);
    });
  }

  async applyPreset(form) {
    const sceneId = currentSceneId();
    if (!sceneId) return;
    this.formData = readFormData(form, this.formData.users);

    const orderedUserIds = orderedSelectedUserIds(this.formData.users);
    if (orderedUserIds.length === 0) {
      ui.notifications.warn(localize("ui.scenePresets.notifications.noUsers"));
      return;
    }

    const built = buildSceneLayoutPreset(orderedUserIds, {
      layoutType: this.formData.layoutType,
      presetId: this.formData.presetId,
      rows: this.formData.rows,
      cols: this.formData.cols,
      unitMode: this.formData.unitMode,
      gap: this.formData.gap,
      marginX: this.formData.marginX,
      marginY: this.formData.marginY,
      ...representativeFeedDimensions(orderedUserIds),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });

    const baseLayouts = foundry.utils.deepClone(getSceneProfile()?.layouts ?? getAllPlayerLayouts() ?? {});
    for (const [userId, patch] of Object.entries(built.layouts)) {
      const current = baseLayouts[userId] ?? {};
      baseLayouts[userId] = foundry.utils.mergeObject(current, patch, { inplace: false });
    }

    await applySceneProfile(sceneId, baseLayouts, { cameraControlMode: "module" });
    applyCameraLayoutsNow();
    if (this.onSaved) this.onSaved();

    if (built.ignoredUserIds.length > 0) {
      ui.notifications.warn(localize("ui.scenePresets.notifications.partial").replace("{count}", String(built.ignoredUserIds.length)));
      return;
    }
    ui.notifications.info(localize("ui.scenePresets.notifications.applied"));
  }
}
