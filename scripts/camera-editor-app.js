import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { replaceAppContent } from "./dom-replace.js";
import { buildFormData, validateLayoutFormData } from "./camera-config-model.js";
import { beginEditSession, endEditSession, getEditSession, readSceneConfiguration, editSessionProblem, applyEditSession } from "./edit-runtime.js";
import { applyCameraLayoutsNow, viewSupportsModuleGeometry } from "./live-camera-renderer.js";
import { requestSceneBackgroundApply } from "./scene-background-renderer.js";
import { clearLoadedSceneProfileDraft, getApp, setApp } from "./state.js";
import { usersForConfig } from "./camera-config-shared.js";
import { editorButton as button, editorText as t, escapeEditorHtml as esc, selectControl, cameraFieldsHtml, updateCameraField } from "./editor-fields.js";
import { configurationBackup, inspectConfigurationImport, prepareConfigurationImport, applyConfigurationImport, importReferences, remapConfigurationImport, importEntries, selectImportEntries } from "./config-import.js";
import { exportSceneProfileToMacro } from "./macro-exporter.js";
import { SupportReportApp } from "./support-report-app.js";
import { initialPreset, presetHtml, presetResult, compositionWithPreset, copyCameraCategories, COPY_CATEGORIES } from "./editor-compositions.js";
import { BASIC_EFFECTS, parseBasicEffects, updateBasicEffect } from "./editor-effects.js";
import { VisualCameraEditor, lengthPixels, pixelsLength } from "./visual-camera-editor.js";
import { resolveEditorCameraView } from "./camera-video-source.js";
import { effectCatalog } from "./css-effects.js";
import { inspectOverlayResource } from "./editor-media.js";
import { getSceneBackgroundStatus } from "./scene-background-renderer.js";
import { applyFramePreset, framePresetsHtml, applyFrameBlend, frameBlendHtml } from "./editor-frame-presets.js";
import { sceneProfileEntries, duplicateSceneComposition, uniqueCompositionMacroName } from "./editor-profiles.js";
import { downloadModuleDebugReport } from "./debug-report.js";
import { configurationEqual } from "./edit-session.js";
import { ProfileLibraryPanel } from "./profile-library-panel.js";
import { CAMERA_AUDIENCES, cameraSessionForAudience, profileForAudience, normalizeRoleVariants } from "./role-variants.js";
import { SHAPE_FIELDS, parseGuidedShape, guidedShapeCss, updateGuidedShape } from "./editor-shapes.js";
import { FRAME_ALIGNMENTS, applyFrameAlignment } from "./editor-frame-alignment.js";

function refreshPreview() {
  applyCameraLayoutsNow();
  requestSceneBackgroundApply();
}

function labeledSelect(name, value, items, label) {
  if (value && !items.some((item) => String(item.id) === String(value))) items = [{ id: value, label: `${t("unavailable")} (${value})` }, ...items];
  return `<label class="charlemos-field">${esc(label)}${selectControl(name, value, items)}</label>`;
}

function pendingSummary(session) {
  const cameras = new Set();
  let scene = 0;
  for (const change of session?.changes ?? []) {
    if (change.path[0] === "profile" && change.path[1] === "layouts" && change.path[2]) cameras.add(change.path[2]);
    else if (change.path[1] === "roleVariants") {
      if (change.path[3] === "layouts" && change.path[4]) cameras.add(change.path[4]);
      else {
        for (const profile of [session.base.profile, session.draft.profile]) {
          const variants = change.path[2] ? { [change.path[2]]: profile.roleVariants?.[change.path[2]] } : profile.roleVariants;
          for (const variant of Object.values(variants ?? {})) for (const id of Object.keys(variant?.layouts ?? {})) cameras.add(id);
        }
        scene++;
      }
    }
    else scene++;
  }
  return `${t("pending")}: ${cameras.size} ${t("cameras")} · ${scene} ${t("scene")}`;
}

function sessionErrors(session, users) {
  if (!session) return [];
  const errors = [];
  for (const [id, layout] of Object.entries(session.draft.profile.layouts ?? {})) {
    if (layout.overlay?.enabled && !String(layout.overlay.imageUrl ?? "").trim()) errors.push(`${users.find((user) => user.id === id)?.name ?? id}: ${t("missingResource")}`);
    if (session.draft.profile.cameraControlMode === "module") {
      const validation = validateLayoutFormData(id, buildFormData(layout), session.draft.profile.layouts, users);
      for (const error of validation.errors) errors.push(`${users.find((user) => user.id === id)?.name ?? id}: ${game.i18n.localize(`${MODULE_ID}.ui.config.validation.${error}`)}`);
    }
    for (const [field, property] of [["transform", "transform"], ["filter", "filter"], ["clipPath", "clip-path"]]) {
      if (layout[field] && globalThis.CSS?.supports && !CSS.supports(property, layout[field])) errors.push(`${users.find((user) => user.id === id)?.name ?? id}: ${t("invalidCss")} (${property})`);
    }
  }
  if (session.draft.profile.roleVariants) {
    try {
      for (const role of Object.keys(normalizeRoleVariants(session.draft.profile.roleVariants))) {
        const { roleVariants: _variants, ...profile } = profileForAudience(session.draft.profile, role);
        errors.push(...sessionErrors({ draft: { profile } }, users).map((error) => `${t(`audience_${role}`)}: ${error}`));
      }
    } catch { errors.push(t("roleVariantsInvalid")); }
  }
  return errors;
}

function conflictHtml(session) {
  return (session?.conflicts ?? []).map((conflict, index) => `<fieldset><legend>${esc(t("conflicts"))}: ${esc(conflict.path.join(" / "))}</legend>
    <p>${esc(t("savedValue"))}: <code>${esc(JSON.stringify(conflict.remote))}</code></p>
    <p>${esc(t("draftValue"))}: <code>${esc(JSON.stringify(conflict.after))}</code></p>
    ${button("conflict-remote", "keepSaved", `data-index="${index}"`)}${button("conflict-draft", "keepDraft", `data-index="${index}"`)}</fieldset>`).join("");
}

