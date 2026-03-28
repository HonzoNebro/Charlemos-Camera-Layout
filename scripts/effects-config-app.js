import { MODULE_ID } from "./constants.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, bindEffectEditor, checkboxInput, effectEditor, rowWithHelp, sectionHtml, textInput } from "./camera-config-ui.js";
import { currentSceneId, finalizeSubwindowSave, loadLayoutForUser, localize, saveLayoutPatchForUser, selectedUser, usersForConfig } from "./camera-config-shared.js";

function titleKey() {
  return `${MODULE_ID}.ui.effects.title`;
}

function readFormData(form) {
  return {
    transform: form.elements.namedItem("transform")?.value ?? "",
    filter: form.elements.namedItem("filter")?.value ?? "",
    clipPath: form.elements.namedItem("clipPath")?.value ?? "",
    geometryBorderRadius: form.elements.namedItem("geometryBorderRadius")?.value ?? "",
    geometryTransparentFrame: Boolean(form.elements.namedItem("geometryTransparentFrame")?.checked)
  };
}

function effectsSection(formData) {
  return sectionHtml(localize("ui.config.sections.effects"), localize("ui.config.sections.effectsDesc"), [
    rowWithHelp("transform", effectEditor("transform", "transform", formData.transform), "transform"),
    rowWithHelp("filter", effectEditor("filter", "filter", formData.filter), "filter"),
    rowWithHelp("clipPath", effectEditor("clipPath", "clipPath", formData.clipPath), "clipPath"),
    rowWithHelp("geometryBorderRadius", textInput("geometryBorderRadius", formData.geometryBorderRadius), "geometryBorderRadius"),
    rowWithHelp("geometryTransparentFrame", checkboxInput("geometryTransparentFrame", formData.geometryTransparentFrame), "geometryTransparentFrame")
  ]);
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.playerName)}</p>`,
    `<form id="${context.formId}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    effectsSection(context.formData),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.config.actions.save")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export class EffectsConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-effects-config`,
    tag: "section",
    window: {
      title: titleKey(),
      resizable: true
    },
    position: {
      width: 760,
      height: 700
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
      formId: this.scopedId("effects-form"),
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
    const form = document.getElementById(this.scopedId("effects-form"));
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
    bindEffectEditor(form);
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const patch = buildLayoutPatch(readFormData(form));
    delete patch.crop;
    delete patch.overlay;
    delete patch.nameStyle;
    await saveLayoutPatchForUser(this.selectedUserId, patch);
    await finalizeSubwindowSave(this, this.onSaved);
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | effects config saved`, {
      playerId: this.selectedUserId,
      sceneId: currentSceneId(),
      patch,
      effectFlags: {
        transform: Boolean(patch.transform),
        filter: Boolean(patch.filter),
        clipPath: Boolean(patch.clipPath),
        borderRadius: Boolean(patch.geometry?.borderRadius),
        transparentFrame: Boolean(patch.geometry?.transparentFrame)
      }
    });
  }
}
