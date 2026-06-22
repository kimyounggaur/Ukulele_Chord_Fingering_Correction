export const DEFAULT_VISION_CONFIG = {
  // 손끝이 지판 셀을 실제로 누르는 상태에 가까운지 추정한다.
  classifier: {
    enabled: true,
    unknownBelow: 0.45,
    pressAbove: 0.62,
    liftBelow: 0.38,
    cellCenterWeight: 0.45,
    curlWeight: 0.25,
    depthWeight: 0.15,
    postureWeight: 0.15,
  },
  // landmark 좌표, press 확률, PRESS/LIFT 상태의 시간적 흔들림을 줄인다.
  temporal: {
    enabled: true,
    oneEuro: {
      minCutoff: 1.0,
      beta: 0.02,
      dCutoff: 1.0,
    },
    probabilityEmaAlpha: 0.6,
    debouncer: {
      pressHigh: 0.62,
      liftLow: 0.38,
      minFrames: 3,
    },
  },
  // 카메라 배치가 나쁠 때 오답으로 단정하지 않고 채점을 보류한다.
  cameraGuide: {
    enabled: true,
    gateBelow: 0.48,
    warnBelow: 0.68,
    targetHandArea: { min: 0.06, max: 0.28 },
    minFrameMargin: 0.04,
    brightnessRange: { min: 45, max: 230 },
    maxMotionPxPerFrame: 42,
  },
  // 코드 사전 기반 prior는 표시와 애매성 안내에만 사용한다.
  grammar: {
    enabled: true,
    applyToGrading: false,
    ambiguityGap: 1.5,
    eps: 0.001,
    physicalConstraints: {
      maxFretSpan: 4,
      preventSameCellDuplicates: true,
      preferFingerOrder: true,
    },
  },
  debug: false,
};

export function mergeVisionConfig(overrides = {}) {
  return mergeDeep(DEFAULT_VISION_CONFIG, overrides);
}

function mergeDeep(base, overrides) {
  if (!isPlainObject(base)) return overrides ?? base;
  const merged = { ...base };

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      merged[key] = mergeDeep(base[key], value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
