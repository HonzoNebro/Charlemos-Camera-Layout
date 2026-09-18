import { cloneConfiguration, setConfigurationValue } from "./edit-session.js";
import { buildSceneLayoutPreset } from "./scene-layout-presets.js";
import { editorText as t, escapeEditorHtml as esc, editorButton as button, selectControl } from "./editor-fields.js";
import { resolveEditorCameraView } from "./camera-video-source.js";

export const COPY_CATEGORIES = {
  layout: ["layoutMode", "position", "top", "left", "width", "height", "relative", "crop"],
  effects: ["transform", "filter", "clipPath", "geometry"],
  overlay: ["overlay"],
  name: ["nameStyle"]
};

export function copyCameraCategories(target, source, categories) {
  let next = cloneConfiguration(target ?? {});
  for (const category of categories) {
    for (const key of COPY_CATEGORIES[category] ?? []) next = setConfigurationValue(next, [key], source?.[key]);
  }
  if (next.overlay) delete next.overlay.userId;
  return next;
}

export function compositionWithPreset(profile, built) {
  const next = cloneConfiguration(profile);
  next.enabled = true;
  next.cameraControlMode = "module";
  next.layouts ??= {};
  for (const [id, patch] of Object.entries(built.layouts)) next.layouts[id] = { ...next.layouts[id], ...patch };
  return next;
}

export function initialPreset(users) {
  return { rows: 2, cols: 2, layoutType: "grid", presetId: "roleplayWide", aspectRatio: "4:3", unitMode: "responsive", gap: 12, marginX: 12, marginY: 12, users: users.filter((user) => user.active).map((user) => user.id) };
}

export function presetResult(state, viewport) {
  const feeds = state.users.filter(Boolean).flatMap((id) => Array.from(resolveEditorCameraView(id)?.querySelectorAll?.("video") ?? []))
    .filter((video) => !video.closest?.(".charlemos-camera-overlay") && video.videoWidth > 0 && video.videoHeight > 0)
    .sort((a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight);
  const feed = feeds[0];
  return buildSceneLayoutPreset(state.users.map((id) => id || undefined), {
    ...state, ...(feed ? { feedWidth: feed.videoWidth, feedHeight: feed.videoHeight } : {}),
    viewportWidth: viewport.innerWidth, viewportHeight: viewport.innerHeight
  });
}

export function presetHtml(state, users, viewport) {
  const built = presetResult(state, viewport);
  const select = (name, choices) => `<label>${esc(t(name))}${selectControl(`preset-${name}`, state[name], choices.map((id) => ({ id, label: t(id) === `${"charlemos-camera-layout"}.ui.editor.${id}` ? id : t(id) })))}</label>`;
  const numbers = ["rows", "cols", "gap", "marginX", "marginY"].map((name) => `<label>${esc(t(name))}<input type="number" name="preset-${name}" min="${["rows", "cols"].includes(name) ? 1 : 0}" max="${name === "rows" ? 6 : name === "cols" ? 8 : 256}" value="${state[name]}"></label>`).join("");
  const choices = [{ id: "", label: t("emptySlot") }, ...users.map((user) => ({ id: user.id, label: user.name }))];
  return `<fieldset><legend>${esc(t("distribution"))}</legend><p>${esc(t("presetHelp"))}</p>
    ${select("layoutType", ["grid", "narrative"])}${select("presetId", ["roleplayWide", "mapBottomStrip", "sideDock"])}
    ${select("aspectRatio", ["4:3", "16:9", "1:1", "feed"])}${select("unitMode", ["responsive", "px"])}${numbers}
    <ol>${state.users.map((id, index) => `<li draggable="true" data-slot="${index}">${selectControl(`slot-${index}`, id, choices)}${button("slot-up", "moveUp", `data-index="${index}"`)}${button("slot-down", "moveDown", `data-index="${index}"`)}${button("slot-remove", "remove", `data-index="${index}"`)}</li>`).join("")}</ol>
    ${button("slot-add", "addSlot")}<div class="charlemos-preset-preview" role="img" aria-label="${esc(t("distribution"))}">${Object.entries(built.layouts).map(([id, layout]) => {
      const percent = (value, total) => value?.endsWith("px") ? Number.parseFloat(value) / total * 100 : Number.parseFloat(value);
      return `<span style="left:${percent(layout.left, viewport.innerWidth)}%;top:${percent(layout.top, viewport.innerHeight)}%;width:${percent(layout.width, viewport.innerWidth)}%;height:${percent(layout.height, viewport.innerHeight)}%">${esc(users.find((user) => user.id === id)?.name ?? id)}</span>`;
    }).join("")}</div>
    ${built.ignoredUserIds.length ? `<p role="alert">${esc(t("excludedCameras"))}: ${built.ignoredUserIds.map((id) => esc(users.find((user) => user.id === id)?.name ?? id)).join(", ")}</p>` : ""}
    ${button("load-preset", "loadDraft")}</fieldset>`;
}
