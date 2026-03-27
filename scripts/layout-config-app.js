import { MODULE_ID } from "./constants.js";
import { buildFormData, buildLayoutPatch } from "./camera-config-model.js";
import { replaceAppContent } from "./dom-replace.js";
import { appId, helpText, rowHtml, rowWithHelp, sectionHtml, textInput } from "./camera-config-ui.js";
import { currentSceneId, loadLayoutForUser, localize, saveLayoutPatchForUser, selectedUser, usersForConfig } from "./camera-config-shared.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { getSceneCameraControlMode, setSceneCameraControlMode } from "./scene-camera.js";

function titleKey() {
  return `${MODULE_ID}.ui.layout.title`;
}

function syncLayoutModeFieldState(form, cameraControlMode) {
  const moduleOwned = cameraControlMode === "module";
  const layoutMode = form.elements.namedItem("layoutMode")?.value ?? "absolute";
  const absoluteDisabled = !moduleOwned || layoutMode !== "absolute";
  const relativeDisabled = !moduleOwned || layoutMode !== "relative";

  ["top", "left", "width", "height"].forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field) field.disabled = absoluteDisabled;
  });
  ["relativeTargetUserId", "relativePlacement", "relativeGap"].forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field) field.disabled = relativeDisabled;
  });
}

