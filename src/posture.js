const FINGER_JOINTS = {
  1: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  2: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  3: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  4: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

const DEFAULT_THRESHOLDS = {
  flatPipAngle: 166,
  flatDipAngle: 168,
};

export function calculateJointAngle(previous, joint, next) {
  if (!isPoint(previous) || !isPoint(joint) || !isPoint(next)) return null;

  const a = subtract(previous, joint);
  const b = subtract(next, joint);
  const magnitude = vectorLength(a) * vectorLength(b);
  if (magnitude === 0) return null;

  const cosine = clamp(dot(a, b) / magnitude, -1, 1);
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

export function getFingerPosture(landmarks, finger, thresholds = DEFAULT_THRESHOLDS) {
  const joints = FINGER_JOINTS[finger];
  if (!joints || !landmarks) return null;

  const pipAngle = calculateJointAngle(
    landmarks[joints.mcp],
    landmarks[joints.pip],
    landmarks[joints.dip],
  );
  const dipAngle = calculateJointAngle(
    landmarks[joints.pip],
    landmarks[joints.dip],
    landmarks[joints.tip],
  );
  const hasAngles = pipAngle !== null && dipAngle !== null;
  const isFlat = hasAngles &&
    pipAngle >= thresholds.flatPipAngle &&
    dipAngle >= thresholds.flatDipAngle;

  return {
    pipAngle,
    dipAngle,
    risk: Boolean(isFlat),
    riskType: isFlat ? "flat" : null,
  };
}

function isPoint(point) {
  return point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z ?? 0);
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
