import { editorButton, editorText, escapeEditorHtml } from "./editor-fields.js";
import { normalizeOverlayBlendMode, OVERLAY_BLEND_MODES } from "./overlay-blend.js";

export function applyFrameBlend(session, userId, mode) {
  if (!session || session.busy || !userId || !OVERLAY_BLEND_MODES.includes(mode)) return false;
  session.beginGesture();
  session.edit(["profile", "layouts", userId, "overlay", "blendMode"], mode);
  session.edit(["profile", "enabled"], true);
  session.endGesture();
  session.preview = true;
  return true;
}

export function frameBlendHtml(overlay) {
  const current = normalizeOverlayBlendMode(overlay?.blendMode);
  const text = (key) => escapeEditorHtml(editorText(key));
  return `<fieldset><legend>${text("frameBlend")}</legend><p>${text("frameBlendHelp")}</p>
    ${OVERLAY_BLEND_MODES.map((mode) => `<div>${editorButton("frame-blend", `frameBlend_${mode}`, `data-mode="${mode}" aria-pressed="${current === mode}"`)}<small>${text(`frameBlendHelp_${mode}`)}</small></div>`).join("")}</fieldset>`;
}

export const FRAME_PRESETS = {
  inside: { mode: "camera", top: 0, right: 0, bottom: 0, left: 0 },
  outside: { mode: "expanded", top: 10, right: 10, bottom: 10, left: 10 },
  lower: { mode: "expanded", top: 0, right: 0, bottom: 25, left: 0 }
};

export function applyFramePreset(session, userId, presetId) {
  if (!session || session.busy || !userId || !Object.hasOwn(FRAME_PRESETS, presetId)) return false;
  const path = ["profile", "layouts", userId, "overlay"];
  session.beginGesture();
  session.edit([...path, "bounds"], FRAME_PRESETS[presetId]);
  for (const [field, value] of Object.entries({ fitMode: "contain", anchor: "center", scale: 1, rotate: 0 })) {
    session.edit([...path, field], value);
  }
  session.edit([...path, "offset", "x"], "0px");
  session.edit([...path, "offset", "y"], "0px");
  session.edit(["profile", "enabled"], true);
  session.endGesture();
  session.preview = true;
  return true;
}

function presetDiagram(bounds) {
  const width = 100 + bounds.left + bounds.right;
  const height = 100 + bounds.top + bounds.bottom;
  return `<div class="charlemos-frame-diagram" aria-hidden="true"><span class="charlemos-frame-diagram-camera" style="left:${100 * bounds.left / width}%;top:${100 * bounds.top / height}%;width:${10000 / width}%;height:${10000 / height}%"></span></div>`;
}

export function framePresetsHtml() {
  const text = (key) => escapeEditorHtml(editorText(key));
  return `<fieldset class="charlemos-frame-presets"><legend>${text("framePresets")}</legend>
    <p>${text("framePresetsHelp")}</p><div class="charlemos-frame-preset-grid">${Object.entries(FRAME_PRESETS).map(([id, bounds]) =>
      `<div>${presetDiagram(bounds)}${editorButton("frame-preset", `framePreset_${id}`, `data-preset="${id}"`)}<small>${text(`framePresetHelp_${id}`)}</small></div>`
    ).join("")}</div><p>${text("framePresetDiagramHelp")}</p><p>${text("framePresetAssetHelp")}</p></fieldset>`;
}
