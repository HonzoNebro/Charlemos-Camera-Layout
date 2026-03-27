const NARRATIVE_LAYOUT_PRESETS = {
  roleplayWide: { rows: 2, cols: 2 },
  mapBottomStrip: { rows: 1, cols: 6 },
  sideDock: { rows: 4, cols: 1 }
};

function normalizeNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function normalizePositiveNumber(value, fallback) {
  const parsed = normalizeNumber(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function normalizeIntegerInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUnitMode(value) {
  return String(value ?? "").trim() === "px" ? "px" : "responsive";
}

function normalizeLayoutType(value) {
  return String(value ?? "").trim() === "narrative" ? "narrative" : "grid";
}

function resolvePresetDefinition(layoutType, presetId, rows, cols) {
  if (normalizeLayoutType(layoutType) === "narrative") return NARRATIVE_LAYOUT_PRESETS[presetId] ?? null;
  return {
    rows: normalizeIntegerInRange(rows, 2, 1, 6),
    cols: normalizeIntegerInRange(cols, 2, 1, 8)
  };
}

function responsiveLength(value, axis) {
  const suffix = axis === "x" ? "vw" : "vh";
  return `${Number(value.toFixed(4))}${suffix}`;
}

function pixelLength(value) {
  return `${Math.max(1, Math.floor(value))}px`;
}

function buildResponsiveLayouts(users, preset, options) {
  const gap = normalizePositiveNumber(options.gap, 1);
  const marginX = normalizePositiveNumber(options.marginX, 2);
  const marginY = normalizePositiveNumber(options.marginY, 2);
  const totalGapX = gap * Math.max(0, preset.cols - 1);
  const totalGapY = gap * Math.max(0, preset.rows - 1);
  const width = Math.max(0.1, (100 - marginX * 2 - totalGapX) / preset.cols);
  const height = Math.max(0.1, (100 - marginY * 2 - totalGapY) / preset.rows);

  return Object.fromEntries(
    users.map((userId, index) => {
      const row = Math.floor(index / preset.cols);
      const col = index % preset.cols;
      return [
        userId,
        {
          position: "absolute",
          top: responsiveLength(marginY + row * (height + gap), "y"),
          left: responsiveLength(marginX + col * (width + gap), "x"),
          width: responsiveLength(width, "x"),
          height: responsiveLength(height, "y"),
          relative: {
            targetUserId: null,
            placement: "none",
            gap: null
          }
        }
      ];
    })
  );
}

function buildPixelLayouts(users, preset, options) {
  const viewportWidth = normalizePositiveNumber(options.viewportWidth, 1280);
  const viewportHeight = normalizePositiveNumber(options.viewportHeight, 720);
  const gap = normalizePositiveNumber(options.gap, 8);
  const marginX = normalizePositiveNumber(options.marginX, 8);
  const marginY = normalizePositiveNumber(options.marginY, 8);
  const totalGapX = gap * Math.max(0, preset.cols - 1);
  const totalGapY = gap * Math.max(0, preset.rows - 1);
  const width = Math.max(1, (viewportWidth - marginX * 2 - totalGapX) / preset.cols);
  const height = Math.max(1, (viewportHeight - marginY * 2 - totalGapY) / preset.rows);

  return Object.fromEntries(
    users.map((userId, index) => {
      const row = Math.floor(index / preset.cols);
      const col = index % preset.cols;
      return [
        userId,
        {
          position: "absolute",
          top: pixelLength(marginY + row * (height + gap)),
          left: pixelLength(marginX + col * (width + gap)),
          width: pixelLength(width),
          height: pixelLength(height),
          relative: {
            targetUserId: null,
            placement: "none",
            gap: null
          }
        }
      ];
    })
  );
}

export function getNarrativeSceneLayoutPresetIds() {
  return Object.keys(NARRATIVE_LAYOUT_PRESETS);
}

export function buildSceneLayoutPreset(layoutUserIds, options = {}) {
  const users = Array.isArray(layoutUserIds) ? layoutUserIds.filter(Boolean) : [];
  const layoutType = normalizeLayoutType(options.layoutType);
  const preset = resolvePresetDefinition(layoutType, options.presetId, options.rows, options.cols);
  if (!preset) return { capacity: 0, ignoredUserIds: [...users], layouts: {}, unitMode: normalizeUnitMode(options.unitMode), layoutType };

  const capacity = preset.rows * preset.cols;
  const placedUserIds = users.slice(0, capacity);
  const ignoredUserIds = users.slice(capacity);
  const unitMode = normalizeUnitMode(options.unitMode);
  const layouts = unitMode === "px" ? buildPixelLayouts(placedUserIds, preset, options) : buildResponsiveLayouts(placedUserIds, preset, options);

  return {
    capacity,
    ignoredUserIds,
    layouts,
    unitMode,
    layoutType,
    rows: preset.rows,
    cols: preset.cols
  };
}
