const NARRATIVE_LAYOUT_PRESETS = {
  roleplayWide: { rows: 2, cols: 2 },
  mapBottomStrip: { rows: 1, cols: 6 },
  sideDock: { rows: 4, cols: 1 }
};

const DEFAULT_FEED_BOUNDS = {
  width: 320,
  height: 240
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

function normalizeAspectRatio(value) {
  const text = String(value ?? "").trim();
  if (text === "feed" || text === "16:9" || text === "1:1") return text;
  return "4:3";
}

function aspectRatioParts(value) {
  const text = normalizeAspectRatio(value);
  if (text === "feed") return null;
  const [width, height] = text.split(":").map((part) => Number.parseFloat(part));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function normalizeFeedDimensions(options = {}) {
  const width = normalizePositiveNumber(options.feedWidth, DEFAULT_FEED_BOUNDS.width);
  const height = normalizePositiveNumber(options.feedHeight, DEFAULT_FEED_BOUNDS.height);
  const ratio = aspectRatioParts(options.aspectRatio);
  if (!ratio) {
    return {
      width: Math.max(1, width),
      height: Math.max(1, height)
    };
  }
  const boundedWidth = Math.max(1, width);
  const boundedHeight = Math.max(1, height);
  const scale = Math.min(boundedWidth / ratio.width, boundedHeight / ratio.height);
  return {
    width: Math.max(1, ratio.width * scale),
    height: Math.max(1, ratio.height * scale)
  };
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

function gridGeometry(preset, options) {
  const feed = normalizeFeedDimensions(options);
  const viewportWidth = normalizePositiveNumber(options.viewportWidth, 1280);
  const viewportHeight = normalizePositiveNumber(options.viewportHeight, 720);
  const gap = normalizePositiveNumber(options.gap, 1);
  const marginX = normalizePositiveNumber(options.marginX, 2);
  const marginY = normalizePositiveNumber(options.marginY, 2);
  const totalGapX = gap * Math.max(0, preset.cols - 1);
  const totalGapY = gap * Math.max(0, preset.rows - 1);
  const availableWidth = Math.max(1, viewportWidth - marginX * 2 - totalGapX);
  const availableHeight = Math.max(1, viewportHeight - marginY * 2 - totalGapY);
  const widthLimit = availableWidth / preset.cols;
  const heightLimit = availableHeight / preset.rows;
  const scale = Math.min(widthLimit / feed.width, heightLimit / feed.height, 1);
  const widthPx = Math.max(1, feed.width * scale);
  const heightPx = Math.max(1, feed.height * scale);
  const usedWidth = widthPx * preset.cols + totalGapX;
  const usedHeight = heightPx * preset.rows + totalGapY;
  const startX = marginX + Math.max(0, (availableWidth - widthPx * preset.cols) / 2);
  const startY = marginY + Math.max(0, (availableHeight - heightPx * preset.rows) / 2);
  return {
    gap,
    widthPx,
    heightPx,
    startX,
    startY,
    viewportWidth,
    viewportHeight,
    usedWidth,
    usedHeight
  };
}

function buildResponsiveLayouts(users, preset, options) {
  const geometry = gridGeometry(preset, options);
  const width = (geometry.widthPx / geometry.viewportWidth) * 100;
  const height = (geometry.heightPx / geometry.viewportHeight) * 100;

  return Object.fromEntries(
    users.map((userId, index) => {
      const row = Math.floor(index / preset.cols);
      const col = index % preset.cols;
      const topPx = geometry.startY + row * (geometry.heightPx + geometry.gap);
      const leftPx = geometry.startX + col * (geometry.widthPx + geometry.gap);
      return [
        userId,
        {
          position: "absolute",
          top: responsiveLength((topPx / geometry.viewportHeight) * 100, "y"),
          left: responsiveLength((leftPx / geometry.viewportWidth) * 100, "x"),
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
  const geometry = gridGeometry(preset, options);

  return Object.fromEntries(
    users.map((userId, index) => {
      const row = Math.floor(index / preset.cols);
      const col = index % preset.cols;
      const top = geometry.startY + row * (geometry.heightPx + geometry.gap);
      const left = geometry.startX + col * (geometry.widthPx + geometry.gap);
      return [
        userId,
        {
          position: "absolute",
          top: pixelLength(top),
          left: pixelLength(left),
          width: pixelLength(geometry.widthPx),
          height: pixelLength(geometry.heightPx),
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
    aspectRatio: normalizeAspectRatio(options.aspectRatio),
    rows: preset.rows,
    cols: preset.cols
  };
}
