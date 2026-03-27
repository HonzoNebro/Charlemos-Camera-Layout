import { MODULE_ID } from "./constants.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, checkboxInput, numberInput, rowWithHelp, sectionHtml, selectFromItems } from "./camera-config-ui.js";
import { currentSceneId, localize, usersForConfig } from "./camera-config-shared.js";
import { getAllPlayerLayouts } from "./camera-style-service.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { buildSceneLayoutPreset, getSceneLayoutPresetIds } from "./scene-layout-presets.js";
import { applySceneProfile, getSceneProfile } from "./scene-camera.js";

function titleKey() {
  return `${MODULE_ID}.ui.scenePresets.title`;
}

function presetSelect(value) {
  const items = getSceneLayoutPresetIds().map((id) => ({
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
  return [
    `<div class="charlemos-scene-user-row">`,
    `<label class="charlemos-scene-user-toggle">${checkboxInput(`include-${userState.id}`, userState.include)}<span>${foundry.utils.escapeHTML(userState.name)}</span></label>`,
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
    presetId: form.elements.namedItem("presetId")?.value ?? "grid2x2",
    unitMode: form.elements.namedItem("unitMode")?.value ?? "responsive",
    gap: form.elements.namedItem("gap")?.value ?? "2",
    marginX: form.elements.namedItem("marginX")?.value ?? "2",
    marginY: form.elements.namedItem("marginY")?.value ?? "2",
    users: userStates
  };
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.description)}</p>`,
    `<form id="${appId("scene-preset-form")}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    sectionHtml(localize("ui.scenePresets.section"), localize("ui.scenePresets.sectionDesc"), [
      rowWithHelp("scenePresetId", presetSelect(context.formData.presetId), "scenePresetId"),
      rowWithHelp("scenePresetUnitMode", unitModeSelect(context.formData.unitMode), "scenePresetUnitMode"),
      rowWithHelp("scenePresetGap", numberInput("gap", context.formData.gap, 0, 128, 1), "scenePresetGap"),
      rowWithHelp("scenePresetMarginX", numberInput("marginX", context.formData.marginX, 0, 256, 1), "scenePresetMarginX"),
      rowWithHelp("scenePresetMarginY", numberInput("marginY", context.formData.marginY, 0, 256, 1), "scenePresetMarginY")
    ]),
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
    include: true,
    order: index + 1
  }));
}

function orderedSelectedUserIds(userStates) {
  return [...userStates]
    .filter((user) => user.include)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((user) => user.id);
}

export class SceneLayoutPresetApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-scene-presets`,
    tag: "section",
    window: {
      title: titleKey()
    },
    position: {
      width: 560,
      height: 640
    }
  };

  constructor(options = {}) {
    super(options);
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
    this.formData = {
      presetId: "grid2x2",
      unitMode: "responsive",
      gap: 2,
      marginX: 2,
      marginY: 2,
      users: defaultUserStates()
    };
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
    const form = document.getElementById(appId("scene-preset-form"));
    if (!form) return;
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

    const built = buildSceneLayoutPreset(orderedUserIds, this.formData.presetId, {
      unitMode: this.formData.unitMode,
      gap: this.formData.gap,
      marginX: this.formData.marginX,
      marginY: this.formData.marginY,
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
