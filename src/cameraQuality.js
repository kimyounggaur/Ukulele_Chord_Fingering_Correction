import { DEFAULT_VISION_CONFIG } from "./visionConfig.js";

export class CameraQualityMonitor {
  constructor(config = DEFAULT_VISION_CONFIG.cameraGuide) {
    this.config = { ...DEFAULT_VISION_CONFIG.cameraGuide, ...config };
    this.previousCenter = null;
  }

  evaluate(frameInput = {}, observations = []) {
    const hands = frameInput.hands ?? [];
    const frame = frameInput.frame ?? { width: 1, height: 1 };
    const bbox = getHandsBbox(hands);
    const metrics = {
      detection: getDetectionScore(hands),
      handSize: bbox ? getHandSizeScore(bbox, this.config.targetHandArea) : 0,
      frameMargin: bbox ? getFrameMarginScore(bbox, this.config.minFrameMargin) : 0,
      brightness: getBrightnessScore(frameInput.brightnessSample, this.config.brightnessRange),
      motion: bbox ? this.getMotionScore(bbox, frame) : 1,
      fretboardPerspective: getPerspectiveScore(frameInput.calibration),
    };

    if (hands.length === 1) {
      metrics.detection = Math.min(metrics.detection, 0.72);
    }

    const score = weightedAverage(metrics);
    const level = score < this.config.gateBelow
      ? "bad"
      : score < this.config.warnBelow
        ? "warn"
        : "good";
    const gateGrading = score < this.config.gateBelow;
    const primaryTip = getPrimaryTip(metrics, hands.length, bbox);

    return {
      score,
      percent: Math.round(score * 100),
      level,
      gateGrading,
      metrics,
      primaryTip,
      observationsSeen: observations.length,
    };
  }

  reset() {
    this.previousCenter = null;
  }

  getMotionScore(bbox, frame) {
    const center = {
      x: ((bbox.minX + bbox.maxX) / 2) * frame.width,
      y: ((bbox.minY + bbox.maxY) / 2) * frame.height,
    };
    if (!this.previousCenter) {
      this.previousCenter = center;
      return 1;
    }

    const distance = Math.hypot(center.x - this.previousCenter.x, center.y - this.previousCenter.y);
    this.previousCenter = center;
    return clamp(1 - distance / this.config.maxMotionPxPerFrame, 0, 1);
  }
}

function getDetectionScore(hands) {
  if (!hands.length) return 0;
  const average = hands.reduce((sum, hand) => sum + (hand.score ?? 0), 0) / hands.length;
  return clamp(average, 0, 1);
}

function getHandsBbox(hands) {
  const points = hands.flatMap((hand) => hand.landmarks ?? []);
  if (!points.length) return null;
  return points.reduce((bbox, point) => ({
    minX: Math.min(bbox.minX, point.x),
    minY: Math.min(bbox.minY, point.y),
    maxX: Math.max(bbox.maxX, point.x),
    maxY: Math.max(bbox.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function getHandSizeScore(bbox, target) {
  const area = Math.max(0, bbox.maxX - bbox.minX) * Math.max(0, bbox.maxY - bbox.minY);
  if (area < target.min) return clamp(area / target.min, 0, 1);
  if (area > target.max) return clamp(target.max / area, 0, 1);
  return 1;
}

function getFrameMarginScore(bbox, minMargin) {
  const margin = Math.min(bbox.minX, bbox.minY, 1 - bbox.maxX, 1 - bbox.maxY);
  return clamp(margin / minMargin, 0, 1);
}

function getBrightnessScore(sample, range) {
  if (!Number.isFinite(sample)) return 1;
  if (sample < range.min) return clamp(sample / range.min, 0, 1);
  if (sample > range.max) return clamp((255 - sample) / (255 - range.max), 0, 1);
  return 1;
}

function getPerspectiveScore(calibration) {
  const points = calibration?.clickedPoints;
  if (!Array.isArray(points) || points.length !== 4) return 1;

  const [topLeft, bottomLeft, bottomRight, topRight] = points;
  const top = distance(topLeft, topRight);
  const bottom = distance(bottomLeft, bottomRight);
  const left = distance(topLeft, bottomLeft);
  const right = distance(topRight, bottomRight);
  const horizontal = ratioScore(top, bottom);
  const vertical = ratioScore(left, right);
  return clamp(Math.min(horizontal, vertical), 0, 1);
}

function ratioScore(a, b) {
  if (a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return clamp((ratio - 0.15) / 0.85, 0, 1);
}

function weightedAverage(metrics) {
  const weights = {
    detection: 0.26,
    handSize: 0.18,
    frameMargin: 0.16,
    brightness: 0.12,
    motion: 0.12,
    fretboardPerspective: 0.16,
  };
  return Object.entries(weights).reduce((sum, [key, weight]) => (
    sum + metrics[key] * weight
  ), 0);
}

function getPrimaryTip(metrics, handCount, bbox) {
  if (handCount === 0) return "손을 화면에 보여주세요.";
  const entries = Object.entries(metrics).sort((a, b) => a[1] - b[1]);
  const [lowest] = entries[0];
  if (lowest === "detection") return handCount < 2 ? "양손을 모두 화면에 보여주세요." : "손 인식이 불안정합니다. 배경과 손을 더 분리하세요.";
  if (lowest === "handSize") {
    const area = bbox ? (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY) : 0;
    return area < DEFAULT_VISION_CONFIG.cameraGuide.targetHandArea.min
      ? "손과 지판을 카메라에 더 가까이 두어 크게 보여주세요."
      : "손과 지판을 카메라에서 조금 뒤로 두세요.";
  }
  if (lowest === "frameMargin") return "손끝이 잘리지 않게 화면 중앙으로 옮기세요.";
  if (lowest === "brightness") return "손과 지판이 더 밝게 보이도록 조명을 켜세요.";
  if (lowest === "motion") return "손과 지판을 잠시 고정하세요.";
  if (lowest === "fretboardPerspective") return "지판을 카메라 정면에 더 가깝게 맞추세요.";
  return "카메라 준비 완료";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
