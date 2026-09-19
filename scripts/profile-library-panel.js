import { editorText as t, escapeEditorHtml as esc, editorButton as button, selectControl } from "./editor-fields.js";
import { readProfileLibrary, normalizeProfileLibrary, templateFromProfile, templateUserIds, profileWithTemplate, writeProfileTemplate } from "./profile-library.js";
import { cloneConfiguration, configurationEqual } from "./edit-session.js";
import { editSessionProblem, readSceneConfiguration, getEditSession } from "./edit-runtime.js";
import { profileCameraIds } from "./role-variants.js";

function select(name, value, choices, label) {
  return `<label class="charlemos-field">${esc(label)}${selectControl(name, value, choices)}</label>`;
}

export class ProfileLibraryPanel {
  constructor(validateProfile) {
    this.validateProfile = validateProfile;
    this.selectedId = "";
    this.snapshot = null;
    this.mappings = {};
    this.source = "saved";
    this.name = "";
    this.busy = false;
  }

  selectTemplate(id, users) {
    normalizeProfileLibrary(readProfileLibrary());
    this.selectedId = id;
    this.snapshot = cloneConfiguration(readProfileLibrary()[id] ?? null);
    this.name = this.snapshot?.name ?? "";
    this.mappings = this.snapshot ? Object.fromEntries(templateUserIds(this.snapshot).map((userId) => [userId, users.some((user) => user.id === userId) ? userId : "__unresolved__"])) : {};
  }