export class CameraEditorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-editor`, tag: "section",
    window: { title: `${MODULE_ID}.ui.editor.title`, resizable: true },
    position: { width: 880, height: 760 }
  };

  constructor(options = {}) {
    super(options);
    this.area = "scene";
    this.section = "layout";
    this.selectedUserId = globalThis.game?.user?.id ?? null;
    this.closeRequested = false;
    this.importState = null;
    this.message = "";
    this.copyCategories = ["effects", "overlay", "name"];
    this.copyTargets = [];
    this.cameraAudience = "base";
    this.library = new ProfileLibraryPanel((profile) => sessionErrors({ draft: { profile } }, usersForConfig()));
  }

  get session() { return getEditSession(); }
  get cameraSession() { return cameraSessionForAudience(this.session, this.cameraAudience); }

  async _prepareContext() {
    const session = beginEditSession(globalThis.canvas?.scene?.id);
    if (session && !session.busy && editSessionProblem(session) !== "sceneDeleted") session.reconcile(readSceneConfiguration(session.sceneId));
    const users = usersForConfig();
    if (!this.selectedUserId) this.selectedUserId = users[0]?.id ?? null;
    return { session, users, problem: editSessionProblem(session), errors: sessionErrors(session, users) };
  }

  async _renderHTML(context) {
    const { session, users, problem, errors } = context;
    const scene = game.scenes?.get?.(session?.sceneId);
    const disabled = !session || session.busy || this.library.busy ? "disabled" : "";
    return `<div class="charlemos-editor" data-editor-root>
      <header><h2>${esc(t("title"))}</h2><p>${esc(scene?.name ?? session?.sceneId ?? t("sceneRequired"))}</p><p>${esc(t("sharedScope"))}</p></header>
      <nav aria-label="${esc(t("navigation"))}">${["scene", "cameras", "tools"].map((area) => button("area", area, `data-area="${area}" aria-pressed="${this.area === area}"`)).join("")}</nav>
      <div class="charlemos-editor-scroll" tabindex="-1">
      ${problem ? `<p role="status">${esc(t(problem))}</p>` : ""}
      ${problem === "sceneChanged" ? button("return-scene", "returnScene") + button("switch-scene", "discardAndSwitch") : ""}
      ${this.message ? `<p role="status">${esc(this.message)}</p>` : ""}
      <div role="alert" data-editor-errors>${errors.map((error) => `<p>${esc(error)}</p>`).join("")}</div>
      ${conflictHtml(session)}
      ${this.closeRequested ? `<aside>${esc(t("unsaved"))}${button("save-close", "saveClose")}${button("discard-close", "discard")}${button("continue", "continueEditing")}</aside>` : ""}
      <form data-editor-form><fieldset class="charlemos-editor-content" ${this.area === "tools" ? this.importBusy || this.library.busy ? "disabled" : "" : disabled}>${this.area === "tools" ? this.toolsHtml() : session ? this.area === "scene" ? this.sceneHtml(users) : this.cameraHtml(users) : `<p>${esc(t("sceneRequired"))}</p>`}</fieldset></form>
      </div>
      <footer><p aria-live="polite">${esc(pendingSummary(session))}</p>
      <label><input type="checkbox" name="preview"${session?.preview ? " checked" : ""} ${disabled}>${esc(t("preview"))}</label>
      ${session ? labeledSelect("previewAudience", session.previewAudience ?? "base", CAMERA_AUDIENCES.map((id) => ({ id, label: t(`audience_${id}`) })), t("previewAudience")) : ""}
      ${button("undo", "undo", !session?.history.length ? "disabled" : "")}${button("redo", "redo", !session?.future.length ? "disabled" : "")}
      ${button("apply", "apply", problem || errors.length || !session?.dirty || session?.busy || this.library.busy ? "disabled" : "")}
      ${button("save-close", "saveClose", problem || errors.length || session?.busy || this.library.busy ? "disabled" : "")}${button("cancel", "cancel", session?.busy || this.library.busy ? "disabled" : "")}
      </footer></div>`;
  }

  sceneHtml(users) {
    this.preset ??= initialPreset(users);
    const { profile, background } = this.session.draft;
    return labeledSelect("cameraControlMode", profile.cameraControlMode, ["native", "module"].map((id) => ({ id, label: t(id) })), t("controlMode")) +
      `<p>${esc(t("controlHelp"))}</p>` +
      labeledSelect("backgroundSource", background?.playerId ?? "", [{ id: "", label: t("disabled") }, ...users.map((user) => ({ id: user.id, label: user.name }))], t("background")) +
      labeledSelect("backgroundFit", background?.fit ?? "cover", ["cover", "contain", "fill"].map((id) => ({ id, label: t(id) })), t("fit")) +
      `<p role="status">${esc(t("localState"))}: ${esc(game.i18n.localize(`${MODULE_ID}.ui.sceneBackground.status.${getSceneBackgroundStatus().state}`))}</p>` +
      presetHtml(this.preset, users, this.element?.ownerDocument?.defaultView ?? window);
  }

  cameraHtml(users) {
    const layout = this.cameraSession.draft.profile.layouts?.[this.selectedUserId];
    const user = users.find((item) => item.id === this.selectedUserId);
    const view = resolveEditorCameraView(this.selectedUserId);
    const geometryAvailable = this.cameraSession.draft.profile.cameraControlMode === "module" && (!view || viewSupportsModuleGeometry(view));
    return labeledSelect("selectedUser", this.selectedUserId, users.map((item) => ({ id: item.id, label: `${item.name}${item.active ? "" : ` (${t("offline")})`}` })), t("camera")) +
      this.audienceHtml() +
      `<nav>${["layout", "effects", "overlay", "name"].map((section) => button("section", section, `data-section="${section}" aria-pressed="${this.section === section}"`)).join("")}</nav>` +
      (!user ? `<p>${esc(t("userDeleted"))}</p>` : `<fieldset ${this.session.busy ? "disabled" : ""}><legend>${esc(user.name)}</legend>
      ${this.visualHtml()}
      <p role="status">${esc(t("localState"))}: ${esc(t(!view ? "waitingCamera" : this.session.preview ? "preview" : layout && this.session.draft.profile.enabled ? "available" : "disabled"))}</p>
      ${this.section === "layout" ? `<p>${esc(t("dockHelp"))}</p>` : ""}
      ${this.section === "effects" ? this.basicEffectsHtml(layout) : ""}
      ${this.section === "overlay" ? framePresetsHtml() : ""}
      ${this.section === "overlay" ? frameBlendHtml(layout?.overlay) : ""}
      ${this.section === "overlay" ? this.frameAlignmentHtml() : ""}
      ${cameraFieldsHtml(layout, this.section, users, this.id, { geometryAvailable })}
      ${this.section === "overlay" ? `${button("pick-resource", "chooseResource")}<p data-media-status role="status">${esc(t(this.mediaState ?? "notChecked"))}</p><p>${esc(t("boundsHelp"))}</p>` : ""}
      ${button("reset-section", this.cameraAudience === "base" ? "resetSection" : "inheritSection")}</fieldset>`);
  }

  audienceHtml() {
    const variant = this.session.draft.profile.roleVariants?.[this.cameraAudience];
    return labeledSelect("cameraAudience", this.cameraAudience, CAMERA_AUDIENCES.map((id) => ({ id, label: t(`audience_${id}`) })), t("editAudience")) +
      `<p>${esc(t("audienceHelp"))}</p>` + (this.cameraAudience === "base" ? "" :
        labeledSelect("audienceControlMode", variant?.cameraControlMode ?? "", [{ id: "", label: t("inheritBase") }, ...["native", "module"].map((id) => ({ id, label: t(id) }))], t("controlMode")) +
        `<p role="status">${esc(t(variant?.layouts?.[this.selectedUserId] && Object.keys(variant.layouts[this.selectedUserId]).length ? "audienceOverrides" : "inheritBase"))}</p>` +
        button("inherit-camera", "inheritCamera") + button("inherit-role", "inheritRole"));
  }

  toolsHtml() {
    const legacy = game.settings.get(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS) ?? {};
    return `${button("backup", "backup")}${button("import", "import")}${button("macro", "macro", this.session ? "" : "disabled")}${button("diagnostic", "diagnostic")}${button("download-diagnostic", "downloadDiagnostic")}<p>${esc(t("diagnosticPrivacy"))}</p>
      <p>${esc(t("toolsBaseHelp"))}</p>${this.profilesHtml()}
      ${this.library.html(this.session, usersForConfig())}
      ${this.session && Object.keys(legacy).length ? button("legacy", "importLegacy") : ""}
      ${this.session ? this.copyHtml() : ""}
      ${this.importState ? this.importHtml() : ""}`;
  }

  basicEffectsHtml(layout) {
    const controls = Object.entries(BASIC_EFFECTS).map(([id, definition]) => {
      const tokens = parseBasicEffects(layout?.[definition.kind], definition.kind);
      const value = tokens?.find((token) => token.id === id)?.value ?? definition.default;
      const label = game.i18n.localize(`${MODULE_ID}.ui.config.effect.${id}`);
      return `<label>${esc(label)}<input data-basic-effect="${id}" type="range" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${value}"${tokens === null ? " disabled" : ""}><output>${value}${definition.unit}</output></label>${button("remove-basic-effect", "remove", `data-effect="${id}" aria-label="${esc(t("remove"))}: ${esc(label)}"${tokens === null ? " disabled" : ""}`)}`;
    }).join("");
    const custom = ["filter", "transform"].some((kind) => parseBasicEffects(layout?.[kind], kind) === null);
    return `<fieldset><legend>${esc(t("basicEffects"))}</legend>${custom ? `<p>${esc(t("customCss"))}</p>` : ""}${controls}
      ${labeledSelect("basicShape", layout?.clipPath ?? "", [{ id: "", label: t("disabled") }, ...effectCatalog("clipPath").map((item) => ({ id: item.value, label: game.i18n.localize(`${MODULE_ID}.ui.config.effect.${item.id}`) })), ...(layout?.clipPath && !effectCatalog("clipPath").some((item) => item.value === layout.clipPath) ? [{ id: layout.clipPath, label: parseGuidedShape(layout.clipPath) ? t("guidedShape") : t("customCss") }] : [])], t("shape"))}
      ${this.guidedShapeHtml(layout?.clipPath)}</fieldset>`;
  }

  guidedShapeHtml(css) {
    const shape = parseGuidedShape(css);
    const fields = shape ? Object.entries(SHAPE_FIELDS[shape.kind]).map(([key, [min, max, , unit]]) =>
      `<label>${esc(t(`shape_${key}`))} (${unit})<input name="shape-${key}" type="number" min="${min}" max="${max}" step="0.1" value="${shape.values[key]}" aria-describedby="${this.id}-shape-help"></label>`).join("") : "";
    const preview = shape ? `<div class="charlemos-shape-preview" aria-hidden="true"><span style="clip-path:${guidedShapeCss(shape.kind, shape.values)}"></span></div>` : "";
    return `<fieldset><legend>${esc(t("guidedShape"))}</legend><p id="${this.id}-shape-help">${esc(t("guidedShapeHelp"))}</p>${preview}${fields}</fieldset>`;
  }

  frameAlignmentHtml() {
    return `<fieldset><legend>${esc(t("frameAlignment"))}</legend><p>${esc(t("frameAlignmentHelp"))}</p>
      ${FRAME_ALIGNMENTS.map((alignment) => button("frame-align", `frameAlign_${alignment}`, `data-alignment="${alignment}"`)).join("")}</fieldset>`;
  }

  alignFrame(alignment) {
    this.session.previewAudience = this.cameraAudience;
    this.session.preview = true;
    refreshPreview();
    const view = resolveEditorCameraView(this.selectedUserId);
    const win = view?.ownerDocument?.defaultView;
    const context = { width: view?.clientWidth, height: view?.clientHeight, viewportWidth: win?.innerWidth, viewportHeight: win?.innerHeight };
    if (!view || !applyFrameAlignment(this.cameraSession, this.selectedUserId, alignment, context)) this.message = t("frameAlignmentUnavailable");
    else this.message = "";
  }

  profilesHtml() {
    const scenes = game.scenes?.contents ?? [];
    const entries = sceneProfileEntries(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES), scenes, usersForConfig());
    return `<fieldset><legend>${esc(t("savedProfiles"))}</legend><p>${esc(t("profilesHelp"))}</p>
      <ul>${entries.map((entry) => `<li><strong>${esc(entry.name)}</strong> (${esc(entry.id)}) — ${entry.cameras} ${esc(t("cameras"))}, ${esc(t(entry.enabled ? "available" : "disabled"))}, ${esc(t(entry.cameraControlMode === "module" ? "module" : "native"))}
        ${entry.missing ? `<p>${esc(t("sceneDeleted"))}</p>` : button("open-profile", "openProfile", `data-scene="${esc(entry.id)}"`)}
        ${entry.missingUsers.length ? `<p role="status">${esc(t("profileMissingUsers"))}: ${entry.missingUsers.map(esc).join(", ")}</p>` : ""}</li>`).join("") || `<li>${esc(t("profileEmpty"))}</li>`}</ul>
      ${labeledSelect("duplicateSource", this.duplicateSource ?? "", [{ id: "", label: "—" }, ...entries.filter((entry) => !entry.missing).map((entry) => ({ id: entry.id, label: `${entry.name} (${entry.id})` }))], t("sourceScene"))}
      ${labeledSelect("duplicateDestination", this.duplicateDestination ?? "", [{ id: "", label: "—" }, ...scenes.map((scene) => ({ id: scene.id, label: `${scene.name} (${scene.id})` }))], t("destinationScene"))}
      ${button("duplicate-profile", "duplicateProfile")}</fieldset>`;
  }

  async openProfile(sceneId) {
    if (!game.user?.isGM || !game.scenes?.get?.(sceneId)) { this.message = t("sceneDeleted"); return false; }
    if (this.session?.sceneId !== sceneId) {
      if (this.session?.dirty && !window.confirm(t("discardConfirm"))) return false;
      this.visual?.destroy(); this.visual = null;
      endEditSession();
      beginEditSession(sceneId);
    }
    this.area = "scene";
    return true;
  }

  async duplicateProfile() {
    if (!game.user?.isGM) { this.message = t("permission"); return; }
    const sourceId = this.duplicateSource;
    const destinationId = this.duplicateDestination;
    if (!game.scenes?.get?.(sourceId) || !game.scenes?.get?.(destinationId)) { this.message = t("assignDestination"); return; }
    if (sourceId === destinationId) { this.message = t("profileSameScene"); return; }
    if (this.session?.dirty && !window.confirm(t("discardConfirm"))) return;
    const source = readSceneConfiguration(sourceId).profile;
    const destination = readSceneConfiguration(destinationId).profile;
    let result;
    try { result = duplicateSceneComposition(source, destination, usersForConfig()); }
    catch (error) { this.message = t(error.message); return; }
    const description = `${game.scenes.get(sourceId).name} (${sourceId}) → ${game.scenes.get(destinationId).name} (${destinationId})`;
    if (!window.confirm(`${t("duplicateReview")}\n${description}\n${t("added")}: ${result.added.join(", ")}\n${t("modified")}: ${result.replaced.join(", ")}`)) return;
    if (!game.scenes.get(sourceId) || !game.scenes.get(destinationId) || !configurationEqual(source, readSceneConfiguration(sourceId).profile) || !configurationEqual(destination, readSceneConfiguration(destinationId).profile)) {
      this.message = t("profilesChanged"); return;
    }
    this.visual?.destroy(); this.visual = null;
    endEditSession();
    const session = beginEditSession(destinationId);
    session.edit(["profile"], result.profile);
    session.preview = true;
    this.area = "scene";
  }

  visualHtml() {
    return `<fieldset><legend>${esc(t("visualEditor"))}</legend>
      ${button("visual-toggle", this.visual ? "stopVisual" : "startVisual")}
      ${labeledSelect("visualElement", this.visual?.element ?? "camera", ["camera", "overlay", "name"].map((id) => ({ id, label: t(id) })), t("element"))}
      <label><input name="visualSnap" type="checkbox"${this.visual?.snap !== false ? " checked" : ""}>${esc(t("snap"))}</label>
      <label><input name="visualRatio" type="checkbox"${this.visual?.lockRatio ? " checked" : ""}>${esc(t("lockRatio"))}</label>
      ${button("convert-absolute", "convertAbsolute")}${button("convert-pixels", "convertPixels")}${button("undock", "undock")}
      <p>${esc(t("undockHelp"))}</p></fieldset>`;
  }

  copyHtml() {
    const users = usersForConfig();
    const scenes = game.scenes?.contents ?? [];
    return `<fieldset><legend>${esc(t("copy"))}</legend>
      ${labeledSelect("copySourceScene", this.copySourceScene ?? this.session.sceneId, scenes.map((scene) => ({ id: scene.id, label: scene.name })), t("sourceScene"))}
      ${labeledSelect("copySourceUser", this.copySourceUser ?? this.selectedUserId, users.map((user) => ({ id: user.id, label: user.name })), t("sourceCamera"))}
      ${Object.keys(COPY_CATEGORIES).map((category) => `<label><input name="copy-category-${category}" type="checkbox"${this.copyCategories.includes(category) ? " checked" : ""}>${esc(t(category))}</label>`).join("")}
      <label><input name="copyBackground" type="checkbox"${this.copyBackground ? " checked" : ""}>${esc(t("copyBackground"))}</label>
      <p>${esc(t("destinations"))}</p>${users.map((user) => `<label><input name="copy-user-${user.id}" type="checkbox"${this.copyTargets.includes(user.id) ? " checked" : ""}>${esc(user.name)}</label>`).join("")}
      ${button("copy-cameras", "copyCameras")}${button("copy-scene", "copyScene")}
      ${labeledSelect("copyDestinationScene", this.copyDestinationScene ?? this.session.sceneId, scenes.map((scene) => ({ id: scene.id, label: scene.name })), t("destinationScene"))}
      <p>${esc(t("copyHelp"))}</p></fieldset>`;
  }

  importHtml() {
    const { inspection, plan } = this.importState;
    const summary = plan?.changes.map((change) => `<li>${esc(t(change.before === undefined ? "added" : change.after === undefined ? "deleted" : "modified"))} — ${esc(change.path.join(" / "))}: ${esc(JSON.stringify(change.before))} → ${esc(JSON.stringify(change.after))}</li>`).join("");
    return `<fieldset><legend>${esc(t("importReview"))}</legend>
      <p>${esc(t("templateImportHelp"))}</p>
      ${labeledSelect("importMode", this.importState.mode, ["merge", "replace", ...(inspection.complete ? ["restore"] : [])].map((id) => ({ id, label: t(id) })), t("operation"))}
      ${this.importMappingHtml()}
      <fieldset><legend>${esc(t("includedConfigurations"))}</legend>${importEntries(inspection).map((path, index) => `<label><input name="import-entry-${index}" type="checkbox"${this.importState.mode !== "restore" && this.importState.excluded.includes(index) ? "" : " checked"}${this.importState.mode === "restore" ? " disabled" : ""}>${esc(path.join(" / "))}</label>`).join("")}</fieldset>
      <p>${esc(t("backupBeforeReplace"))}</p>${button("backup", "backup")}
      ${plan ? `<ul>${summary || esc(t("noChanges"))}</ul>${button("confirm-import", "confirmImport")}` : button("review-import", "reviewImport")}
      ${button("cancel-import", "cancel")}</fieldset>`;
  }

  importMappingHtml() {
    const references = importReferences(this.importState.inspection);
    return ["scenes", "users"].map((kind) => {
      const collection = kind === "scenes" ? game.scenes : game.users;
      const items = [{ id: "__unresolved__", label: t("assignDestination") }, { id: "", label: t("exclude") }, ...(collection?.contents ?? []).map((item) => ({ id: item.id, label: item.name }))];
      return references[kind].map((id, index) => labeledSelect(`import-map-${kind}-${index}`, this.importState.mappings[kind][id], items, `${t(kind)}: ${collection?.get?.(id)?.name ?? id}`)).join("");
    }).join("");
  }

  _replaceHTML(result, content) {
    const doc = content.ownerDocument ?? globalThis.document;
    const active = doc.activeElement;
    this.restoreFocus = active?.closest?.("[data-editor-root]") ? { name: active.name, start: active.selectionStart, end: active.selectionEnd } : null;
    this.restoreScroll = content.querySelector?.(".charlemos-editor-scroll")?.scrollTop ?? 0;
    replaceAppContent(content, result);
  }

  async _onRender() {
    setApp(this);
    if (!this.editorHooks && globalThis.Hooks) {
      this.editorHooks = ["canvasReady", "canvasTearDown", "deleteScene", "deleteUser", "userConnected", "rtcSettingsChanged"].map((name) =>
        [name, Hooks.on(name, () => {
          if (["canvasReady", "canvasTearDown"].includes(name)) this.visual?.suspend();
          this.refreshIfOpen();
        })]
      );
      this.editorHooks.push(["renderApplicationV2", Hooks.on("renderApplicationV2", (app) => {
        if (app !== this) this.visual?.reconcile(this.selectedUserId);
      })]);
      this.editorHooks.push(["closeApplicationV2", Hooks.on("closeApplicationV2", (app) => {
        if (app !== this) this.visual?.reconcile(this.selectedUserId);
      })]);
    }
    const root = this.element?.querySelector?.("[data-editor-root]");
    if (!root) return;
    const mediaKey = `${this.session?.sceneId}:${this.cameraAudience}:${this.selectedUserId}:${this.cameraSession?.draft.profile.layouts[this.selectedUserId]?.overlay?.imageUrl ?? ""}`;
    if (this.area === "cameras" && this.section === "overlay" && this.mediaKey !== mediaKey) {
      this.mediaKey = mediaKey;
      this.checkMedia();
    }
    this.visual?.reconcile(this.selectedUserId);
    root.addEventListener("input", (event) => {
      if (!event.target.dataset.basicEffect || this.session?.busy) return;
      this.session.beginGesture();
      this.updateBasicEffect(event.target);
      const output = event.target.parentElement.querySelector("output");
      if (output) output.value = event.target.value;
    });
    root.addEventListener("change", (event) => this.change(event));
    root.addEventListener("dragstart", (event) => {
      const slot = event.target.closest?.("[data-slot]");
      if (slot) this.dragSlot = Number(slot.dataset.slot);
    });
    root.addEventListener("dragover", (event) => { if (event.target.closest?.("[data-slot]")) event.preventDefault(); });
    root.addEventListener("drop", (event) => {
      const target = event.target.closest?.("[data-slot]");
      if (!target || this.dragSlot === undefined) return;
      event.preventDefault();
      const [user] = this.preset.users.splice(this.dragSlot, 1);
      this.preset.users.splice(Number(target.dataset.slot), 0, user);
      this.dragSlot = undefined;
      this.render(true);
    });
    root.addEventListener("click", (event) => {
      const target = event.target.closest?.("[data-editor-action]");
      if (target) this.action(target.dataset.editorAction, target).catch((error) => {
        console.error(`${MODULE_ID} | editor action failed`, error);
        this.message = t("saveFailed");
        this.render(true);
      });
    });
    root.querySelector("form")?.addEventListener("submit", (event) => { event.preventDefault(); });
    root.querySelector(".charlemos-editor-scroll").scrollTop = this.restoreScroll ?? 0;
    const focus = [...root.querySelectorAll("[name]")].find((field) => field.name === this.restoreFocus?.name);
    if (focus) {
      focus.focus();
      if (focus.type === "text" && this.restoreFocus.start !== null) focus.setSelectionRange(this.restoreFocus.start, this.restoreFocus.end);
    }
  }

  change(event) {
    if (this.session?.busy || this.importBusy || this.library.busy) return;
    const field = event.target;
    const name = field.name;
    if (field.checkValidity && !field.checkValidity()) { field.reportValidity(); return; }
    if (field.dataset.basicEffect) { this.updateBasicEffect(field); this.session.endGesture(); }
    else if (name === "basicShape") updateCameraField(this.cameraSession, this.selectedUserId, "clipPath", field.value);
    else if (name?.startsWith("shape-")) {
      const current = this.cameraSession?.draft.profile.layouts?.[this.selectedUserId]?.clipPath;
      const value = updateGuidedShape(current, name.slice(6), field.value);
      if (value === null) this.message = t("shapeInvalid");
      else { updateCameraField(this.cameraSession, this.selectedUserId, "clipPath", value); this.message = ""; }
    }
    else if (name === "cameraAudience" && CAMERA_AUDIENCES.includes(field.value)) {
      this.visual?.destroy(); this.visual = null;
      this.cameraAudience = field.value;
      if (this.session) { this.session.previewAudience = field.value; this.session.preview = true; }
    }
    else if (name === "previewAudience" && CAMERA_AUDIENCES.includes(field.value)) {
      this.visual?.destroy(); this.visual = null;
      if (this.session) this.session.previewAudience = field.value;
    }
    else if (name === "audienceControlMode" && this.cameraAudience !== "base") this.cameraSession.edit(["profile", "cameraControlMode"], field.value || undefined);
    else if (name === "selectedUser") this.selectedUserId = field.value;
    else if (name === "duplicateSource" || name === "duplicateDestination") this[name] = field.value;
    else if (name?.startsWith("template")) {
      try { this.library.change(field, usersForConfig()); }
      catch (error) { this.message = t(error.message); }
    }
    else if (name?.startsWith("preset-")) this.preset[name.slice(7)] = field.value;
    else if (name?.startsWith("slot-")) this.preset.users[Number(name.slice(5))] = field.value;
    else if (name?.startsWith("copy-category-")) this.copyCategories = field.checked ? [...this.copyCategories, name.slice(14)] : this.copyCategories.filter((id) => id !== name.slice(14));
    else if (name?.startsWith("copy-user-")) this.copyTargets = field.checked ? [...this.copyTargets, name.slice(10)] : this.copyTargets.filter((id) => id !== name.slice(10));
    else if (["copySourceScene", "copyDestinationScene", "copySourceUser"].includes(name)) this[name] = field.value;
    else if (name === "copyBackground") this.copyBackground = field.checked;
    else if (name === "visualElement" && this.visual) this.visual.element = field.value;
    else if (name === "visualSnap" && this.visual) this.visual.snap = field.checked;
    else if (name === "visualRatio" && this.visual) this.visual.lockRatio = field.checked;
    else if (name === "importMode") { this.importState.mode = field.value; this.importState.plan = null; }
    else if (name?.startsWith("import-entry-")) {
      const index = Number(name.slice(13));
      this.importState.excluded = field.checked ? this.importState.excluded.filter((item) => item !== index) : [...this.importState.excluded, index];
      this.importState.plan = null;
    }
    else if (name?.startsWith("import-map-")) {
      const [, , kind, index] = name.split("-");
      this.importState.mappings[kind][importReferences(this.importState.inspection)[kind][Number(index)]] = field.value;
      this.importState.plan = null;
    }
    else if (!this.session || this.session.busy) return;
    else if (name === "preview") this.session.preview = field.checked;
    else if (name === "cameraControlMode") {
      this.session.beginGesture();
      this.session.edit(["profile", "cameraControlMode"], field.value);
      this.session.edit(["profile", "enabled"], true);
      this.session.endGesture();
    } else if (name === "backgroundSource") {
      this.session.edit(["background"], field.value ? { playerId: field.value, fit: this.session.draft.background?.fit ?? "cover" } : null);
    } else if (name === "backgroundFit") {
      if (this.session.draft.background) this.session.edit(["background", "fit"], field.value);
    } else if (field.dataset.length || name?.startsWith("unit-")) {
      const key = field.dataset.length ?? name.slice(5);
      const form = field.closest("form");
      const numeric = [...form.querySelectorAll("[data-length]")].find((item) => item.dataset.length === key);
      const unit = form.elements.namedItem(`unit-${key}`).value;
      if (name?.startsWith("unit-") && numeric.value === "") return;
      if (name?.startsWith("unit-") && numeric.value !== "") {
        const converted = this.convertFieldUnit(key, unit);
        if (converted !== null) updateCameraField(this.cameraSession, this.selectedUserId, key, converted);
      } else updateCameraField(this.cameraSession, this.selectedUserId, key, numeric.value === "" ? "" : `${numeric.value}${unit}`);
    } else if (name && field.checkValidity()) updateCameraField(this.cameraSession, this.selectedUserId, name, field.type === "checkbox" ? field.checked : field.value);
    refreshPreview();
    if (name === "overlayImage" || name === "selectedUser") this.checkMedia();
    if (field.tagName === "SELECT" || field.type === "checkbox" || name?.startsWith("shape-")) this.render(true);
    else {
      this.syncFooter();
      if (name?.startsWith("preset-")) this.updatePresetPreview();
    }
  }

  updatePresetPreview() {
    const preview = this.element?.querySelector?.(".charlemos-preset-preview");
    if (!preview) return;
    const doc = preview.ownerDocument;
    const template = doc.createElement("template");
    template.innerHTML = presetHtml(this.preset, usersForConfig(), doc.defaultView);
    const replacement = template.content.querySelector(".charlemos-preset-preview");
    if (replacement) preview.replaceWith(replacement);
  }

  syncFooter() {
    const root = this.element;
    const blocked = editSessionProblem(this.session) || sessionErrors(this.session, usersForConfig()).length || this.session?.busy || this.library.busy;
    const apply = root?.querySelector?.('[data-editor-action="apply"]');
    const save = root?.querySelector?.('[data-editor-action="save-close"]');
    if (apply) apply.disabled = Boolean(blocked || !this.session?.dirty);
    if (save) save.disabled = Boolean(blocked);
    const pending = root?.querySelector?.("footer p");
    if (pending) pending.textContent = pendingSummary(this.session);
    for (const action of ["undo", "redo"]) {
      const control = root?.querySelector?.(`[data-editor-action="${action}"]`);
      if (control) control.disabled = !(action === "undo" ? this.session?.history.length : this.session?.future.length);
    }
    const errors = root?.querySelector?.("[data-editor-errors]");
    if (errors) errors.innerHTML = sessionErrors(this.session, usersForConfig()).map((error) => `<p>${esc(error)}</p>`).join("");
    for (const control of root?.querySelectorAll?.("[data-basic-effect]") ?? []) {
      const definition = BASIC_EFFECTS[control.dataset.basicEffect];
      const tokens = parseBasicEffects(this.cameraSession?.draft.profile.layouts[this.selectedUserId]?.[definition.kind], definition.kind);
      control.disabled = tokens === null;
      control.value = tokens?.find((token) => token.id === control.dataset.basicEffect)?.value ?? definition.default;
    }
  }

  async checkMedia() {
    this.mediaAbort?.abort();
    const path = this.cameraSession?.draft.profile.layouts[this.selectedUserId]?.overlay?.imageUrl;
    if (!path || !this.element?.ownerDocument) { this.mediaState = "notChecked"; return; }
    const controller = new AbortController();
    this.mediaAbort = controller;
    this.mediaState = "loading";
    const update = () => {
      const node = this.element?.querySelector?.("[data-media-status]");
      if (node) node.textContent = t(this.mediaState);
    };
    update();
    const state = await inspectOverlayResource(this.element.ownerDocument, path, { signal: controller.signal });
    if (this.mediaAbort !== controller || controller.signal.aborted) return;
    this.mediaState = state;
    update();
  }

  async action(action, target) {
    if (this.session?.busy || this.importBusy || this.library.busy) return;
    this.message = "";
    if (action.startsWith("template-")) {
      const operation = this.library.handle(action, this.session, usersForConfig(), (message) => window.confirm(message));
      if (this.library.busy) { this.message = t("saving"); await this.render(true); }
      this.message = await operation;
      refreshPreview();
      await this.render(true);
      return;
    }
    if (action === "area") this.area = target.dataset.area;
    if (action === "section") this.section = target.dataset.section;
    if (action === "visual-toggle") this.toggleVisual();
    if (action === "convert-absolute" || action === "convert-pixels") this.convertGeometry(action === "convert-absolute");
    if (action === "undock") {
      const { prepareModuleGeometryForLayouts } = await import("./live-camera-renderer.js");
      await prepareModuleGeometryForLayouts({ [this.selectedUserId]: this.cameraSession.draft.profile.layouts[this.selectedUserId] ?? {} });
    }
    if (action.startsWith("slot-")) this.moveSlot(action, Number(target.dataset.index));
    if (action === "load-preset") this.loadPreset();
    if (action === "frame-preset" && this.session && !editSessionProblem(this.session) && game.users.get(this.selectedUserId)) {
      applyFramePreset(this.cameraSession, this.selectedUserId, target.dataset.preset);
    }
    if (action === "frame-blend" && this.session && !editSessionProblem(this.session) && game.users.get(this.selectedUserId)) {
      applyFrameBlend(this.cameraSession, this.selectedUserId, target.dataset.mode);
    }
    if (action === "frame-align" && this.session && !editSessionProblem(this.session) && game.users.get(this.selectedUserId)) this.alignFrame(target.dataset.alignment);
    if (action === "copy-cameras" || action === "copy-scene") await this.copyComposition(action === "copy-scene");
    if (action === "remove-basic-effect") {
      const definition = BASIC_EFFECTS[target.dataset.effect];
      const value = updateBasicEffect(this.cameraSession.draft.profile.layouts[this.selectedUserId]?.[definition.kind], target.dataset.effect, null);
      if (value !== null) updateCameraField(this.cameraSession, this.selectedUserId, definition.kind, value);
    }
    if (action === "undo") this.session?.undo();
    if (action === "redo") this.session?.redo();
    if (action === "legacy") this.importLegacyLayouts();
    if (action === "continue") this.closeRequested = false;
    if (action === "cancel") return this.close();
    if (action === "discard-close") return this.close({ discard: true });
    if (action === "return-scene") await game.scenes?.get?.(this.session.sceneId)?.view();
    if (action === "switch-scene") {
      if (this.session?.dirty && !window.confirm(t("discardConfirm"))) return;
      this.visual?.destroy(); this.visual = null;
      endEditSession();
      beginEditSession(globalThis.canvas?.scene?.id);
    }
    if (action.startsWith("conflict-")) {
      const conflict = this.session.conflicts[Number(target.dataset.index)];
      if (conflict) this.session.resolve(conflict.path, action === "conflict-draft");
    }
    if (action === "apply" || action === "save-close") {
      if (await this.apply() && action === "save-close") return this.close({ discard: true });
    }
    if (action === "reset-section") this.resetSection();
    if (["inherit-camera", "inherit-role"].includes(action) && this.cameraAudience !== "base" && !editSessionProblem(this.session)) {
      if (action === "inherit-camera") this.cameraSession.edit(["profile", "layouts", this.selectedUserId], undefined);
      else if (window.confirm(t("inheritRoleConfirm"))) this.session.edit(["profile", "roleVariants", this.cameraAudience], undefined);
    }
    if (action === "pick-resource") this.pickResource();
    if (action === "backup") this.exportJsonConfig();
    if (action === "import") this.importJsonConfig();
    if (action === "cancel-import") this.importState = null;
    if (action === "review-import") this.reviewImport();
    if (action === "confirm-import") await this.confirmImport();
    if (action === "macro") await this.exportCurrentLayout();
    if (action === "diagnostic") new SupportReportApp({ selectedUserId: this.selectedUserId }).render(true);
    if (action === "download-diagnostic") downloadModuleDebugReport(this.selectedUserId, { sceneId: this.session?.sceneId });
    if (action === "open-profile") await this.openProfile(target.dataset.scene);
    if (action === "duplicate-profile") await this.duplicateProfile();
    refreshPreview();
    await this.render(true);
  }

  async apply() {
    const form = this.element?.querySelector?.("[data-editor-form]");
    if (form && !form.reportValidity()) return false;
    if (sessionErrors(this.session, usersForConfig()).length) {
      this.element?.querySelector?.("[data-editor-errors]")?.scrollIntoView?.({ block: "nearest" });
      return false;
    }
    const saving = applyEditSession();
    this.message = t("saving");
    await this.render(true);
    const result = await saving;
    this.message = t(result.ok ? "saved" : result.reason ?? (result.recovery === "incomplete" ? "recoveryIncomplete" : "recoveryComplete"));
    if (result.ok) clearLoadedSceneProfileDraft(this.session.sceneId);
    return result.ok;
  }

  convertFieldUnit(key, unit) {
    const view = resolveEditorCameraView(this.selectedUserId);
    if (!view || !window.confirm(t("convertUnit"))) { this.message = t("conversionNeedsCamera"); return null; }
    const win = view.ownerDocument.defaultView;
    const target = key.startsWith("overlay") ? view.querySelector(".charlemos-camera-overlay") ?? view : view;
    const local = key.startsWith("overlay") || key.startsWith("crop") || key.startsWith("name") || key === "geometryBorderRadius";
    const rect = local ? { width: target.clientWidth || target.offsetWidth, height: target.clientHeight || target.offsetHeight } : view.offsetParent?.getBoundingClientRect() ?? { width: win.innerWidth, height: win.innerHeight };
    const context = { width: rect.width, height: rect.height, viewportWidth: win.innerWidth, viewportHeight: win.innerHeight };
    let axis = /^(top|height|cropTop|cropBottom|overlayOffsetY|nameOffset)$/.test(key) ? "height" : "width";
    if (key === "nameFontSize") {
      const parent = view.querySelector(".charlemos-camera-name")?.parentElement ?? view;
      context.width = Number.parseFloat(win.getComputedStyle(parent).fontSize);
      axis = "width";
    }
    const before = buildFormData(this.cameraSession.draft.profile.layouts[this.selectedUserId])[key];
    const pixels = lengthPixels(before, axis, context);
    return pixels === null ? null : pixelsLength(pixels, `0${unit}`, axis, context);
  }

  updateBasicEffect(field) {
    const id = field.dataset.basicEffect;
    const definition = BASIC_EFFECTS[id];
    const layout = this.cameraSession.draft.profile.layouts[this.selectedUserId] ?? {};
    const value = updateBasicEffect(layout[definition.kind], id, field.value);
    if (value === null) return;
    this.cameraSession.edit(["profile", "layouts", this.selectedUserId, definition.kind], value);
    this.session.edit(["profile", "enabled"], true);
    refreshPreview();
  }

  toggleVisual() {
    if (this.visual) { this.visual.destroy(); this.visual = null; return; }
    this.session.preview = true;
    this.session.previewAudience = this.cameraAudience;
    refreshPreview();
    this.visual = new VisualCameraEditor({ session: this.cameraSession, onUpdate: refreshPreview, onCommit: () => this.render(true), onProblem: (key) => { this.message = t(key); this.render(true); } });
  }

  convertGeometry(absolute) {
    const view = resolveEditorCameraView(this.selectedUserId);
    if (!view || !window.confirm(t(absolute ? "convertAbsolute" : "convertPixels"))) return;
    const rect = view.getBoundingClientRect();
    this.session.beginGesture();
    for (const [key, value] of Object.entries({ left: view.offsetLeft, top: view.offsetTop, width: rect.width, height: rect.height })) {
      this.cameraSession.edit(["profile", "layouts", this.selectedUserId, key], `${value}px`);
    }
    if (absolute) {
      this.cameraSession.edit(["profile", "layouts", this.selectedUserId, "layoutMode"], "absolute");
      this.cameraSession.edit(["profile", "layouts", this.selectedUserId, "relative"], this.cameraAudience === "base" ? undefined : null);
    }
    this.session.endGesture();
  }

  moveSlot(action, index) {
    if (action === "slot-add") this.preset.users.push("");
    if (action === "slot-remove") this.preset.users.splice(index, 1);
    const next = action === "slot-up" ? index - 1 : action === "slot-down" ? index + 1 : -1;
    if (next >= 0 && next < this.preset.users.length) [this.preset.users[index], this.preset.users[next]] = [this.preset.users[next], this.preset.users[index]];
  }

  loadPreset() {
    const selected = this.preset.users.filter(Boolean);
    if (!selected.length || new Set(selected).size !== selected.length) { this.message = t("duplicateDestination"); return; }
    const built = presetResult(this.preset, this.element?.ownerDocument?.defaultView ?? window);
    if (built.ignoredUserIds.length && !window.confirm(t("acceptExclusions"))) return;
    this.session.edit(["profile"], compositionWithPreset(this.session.draft.profile, built));
    this.session.preview = true;
  }

  async copyComposition(wholeScene) {
    const sourceId = this.copySourceScene ?? this.session.sceneId;
    const source = sourceId === this.session.sceneId ? this.session.draft : readSceneConfiguration(sourceId);
    const destinationId = this.copyDestinationScene ?? this.session.sceneId;
    if (!this.copyCategories.length || (!wholeScene && !this.copyTargets.length)) return;
    if (!window.confirm(`${t("copyReview")}\n${this.copyCategories.map(t).join(", ")}\n${destinationId}`)) return;
    if (destinationId !== this.session.sceneId) {
      if (this.session.dirty && !window.confirm(t("discardConfirm"))) return;
      this.visual?.destroy(); this.visual = null;
      endEditSession();
      beginEditSession(destinationId);
    }
    this.session.beginGesture();
    const sourceUserId = this.copySourceUser ?? this.selectedUserId;
    const ids = wholeScene ? Object.keys(source.profile.layouts) : this.copyTargets;
    for (const id of ids) {
      if (!game.users.get(id)) continue;
      const layout = source.profile.layouts[wholeScene ? id : sourceUserId];
      if (!layout) continue;
      this.session.edit(["profile", "layouts", id], copyCameraCategories(this.session.draft.profile.layouts[id], layout, this.copyCategories));
    }
    this.session.edit(["profile", "enabled"], true);
    if (wholeScene && this.copyBackground) this.session.edit(["background"], source.background);
    if (this.copyCategories.includes("layout")) this.session.edit(["profile", "cameraControlMode"], source.profile.cameraControlMode);
    this.session.endGesture();
  }

  importLegacyLayouts() {
    if (!this.session) return;
    const legacy = game.settings.get(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS) ?? {};
    const layouts = foundry.utils.mergeObject(structuredClone(legacy), this.session.draft.profile.layouts, { inplace: false });
    this.session.beginGesture();
    this.session.edit(["profile", "layouts"], layouts);
    this.session.edit(["profile", "enabled"], true);
    this.session.endGesture();
  }

  resetSection() {
    const fields = { overlay: ["overlay"], name: ["nameStyle"], effects: ["transform", "filter", "clipPath", "geometry"], layout: ["layoutMode", "position", "top", "left", "width", "height", "relative", "crop"] }[this.section];
    this.session.beginGesture();
    for (const field of fields) this.cameraSession.edit(["profile", "layouts", this.selectedUserId, field], undefined);
    this.session.endGesture();
  }

  pickResource() {
    if (typeof FilePicker === "undefined") return;
    const session = this.session;
    const cameraSession = this.cameraSession;
    const userId = this.selectedUserId;
    new FilePicker({ type: "imagevideo", current: cameraSession.draft.profile.layouts[userId]?.overlay?.imageUrl ?? "", callback: (path) => {
      if (this.session !== session || session.busy) return;
      updateCameraField(cameraSession, userId, "overlayImage", path);
      this.checkMedia();
      refreshPreview();
      this.render(true);
    } }).render(true);
  }

  exportJsonConfig() {
    saveDataToFile(JSON.stringify(configurationBackup(), null, 2), "application/json", `${MODULE_ID}-config.json`);
    if (this.session?.dirty) this.message = t("backupExcludesDraft");
  }

  importJsonConfig() {
    if (this.session?.dirty) { this.message = t("resolveDraftFirst"); return; }
    const input = (this.element?.ownerDocument ?? document).createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      try {
        const inspection = inspectConfigurationImport(JSON.parse(await input.files[0].text()));
        if (!inspection) throw new Error("invalidImport");
        const references = importReferences(inspection);
        const mappings = Object.fromEntries(["scenes", "users"].map((kind) => [kind, Object.fromEntries(references[kind].map((id) => [id, game[kind]?.get?.(id) ? id : "__unresolved__"]))]));
        this.importState = { inspection, mode: "merge", plan: null, mappings, excluded: [] };
      } catch { this.message = t("invalidImport"); }
      this.render(true);
    });
    input.click();
  }

  reviewImport() {
    try {
      const inspection = this.mappedImport();
      this.importState.plan = prepareConfigurationImport(inspection, configurationBackup().settings, { mode: this.importState.mode });
    } catch (error) { this.message = t(error.message); }
  }

  mappedImport() {
    const { inspection, mode, excluded, mappings } = this.importState;
    const entries = importEntries(inspection);
    const selected = selectImportEntries(inspection, mode === "restore" ? [] : excluded.map((index) => entries[index]));
    return remapConfigurationImport(selected, mappings);
  }

  async confirmImport() {
    if (!this.importState?.plan || this.session?.dirty) return;
    const mapped = this.mappedImport();
    const refs = importReferences(mapped);
    if (refs.scenes.some((id) => !game.scenes?.get?.(id)) || refs.users.some((id) => !game.users?.get?.(id))) { this.message = t("unknownReferences"); return; }
    if (this.importState.mode === "restore" && !window.confirm(t("restoreConfirm"))) return;
    this.importBusy = true;
    try {
      const result = await applyConfigurationImport(this.importState.plan);
      this.message = t(result.ok ? "saved" : result.recovery === "incomplete" ? "recoveryIncomplete" : "recoveryComplete");
      if (result.ok) {
        this.importState = null;
        clearLoadedSceneProfileDraft();
      } else this.importState.plan = null;
    } finally { this.importBusy = false; }
  }

  async exportCurrentLayout() {
    if (!this.session) return;
    const draft = this.session.dirty && window.confirm(t("exportDraftConfirm"));
    if (draft && sessionErrors(this.session, usersForConfig()).length) return;
    const suggested = uniqueCompositionMacroName(game.scenes?.get?.(this.session.sceneId)?.name, t(draft ? "draftValue" : "savedValue"), (game.macros?.contents ?? []).map((macro) => macro.name), t("composition"));
    const name = window.prompt(t("macroName"), suggested);
    if (name === null) return;
    if ((game.macros?.contents ?? []).some((macro) => macro.name === (name.trim() || suggested)) && !window.confirm(t("macroNameExists"))) return;
    const profile = draft ? this.session.draft.profile : readSceneConfiguration(this.session.sceneId).profile;
    await exportSceneProfileToMacro(this.session.sceneId, { cameraControlMode: profile.cameraControlMode, layouts: profile.layouts, ...(profile.roleVariants ? { roleVariants: profile.roleVariants } : {}) }, name.trim() || suggested);
  }

  async loadDraft(sceneId, payload) {
    let variants;
    try { if (Object.hasOwn(payload, "roleVariants")) variants = normalizeRoleVariants(payload.roleVariants); }
    catch { this.message = t("roleVariantsInvalid"); await this.render(true); return false; }
    if (this.session?.dirty && !window.confirm(t("discardConfirm"))) return false;
    this.visual?.destroy(); this.visual = null;
    endEditSession();
    for (const [name, id] of this.editorHooks ?? []) Hooks.off(name, id);
    this.editorHooks = null;
    const session = beginEditSession(sceneId);
    session.edit(["profile"], { enabled: true, cameraControlMode: payload.cameraControlMode ?? "native", layouts: payload.layouts ?? {}, ...(variants ? { roleVariants: variants } : session.draft.profile.roleVariants ? { roleVariants: session.draft.profile.roleVariants } : {}) });
    await this.render(true);
    return true;
  }

  async refreshIfOpen() {
    if (!this.rendered || this.session?.busy || this.importBusy || this.library.busy || this.visual?.gesture) return;
    if (this.session && editSessionProblem(this.session) !== "sceneDeleted") this.session.reconcile(readSceneConfiguration(this.session.sceneId));
    if (this.element?.ownerDocument?.activeElement?.closest?.("[data-editor-form]") && !editSessionProblem(this.session)) return;
    await this.render(true);
  }

  async close(options = {}) {
    if (this.session?.busy || this.importBusy || this.library.busy) return this;
    if (this.session?.dirty && !options.discard) {
      this.closeRequested = true;
      await this.render(true);
      return this;
    }
    this.visual?.destroy();
    this.visual = null;
    this.mediaAbort?.abort();
    endEditSession();
    refreshPreview();
    for (const [name, id] of this.editorHooks ?? []) Hooks.off(name, id);
    this.editorHooks = null;
    this.closeRequested = false;
    return super.close(options);
  }

  render(options, ...args) {
    const existing = getApp();
    if (existing !== this && existing instanceof CameraEditorApp && existing.rendered) return existing.render(options, ...args);
    return super.render(options, ...args);
  }

  openLayoutConfig() { this.area = "cameras"; this.section = "layout"; return this.render(true); }
  openEffectsConfig() { this.area = "cameras"; this.section = "effects"; return this.render(true); }
  openOverlayConfig() { this.area = "cameras"; this.section = "overlay"; return this.render(true); }
  openNameConfig() { this.area = "cameras"; this.section = "name"; return this.render(true); }
  openSceneBackground() { this.area = "scene"; return this.render(true); }
  openScenePresets() { this.area = "scene"; return this.render(true); }
}
