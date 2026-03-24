const PRESET_MAP = {
  manual: {},
  topLeft: {
    position: "absolute",
    top: "8px",
    left: "8px"
  },
  topRight: {
    position: "absolute",
    top: "8px",
    left: "calc(100vw - 22vw - 8px)"
  },
  bottomLeft: {
    position: "absolute",
    top: "calc(100vh - 22vh - 8px)",
    left: "8px"
  },
  bottomRight: {
    position: "absolute",
    top: "calc(100vh - 22vh - 8px)",
    left: "calc(100vw - 22vw - 8px)"
  },
  compactBottom: {
    position: "absolute",
    top: "calc(100vh - 16vh - 6px)",
    left: "2vw"
  },
  compactSide: {
    position: "absolute",
    top: "12vh",
    left: "2vw"
  }
};

function copyPatch(patch) {
  return {
    ...patch,
    overlay: { ...(patch?.overlay ?? {}) },
    nameStyle: { ...(patch?.nameStyle ?? {}) },
    geometry: { ...(patch?.geometry ?? {}) },
    snap: { ...(patch?.snap ?? {}) }
  };
}

function parseSnapValue(value) {
  const match = /^(-?\d+(?:\.\d+)?)(px)?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const number = Number.parseFloat(match[1]);
  if (Number.isNaN(number)) return null;
  const unit = match[2] ?? "";
  return { number, unit };
}

function snapLengthValue(value, gridSize) {
  const parsed = parseSnapValue(value);
  if (!parsed) return value;
  const snapped = Math.round(parsed.number / gridSize) * gridSize;
  return `${snapped}${parsed.unit}`;
}

function normalizeGridSize(size) {
  const parsed = Number.parseInt(String(size ?? "10"), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 10;
  return parsed;
}

export function getPresetIds() {
  return Object.keys(PRESET_MAP);
}

export function applyPresetToLayoutPatch(patch, presetId) {
  const preset = PRESET_MAP[presetId];
  if (!preset || presetId === "manual") return copyPatch(patch);
  return {
    ...copyPatch(patch),
    ...preset
  };
}

export function applySnapToLayoutPatch(patch) {
  const next = copyPatch(patch);
  const snapEnabled = Boolean(next?.snap?.enabled);
  if (!snapEnabled) return next;
  const gridSize = normalizeGridSize(next?.snap?.size);
  next.snap.size = gridSize;
  next.top = snapLengthValue(next.top, gridSize);
  next.left = snapLengthValue(next.left, gridSize);
  return next;
}