  html(session, users) {
    let library;
    try { library = normalizeProfileLibrary(readProfileLibrary()); }
    catch { return `<p role="alert">${esc(t("templateInvalid"))}</p>`; }
    const entries = Object.entries(library).sort((a, b) => a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]));
    const stale = this.snapshot && !configurationEqual(readProfileLibrary()[this.selectedId], this.snapshot);
    const blocked = !this.snapshot || stale || this.busy ? "disabled" : "";
    return `<fieldset ${this.busy ? "disabled" : ""}><legend>${esc(t("templateLibrary"))}</legend><p>${esc(t("templateLibraryHelp"))}</p>
      ${select("templateSelection", this.selectedId, [{ id: "", label: t("templateChoose") }, ...entries.map(([id, entry]) => ({ id, label: `${entry.name} (${profileCameraIds(entry.profile).length}) · ${id}` }))], t("templateLibrary"))}
      ${stale ? `<p role="alert">${esc(t("templateChanged"))}</p>` : ""}
      ${button("template-refresh", "templateRefresh")}
      <label class="charlemos-field">${esc(t("templateName"))}<input name="templateName" maxlength="120" value="${esc(this.name)}"></label>
      ${select("templateSource", this.source, ["saved", "draft"].map((id) => ({ id, label: t(id === "saved" ? "savedValue" : "draftValue") })), t("templateSource"))}
      <p>${esc(t("templateWriteHelp"))}</p>
      ${button("template-create", "templateCreate", !session ? "disabled" : "")}
      ${button("template-replace", "templateReplace", !session ? "disabled" : blocked)}
      ${button("template-rename", "templateRename", blocked)}${button("template-delete", "templateDelete", blocked)}
      ${this.snapshot ? `<p>${esc(this.snapshot.name)} · ${esc(t("templateRevision"))} ${this.snapshot.revision} · ${esc(t(this.snapshot.profile.cameraControlMode === "module" ? "module" : "native"))}</p>${this.mappingHtml(users)}` : ""}
      <p>${esc(t("templateLoadHelp"))}</p>${button("template-load", "templateLoad", !session ? "disabled" : blocked)}</fieldset>`;
  }

  mappingHtml(users) {
    const choices = [{ id: "__unresolved__", label: t("assignDestination") }, { id: "", label: t("exclude") }, ...users.map((user) => ({ id: user.id, label: `${user.name} (${user.id})` }))];
    return templateUserIds(this.snapshot).map((id, index) => select(`template-map-${index}`, this.mappings[id], choices, `${t("sourceCamera")}: ${users.find((user) => user.id === id)?.name ?? t("unavailable")} (${id})`)).join("");
  }

  change(field, users) {
    if (field.name === "templateSelection") this.selectTemplate(field.value, users);
    if (field.name === "templateName") this.name = field.value;
    if (field.name === "templateSource" && ["saved", "draft"].includes(field.value)) this.source = field.value;
    if (field.name?.startsWith("template-map-") && this.snapshot) {
      const id = templateUserIds(this.snapshot)[Number(field.name.slice(13))];
      if (id) this.mappings[id] = field.value;
    }
  }

  currentEntry() {
    if (!this.snapshot || !configurationEqual(readProfileLibrary()[this.selectedId], this.snapshot)) throw new Error("templateChanged");
    return cloneConfiguration(this.snapshot);
  }

  sourceProfile(session) {
    if (session !== getEditSession()) throw new Error("profilesChanged");
    const problem = editSessionProblem(session);
    if (problem) throw new Error(problem);
    const profile = this.source === "draft" ? session.draft.profile : readSceneConfiguration(session.sceneId).profile;
    if (this.validateProfile(profile).length) throw new Error("templateInvalidDraft");
    return cloneConfiguration(profile);
  }

  load(session, users, confirm) {
    const problem = editSessionProblem(session);
    if (problem) throw new Error(problem);
    const entry = this.currentEntry();
    const previous = cloneConfiguration(session.draft.profile);
    const next = profileWithTemplate(entry, previous, this.mappings, users);
    if (this.validateProfile(next).length) throw new Error("templateInvalidDraft");
    const summary = templateUserIds(entry).map((id) => `${id} → ${this.mappings[id] || t("exclude")}`).join("\n");
    if (!confirm(`${t("templateLoadConfirm")}\n${entry.name} → ${game.scenes.get(session.sceneId).name} (${session.sceneId})\n${summary}`)) return false;
    this.currentEntry();
    if (session !== getEditSession() || editSessionProblem(session) || !configurationEqual(previous, session.draft.profile)) throw new Error("profilesChanged");
    profileWithTemplate(entry, previous, this.mappings, game.users.contents ?? users);
    session.edit(["profile"], next);
    session.preview = true;
    return true;
  }

  async handle(action, session, users, confirm) {
    if (!game.user?.isGM) return t("permission");
    if (this.busy || session?.busy) return t("busy");
    if (!["template-refresh", "template-load", "template-create", "template-replace", "template-rename", "template-delete"].includes(action)) return t("templateInvalid");
    try {
      if (action === "template-refresh") { this.selectTemplate(this.selectedId, users); return ""; }
      if (action === "template-load") return this.load(session, users, confirm) ? t("templateLoaded") : "";
      this.busy = true;
      return await this.write(action, session, users, confirm);
    } catch (error) { return t(error.message); }
    finally { this.busy = false; }
  }

  async write(action, session, users, confirm) {
    const create = action === "template-create";
    const expected = create ? undefined : this.currentEntry();
    const id = create ? (globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID()) : this.selectedId;
    let entry;
    if (action === "template-delete") entry = null;
    else {
      const profile = action === "template-rename" ? expected.profile : this.sourceProfile(session);
      entry = templateFromProfile(this.name, profile, (expected?.revision ?? 0) + 1);
    }
    const key = action === "template-delete" ? "templateDeleteConfirm" : "templateSaveConfirm";
    if (!confirm(`${t(key)}\n${entry?.name ?? expected.name}${create || action === "template-replace" ? `\n${session.sceneId} · ${t(this.source === "draft" ? "draftValue" : "savedValue")}` : ""}`)) return "";
    if (create || action === "template-replace") {
      const latest = templateFromProfile(this.name, this.sourceProfile(session), entry.revision);
      if (!configurationEqual(latest, entry)) throw new Error("profilesChanged");
    }
    const result = await writeProfileTemplate(id, entry, expected);
    if (!result.ok) return t(result.reason ?? (result.recovery === "incomplete" ? "recoveryIncomplete" : "recoveryComplete"));
    this.selectTemplate(entry ? id : "", users);
    return t("templateSaved");
  }
}
