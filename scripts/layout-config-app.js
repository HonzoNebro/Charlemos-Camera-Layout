import { MODULE_ID } from "./constants.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, rowWithHelp, sectionHtml, textInput } from "./camera-config-ui.js";
import { currentSceneId, loadLayoutForUser, localize, saveLayoutPatchForUser, selectedUser, usersForConfig } from "./camera-config-shared.js";

function titleKey() {
  return `${MODULE_ID}.ui.layout.title`;
}

function readFormData(form) {
  return {
    cropTop: form.elements.namedItem("cropTop")?.value ?? "",
    cropRight: form.elements.namedItem("cropRight")?.value ?? "",
    cropBottom: form.elements.namedItem("cropBottom")?.value ?? "",
    cropLeft: form.elements.namedItem("cropLeft")?.value ?? ""
  };
}

function layoutSection(formData) {
  return sectionHtml(localize("ui.config.sections.layout"), localize("ui.config.sections.layoutDesc"), [
    rowWithHelp("cropTop", textInput("cropTop", formData.cropTop), "cropTop"),
    rowWithHelp("cropRight", textInput("cropRight", formData.cropRight), "cropRight"),
    rowWithHelp("cropBottom", textInput("cropBottom", formData.cropBottom), "cropBottom"),
    rowWithHelp("cropLeft", textInput("cropLeft", formData.cropLeft), "cropLeft")
  ]);
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.playerName)}</p>`,
    `<form id="${appId("layout-form")}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    layoutSection(context.formData),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.config.actions.save")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export class LayoutConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-layout-config`,
    tag: "section",
    window: {
      title: titleKey()
    },
    position: {
      width: 560,
      height: 460
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
    const layout = loadLayoutForUser(this.selectedUserId);
    return {
      title: game.i18n.localize(titleKey()),
      playerName: selected?.name ?? "",
      sceneId: currentSceneId(),
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
    const form = document.getElementById(appId("layout-form"));
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const patch = buildLayoutPatch(readFormData(form));
    delete patch.transform;
    delete patch.filter;
    delete patch.clipPath;
    delete patch.overlay;
    delete patch.nameStyle;
    delete patch.geometry;
    await saveLayoutPatchForUser(this.selectedUserId, patch);
    if (this.onSaved) this.onSaved();
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | layout config saved`, { playerId: this.selectedUserId, patch });
  }
}