function cameraControlModeSelect(value, disabled) {
  const disabledAttr = disabled ? " disabled" : "";
  const items = [
    { id: "native", label: localize("ui.config.cameraControlMode.native") },
    { id: "module", label: localize("ui.config.cameraControlMode.module") }
  ];
  const options = items
    .map((item) => {
      const selectedAttr = item.id === value ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="cameraControlMode"${disabledAttr}>${options}</select>`;
}

function readFormData(form) {
  return {
    layoutMode: form.elements.namedItem("layoutMode")?.value ?? "",
    top: form.elements.namedItem("top")?.value ?? "",
    left: form.elements.namedItem("left")?.value ?? "",
    width: form.elements.namedItem("width")?.value ?? "",
    height: form.elements.namedItem("height")?.value ?? "",
    relativeTargetUserId: form.elements.namedItem("relativeTargetUserId")?.value ?? "",
    relativePlacement: form.elements.namedItem("relativePlacement")?.value ?? "",
    relativeGap: form.elements.namedItem("relativeGap")?.value ?? "",
    cropTop: form.elements.namedItem("cropTop")?.value ?? "",
    cropRight: form.elements.namedItem("cropRight")?.value ?? "",
    cropBottom: form.elements.namedItem("cropBottom")?.value ?? "",
    cropLeft: form.elements.namedItem("cropLeft")?.value ?? ""
  };
}

function layoutModeSelect(value, disabled) {
  const disabledAttr = disabled ? " disabled" : "";
  const items = [
    { id: "absolute", label: localize("ui.config.layoutMode.absolute") },
    { id: "relative", label: localize("ui.config.layoutMode.relative") }
  ];
  const options = items
    .map((item) => {
      const selectedAttr = item.id === (value || "absolute") ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="layoutMode"${disabledAttr}>${options}</select>`;
}

function relationTargetSelect(users, selectedUserId, value, disabled) {
  const disabledAttr = disabled ? " disabled" : "";
  const items = [
    { id: "", label: localize("ui.config.relativeTarget.none") },
    ...users
      .filter((user) => user.id !== selectedUserId)
      .map((user) => ({ id: user.id, label: user.name }))
  ];
  const options = items
    .map((item) => {
      const selectedAttr = item.id === String(value ?? "") ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="relativeTargetUserId"${disabledAttr}>${options}</select>`;
}

function relationPlacementSelect(value, disabled) {
  const disabledAttr = disabled ? " disabled" : "";
  const items = [
    { id: "none", label: localize("ui.config.relativePlacement.none") },
    { id: "above-left", label: localize("ui.config.relativePlacement.aboveLeft") },
    { id: "above-center", label: localize("ui.config.relativePlacement.aboveCenter") },
    { id: "above-right", label: localize("ui.config.relativePlacement.aboveRight") },
    { id: "below-left", label: localize("ui.config.relativePlacement.belowLeft") },
    { id: "below-center", label: localize("ui.config.relativePlacement.belowCenter") },
    { id: "below-right", label: localize("ui.config.relativePlacement.belowRight") },
    { id: "left-top", label: localize("ui.config.relativePlacement.leftTop") },
    { id: "left-center", label: localize("ui.config.relativePlacement.leftCenter") },
    { id: "left-bottom", label: localize("ui.config.relativePlacement.leftBottom") },
    { id: "right-top", label: localize("ui.config.relativePlacement.rightTop") },
    { id: "right-center", label: localize("ui.config.relativePlacement.rightCenter") },
    { id: "right-bottom", label: localize("ui.config.relativePlacement.rightBottom") }
  ];
  const options = items
    .map((item) => {
      const selectedAttr = item.id === (value || "none") ? " selected" : "";
      return `<option value="${item.id}"${selectedAttr}>${foundry.utils.escapeHTML(item.label)}</option>`;
    })
    .join("");
  return `<select name="relativePlacement"${disabledAttr}>${options}</select>`;
}

function sceneSection(sceneId, cameraControlMode) {
  const noScene = !sceneId;
  const description = noScene
    ? localize("ui.config.sections.sceneDescNoScene")
    : localize("ui.config.sections.sceneDesc");
  return sectionHtml(localize("ui.config.sections.scene"), description, [
    rowHtml(
      `${localize("ui.config.fields.cameraControlMode")}${helpText("cameraControlMode")}`,
      cameraControlModeSelect(cameraControlMode, noScene)
    ),
    noScene ? "" : `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(localize("ui.config.notes.cameraControlModeImmediate"))}</p>`
  ]);
}

function geometrySection(formData, cameraControlMode, users, selectedUserId) {
  const moduleOwned = cameraControlMode === "module";
  const disabledAttr = moduleOwned ? "" : " disabled";
  const description = moduleOwned
    ? localize("ui.config.sections.geometryDescModule")
    : localize("ui.config.sections.geometryDescNative");
  const absoluteDisabledAttr = moduleOwned && formData.layoutMode === "absolute" ? "" : " disabled";
  const relativeDisabled = !moduleOwned || formData.layoutMode !== "relative";
  return sectionHtml(localize("ui.config.sections.geometry"), description, [
    rowWithHelp("layoutMode", layoutModeSelect(formData.layoutMode, !moduleOwned), "layoutMode"),
    rowWithHelp("top", `<input type="text" name="top" value="${foundry.utils.escapeHTML(String(formData.top ?? ""))}"${absoluteDisabledAttr}>`, "top"),
    rowWithHelp("left", `<input type="text" name="left" value="${foundry.utils.escapeHTML(String(formData.left ?? ""))}"${absoluteDisabledAttr}>`, "left"),
    rowWithHelp("width", `<input type="text" name="width" value="${foundry.utils.escapeHTML(String(formData.width ?? ""))}"${absoluteDisabledAttr}>`, "width"),
    rowWithHelp("height", `<input type="text" name="height" value="${foundry.utils.escapeHTML(String(formData.height ?? ""))}"${absoluteDisabledAttr}>`, "height"),
    rowWithHelp("relativeTargetUserId", relationTargetSelect(users, selectedUserId, formData.relativeTargetUserId, relativeDisabled), "relativeTargetUserId"),
    rowWithHelp("relativePlacement", relationPlacementSelect(formData.relativePlacement, relativeDisabled), "relativePlacement"),
    rowWithHelp("relativeGap", `<input type="text" name="relativeGap" value="${foundry.utils.escapeHTML(String(formData.relativeGap ?? ""))}"${relativeDisabled ? " disabled" : ""}>`, "relativeGap")
  ]);
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
    sceneSection(context.sceneId, context.cameraControlMode),
    geometrySection(context.formData, context.cameraControlMode, context.users, context.selectedUserId),
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
      users,
      sceneId: currentSceneId(),
      cameraControlMode: getSceneCameraControlMode(),
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
    syncLayoutModeFieldState(form, getSceneCameraControlMode());
    form.elements.namedItem("cameraControlMode")?.addEventListener("change", async (event) => {
      const sceneId = currentSceneId();
      if (!sceneId) return;
      await setSceneCameraControlMode(sceneId, event.currentTarget.value);
      applyCameraLayoutsNow();
      syncLayoutModeFieldState(form, getSceneCameraControlMode());
      if (this.onSaved) this.onSaved();
    });
    form.elements.namedItem("layoutMode")?.addEventListener("change", () => {
      syncLayoutModeFieldState(form, getSceneCameraControlMode());
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await this.saveForm(form);
    });
  }

  async saveForm(form) {
    if (!this.selectedUserId) return;
    const patch = buildLayoutPatch(readFormData(form));
    if (getSceneCameraControlMode() !== "module") {
      delete patch.layoutMode;
      delete patch.position;
      delete patch.top;
      delete patch.left;
      delete patch.width;
      delete patch.height;
      delete patch.relative;
    }
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
