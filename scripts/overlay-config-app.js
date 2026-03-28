import { MODULE_ID } from "./constants.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { overlayMediaKind } from "./camera-layout-style.js";
import { replaceAppContent } from "./dom-replace.js";
import {
  appId,
  bindOverlayTintMode,
  checkboxInput,
  colorInput,
  numberInput,
  overlayAnchorSelect,
  overlayFitModeSelect,
  overlayImageField,
  overlayTintBlendModeSelect,
  rowWithHelp,
  sectionHtml,
  textInput
} from "./camera-config-ui.js";
import {
  currentSceneId,
  finalizeSubwindowSave,
  loadLayoutForUser,
  localize,
  readText,
  saveLayoutPatchForUser,
  selectedUser,
  setFieldValue,
  usersForConfig
} from "./camera-config-shared.js";

function titleKey() {
  return `${MODULE_ID}.ui.overlay.title`;
}

function readFormData(form) {
  return {
    overlayEnabled: Boolean(form.elements.namedItem("overlayEnabled")?.checked),
    overlayImage: form.elements.namedItem("overlayImage")?.value ?? "",
    overlayOpacity: form.elements.namedItem("overlayOpacity")?.value ?? "",
    overlayOffsetX: form.elements.namedItem("overlayOffsetX")?.value ?? "",
    overlayOffsetY: form.elements.namedItem("overlayOffsetY")?.value ?? "",
    overlayScale: form.elements.namedItem("overlayScale")?.value ?? "",
    overlayRotate: form.elements.namedItem("overlayRotate")?.value ?? "",
    overlayFitMode: form.elements.namedItem("overlayFitMode")?.value ?? "",
    overlayAnchor: form.elements.namedItem("overlayAnchor")?.value ?? "",
    overlayTintEnabled: Boolean(form.elements.namedItem("overlayTintEnabled")?.checked),
    overlayTintColor: form.elements.namedItem("overlayTintColor")?.value ?? "",
    overlayTintOpacity: form.elements.namedItem("overlayTintOpacity")?.value ?? "",
    overlayTintBlendMode: form.elements.namedItem("overlayTintBlendMode")?.value ?? ""
  };
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
    rowWithHelp("overlayFitMode", overlayFitModeSelect(formData.overlayFitMode), "overlayFitMode"),
    rowWithHelp("overlayAnchor", overlayAnchorSelect(formData.overlayAnchor), "overlayAnchor"),
    rowWithHelp("overlayTintEnabled", checkboxInput("overlayTintEnabled", formData.overlayTintEnabled), "overlayTintEnabled"),
    rowWithHelp("overlayTintColor", colorInput("overlayTintColor", formData.overlayTintColor), "overlayTintColor"),
    rowWithHelp("overlayTintOpacity", numberInput("overlayTintOpacity", formData.overlayTintOpacity, 0, 1, 0.05), "overlayTintOpacity"),
    rowWithHelp("overlayTintBlendMode", overlayTintBlendModeSelect(formData.overlayTintBlendMode), "overlayTintBlendMode")
  ]);
}

function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.playerName)}</p>`,
    `<form id="${context.formId}" class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    overlaySection(context.formData),
    `</div>`,
    `<div class="charlemos-actions"><button type="submit">${localize("ui.config.actions.save")}</button></div>`,
    `</form>`,
    `</div>`
  ].join("");
}

export class OverlayConfigApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-overlay-config`,
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
      formId: this.scopedId("overlay-form"),
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
    const form = document.getElementById(this.scopedId("overlay-form"));
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
    form.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button || button.dataset.action !== "pick-overlay-image") return;
      event.preventDefault();
      this.openOverlayFilePicker(form);
    });
    bindOverlayTintMode(form);
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

  shouldValidateOverlay(formData) {
    if (!formData.overlayEnabled) return false;
    return Boolean(String(formData.overlayImage ?? "").trim());
  }

  mediaLoadPromise(path) {
    const kind = overlayMediaKind(path);
    if (kind === "video") {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        const timeoutId = window.setTimeout(() => {
          resolve(false);
        }, 8000);
        video.onloadedmetadata = () => {
          window.clearTimeout(timeoutId);
          resolve(true);
        };
        video.onerror = () => {
          window.clearTimeout(timeoutId);
          resolve(false);
        };
        video.preload = "metadata";
        video.src = path;
      });
    }
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
    return this.mediaLoadPromise(String(formData.overlayImage ?? "").trim());
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const formData = readFormData(form);
    const overlayValid = await this.validateOverlayImage(formData);
    if (!overlayValid) {
      console.warn(`${MODULE_ID} | overlay validation failed`, {
        playerId: this.selectedUserId,
        sceneId: currentSceneId(),
        overlayImage: String(formData.overlayImage ?? "").trim(),
        kind: overlayMediaKind(formData.overlayImage)
      });
      ui.notifications.error(localize("ui.config.notifications.overlayImageInvalid"));
      return;
    }
    const patch = buildLayoutPatch(formData);
    delete patch.crop;
    delete patch.transform;
    delete patch.filter;
    delete patch.clipPath;
    delete patch.nameStyle;
    delete patch.geometry;
    await saveLayoutPatchForUser(this.selectedUserId, patch);
    await finalizeSubwindowSave(this, this.onSaved);
    ui.notifications.info(localize("ui.config.notifications.saved"));
    console.debug(`${MODULE_ID} | overlay config saved`, {
      playerId: this.selectedUserId,
      sceneId: currentSceneId(),
      patch,
      overlay: {
        enabled: Boolean(patch.overlay?.enabled),
        imageUrl: patch.overlay?.imageUrl ?? null,
        kind: overlayMediaKind(patch.overlay?.imageUrl),
        fitMode: patch.overlay?.fitMode ?? "auto",
        anchor: patch.overlay?.anchor ?? "center"
      }
    });
  }
}
