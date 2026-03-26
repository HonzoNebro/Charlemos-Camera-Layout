import { MODULE_ID } from "./constants.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, numberInput, rowWithHelp, sectionHtml, selectFromItems } from "./camera-config-ui.js";
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

function readFormData(form) {
  return {
    presetId: form.elements.namedItem("presetId")?.value ?? "grid2x2",
    gap: form.elements.namedItem("gap")?.value ?? "8",
    marginX: form.elements.namedItem("marginX")?.value ?? "8",
    marginY: form.elements.namedItem("marginY")?.value ?? "8"
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
      rowWithHelp("scenePresetGap", numberInput("gap", context.formData.gap, 0, 128, 1), "scenePresetGap"),
      rowWithHelp("scenePresetMarginX", numberInput("marginX", context.formData.marginX, 0, 256, 1), "scenePresetMarginX"),
      rowWithHelp("scenePresetMarginY", numberInput("marginY", context.formData.marginY, 0, 256, 1), "scenePresetMarginY")
    ]),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.scenePresets.actions.apply")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export class SceneLayoutPresetApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-scene-presets`,
    tag: "section",
    window: {
      title: titleKey()
    },
    position: {
      width: 520,
      height: 360
    }
  };

  constructor(options = {}) {
    super(options);
    this.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
    this.formData = {
      presetId: "grid2x2",
      gap: 8,
      marginX: 8,
      marginY: 8
    };
  }

  async _prepareContext() {
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
    this.formData = readFormData(form);

    const activeUsers = usersForConfig();
    const userIds = activeUsers.map((user) => user.id);
    const built = buildSceneLayoutPreset(userIds, this.formData.presetId, {
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
      ui.notifications.warn(
        localize("ui.scenePresets.notifications.partial").replace("{count}", String(built.ignoredUserIds.length))
      );
    } else {
      ui.notifications.info(localize("ui.scenePresets.notifications.applied"));
    }
  }
}
