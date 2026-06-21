export const STRING_COUNT = 4;
export const DEFAULT_FRET_COUNT = 5;

export function getFretRatios(fretCount = DEFAULT_FRET_COUNT) {
  if (!Number.isFinite(fretCount) || fretCount < 1) {
    throw new Error("fretCount must be a positive number");
  }

  const denominator = 1 - Math.pow(2, -fretCount / 12);
  return Array.from({ length: fretCount + 1 }, (_, fret) => {
    if (fret === 0) return 0;
    if (fret === fretCount) return 1;
    return (1 - Math.pow(2, -fret / 12)) / denominator;
  });
}

export function getFretLines(fretCount = DEFAULT_FRET_COUNT) {
  return getFretRatios(fretCount).map((ratio) => ratio * fretCount);
}

export function getStringFromV(v, tolerance = 0.4) {
  if (!Number.isFinite(v)) return null;
  if (v < -tolerance || v > STRING_COUNT - 1 + tolerance) return null;

  const nearestIndex = Math.round(v);
  if (nearestIndex < 0 || nearestIndex > STRING_COUNT - 1) return null;
  return STRING_COUNT - nearestIndex;
}

export function getVFromString(stringNumber) {
  if (!Number.isFinite(stringNumber) || stringNumber < 1 || stringNumber > STRING_COUNT) {
    return null;
  }
  return STRING_COUNT - stringNumber;
}

export function getFretFromU(u, fretCount = DEFAULT_FRET_COUNT, options = {}) {
  const tolerance = options.tolerance ?? 0.15;
  const openThreshold = options.openThreshold ?? 0.08;

  if (!Number.isFinite(u)) return null;
  if (u < -tolerance || u > fretCount + tolerance) return null;
  if (u <= openThreshold) return 0;

  const lines = getFretLines(fretCount);
  const clampedU = Math.min(Math.max(u, 0), fretCount);

  for (let fret = 1; fret <= fretCount; fret += 1) {
    if (clampedU <= lines[fret]) {
      return fret;
    }
  }

  return fretCount;
}

export function getFretCenterU(fret, fretCount = DEFAULT_FRET_COUNT) {
  if (fret === 0) return 0;
  if (!Number.isFinite(fret) || fret < 0 || fret > fretCount) return null;

  const lines = getFretLines(fretCount);
  return (lines[fret - 1] + lines[fret]) / 2;
}

export function getTargetFretboardPoint(note, fretCount = DEFAULT_FRET_COUNT) {
  const v = getVFromString(note.string);
  const u = getFretCenterU(note.fret, fretCount);
  if (v === null || u === null) return null;
  return { u, v };
}

export function canvasEventToPixel(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function normalizedLandmarkToPixel(landmark, canvas, mirrored = true) {
  return {
    x: (mirrored ? 1 - landmark.x : landmark.x) * canvas.width,
    y: landmark.y * canvas.height,
  };
}
