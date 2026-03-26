const SCENE_LAYOUT_PRESETS = {
  grid1x2: { rows: 1, cols: 2 },
  grid1x3: { rows: 1, cols: 3 },
  grid2x2: { rows: 2, cols: 2 },
  grid2x3: { rows: 2, cols: 3 },
  grid2x4: { rows: 2, cols: 4 }
};

function normalizeNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function normalizePositiveNumber(value, fallback) {
  const parsed = normalizeNumber(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

export function getSceneLayoutPresetIds() {
  return Object.keys(SCENE_LAYOUT_PRESETS);
}

export function getSceneLayoutPresetDefinition(presetId) {
  return SCENE_LAYOUT_PRESETS[presetId] ?? null;
}

export function buildSceneLayoutPreset(layoutUserIds, presetId, options = {}) {
  const preset = getSceneLayoutPresetDefinition(presetId);
  if (!preset) return { capacity: 0, ignoredUserIds: [...(layoutUserIds ?? [])], layouts: {} };

  const users = Array.isArray(layoutUserIds) ? layoutUserIds.filter(Boolean) : [];
  const viewportWidth = normalizePositiveNumber(options.viewportWidth, 1280);
  const viewportHeight = normalizePositiveNumber(options.viewportHeight, 720);
  const gap = normalizePositiveNumber(options.gap, 8);
  const marginX = normalizePositiveNumber(options.marginX, 8);
  const marginY = normalizePositiveNumber(options.marginY, 8);
  const capacity = preset.rows * preset.cols;
  const placedUserIds = users.slice(0, capacity);
  const ignoredUserIds = users.slice(capacity);
  const totalGapX = gap * Math.max(0, preset.cols - 1);
  const totalGapY = gap * Math.max(0, preset.rows - 1);
  const width = Math.max(1, Math.floor((viewportWidth - marginX * 2 - totalGapX) / preset.cols));
  const height = Math.max(1, Math.floor((viewportHeight - marginY * 2 - totalGapY) / preset.rows));

  const layouts = Object.fromEntries(
    placedUserIds.map((userId, index) => {
      const row = Math.floor(index / preset.cols);
      const col = index % preset.cols;
      return [
        userId,
        {
          position: "absolute",
          top: `${marginY + row * (height + gap)}px`,
          left: `${marginX + col * (width + gap)}px`,
          width: `${width}px`,
          height: `${height}px`,
          relative: {
            targetUserId: null,
            placement: "none",
            gap: null
          }
        }
      ];
    })
  );

  return {
    capacity,
    ignoredUserIds,
    layouts
  };
}
