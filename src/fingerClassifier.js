import { getTargetFretboardPoint } from "./fretboard.js";
import { calculateJointAngle } from "./posture.js";
import { DEFAULT_VISION_CONFIG } from "./visionConfig.js";

const FINGER_JOINTS = {
  1: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  2: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  3: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  4: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

export function normalizeHand(landmarks) {
  if (!Array.isArray(landmarks) || !landmarks[0] || !landmarks[9]) {
    return { landmarks: landmarks ?? [], scale: 1, angle: 0, valid: false };
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const scale = Math.hypot(dx, dy);

  if (!Number.isFinite(scale) || scale <= 1e-9) {
    return { landmarks, scale: 1, angle: 0, valid: false };
  }

  const angle = Math.PI / 2 - Math.atan2(dy, dx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const normalized = landmarks.map((point) => {
    const x = (point.x - wrist.x) / scale;
    const y = (point.y - wrist.y) / scale;
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos,
      z: ((point.z ?? 0) - (wrist.z ?? 0)) / scale,
    };
  });

  return { landmarks: normalized, scale, angle, valid: true };
}

export function extractFingerFeatures({ landmarks, observation, finger, fretCount = 5 }) {
  const targetFinger = Number(observation?.finger ?? finger);
  const joints = FINGER_JOINTS[targetFinger];
  const inFretboardScore = observation?.inFretboard &&
    observation.string !== null &&
    observation.string !== undefined &&
    observation.fret !== null &&
    observation.fret !== undefined
    ? 1
    : 0;

  const cellCenterScore = inFretboardScore
    ? getCellCenterScore(observation, fretCount)
    : 0;
  const curlScore = joints && landmarks
    ? getCurlScore(landmarks, joints, observation?.posture)
    : 0;
  const depthScore = joints && landmarks
    ? getDepthScore(landmarks, joints)
    : 0;
  const postureScore = observation?.posture?.risk ? 0 : 1;

  return {
    inFretboardScore,
    cellCenterScore,
    curlScore,
    depthScore,
    postureScore,
  };
}

export class FretPressClassifier {
  constructor(config = DEFAULT_VISION_CONFIG.classifier) {
    this.config = { ...DEFAULT_VISION_CONFIG.classifier, ...config };
  }

  classify(observation, context = {}) {
    if (!this.config.enabled) {
      return {
        ...observation,
        pressFeatures: null,
        pressProbability: null,
        pSmooth: null,
        pressState: null,
        lowConfidence: false,
        classificationReason: "classifier_disabled",
      };
    }

    const features = extractFingerFeatures({
      landmarks: observation.landmarks,
      observation,
      finger: observation.finger,
      fretCount: context.fretCount ?? 5,
    });
    const weighted =
      features.cellCenterScore * this.config.cellCenterWeight +
      features.curlScore * this.config.curlWeight +
      features.depthScore * this.config.depthWeight +
      features.postureScore * this.config.postureWeight;
    const probability = features.inFretboardScore ? clamp(weighted, 0, 1) : 0;
    const state = getPressState(probability, this.config);

    return {
      ...observation,
      pressFeatures: features,
      pressProbability: probability,
      pSmooth: probability,
      pressState: state,
      lowConfidence: state === "UNKNOWN" || (observation.confidence ?? 1) < this.config.unknownBelow,
      classificationReason: state.toLowerCase(),
    };
  }
}

function getCellCenterScore(observation, fretCount) {
  const fretboard = observation.fretboard;
  if (!fretboard || observation.fret === 0) return observation.fret === 0 ? 0.45 : 0;
  const target = getTargetFretboardPoint(
    { string: observation.string, fret: observation.fret, finger: observation.finger },
    fretCount,
  );
  if (!target) return 0;

  const du = Math.abs(fretboard.u - target.u) / 0.7;
  const dv = Math.abs(fretboard.v - target.v) / 0.6;
  return clamp(1 - Math.hypot(du, dv), 0, 1);
}

function getCurlScore(landmarks, joints, posture) {
  const pipAngle = posture?.pipAngle ?? calculateJointAngle(
    landmarks[joints.mcp],
    landmarks[joints.pip],
    landmarks[joints.dip],
  );
  const dipAngle = posture?.dipAngle ?? calculateJointAngle(
    landmarks[joints.pip],
    landmarks[joints.dip],
    landmarks[joints.tip],
  );
  if (pipAngle === null || dipAngle === null) return 0.45;

  const average = (pipAngle + dipAngle) / 2;
  const curl = clamp((180 - average) / 95, 0, 1);
  return posture?.risk ? curl * 0.35 : curl;
}

function getDepthScore(landmarks, joints) {
  const tip = landmarks[joints.tip];
  const mcp = landmarks[joints.mcp];
  if (!tip || !mcp) return 0.5;
  const delta = Math.abs((tip.z ?? 0) - (mcp.z ?? 0));
  return clamp(0.45 + delta * 2.5, 0, 1);
}

function getPressState(probability, config) {
  if (probability >= config.pressAbove) return "PRESS";
  if (probability <= config.liftBelow) return "LIFT";
  return "UNKNOWN";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
