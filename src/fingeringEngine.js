import { CHORDS } from "./chords.js";
import { evaluateVoicing, getRequiredFingeredNotes } from "./evaluation.js";
import { getFingerPosture } from "./posture.js";
import { applyHomography } from "./homography.js";
import { getFretFromU, getStringFromV, normalizedLandmarkToPixel } from "./fretboard.js";
import { CameraQualityMonitor } from "./cameraQuality.js";
import { FretPressClassifier } from "./fingerClassifier.js";
import { FingeringGrammar, buildValidVoicingDictionary } from "./fingeringGrammar.js";
import { LandmarkFilterBank, ProbabilitySmoother, StateDebouncer } from "./temporalFilters.js";
import { DEFAULT_VISION_CONFIG, mergeVisionConfig } from "./visionConfig.js";

const FINGERTIPS = [
  { finger: 1, name: "검지", landmarkIndex: 8 },
  { finger: 2, name: "중지", landmarkIndex: 12 },
  { finger: 3, name: "약지", landmarkIndex: 16 },
  { finger: 4, name: "새끼", landmarkIndex: 20 },
];

export class FingeringEngine {
  constructor(config = DEFAULT_VISION_CONFIG) {
    this.config = mergeVisionConfig(config);
    this.landmarkFilter = new LandmarkFilterBank(this.config.temporal.oneEuro);
    this.classifier = new FretPressClassifier(this.config.classifier);
    this.probabilitySmoother = new ProbabilitySmoother(this.config.temporal.probabilityEmaAlpha);
    this.stateDebouncer = new StateDebouncer(this.config.temporal.debouncer);
    this.qualityMonitor = new CameraQualityMonitor(this.config.cameraGuide);
    this.grammar = new FingeringGrammar(
      buildValidVoicingDictionary(CHORDS),
      this.config.grammar,
    );
  }

  process(frameInput = {}) {
    const rawHands = normalizeHands(frameInput.hands ?? []);
    const hands = this.config.temporal.enabled
      ? this.landmarkFilter.filterHands(rawHands, frameInput.t ?? 0)
      : rawHands;
    const input = { ...frameInput, hands };
    const observedFingers = this.detectFingers(input, rawHands);
    const quality = this.config.cameraGuide.enabled
      ? this.qualityMonitor.evaluate(input, observedFingers)
      : {
          score: 1,
          percent: 100,
          level: "good",
          gateGrading: false,
          metrics: {},
          primaryTip: "카메라 준비 완료",
        };
    const grammar = this.config.grammar.enabled
      ? this.grammar.mapSnap(observedFingers, {
          strictFinger: frameInput.evaluateOptions?.strictFinger,
          practiceSequence: frameInput.practiceSequence,
        })
      : null;
    const grading = this.grade(observedFingers, quality, frameInput);

    return {
      quality,
      observedFingers,
      grammar,
      grading,
    };
  }

  reset() {
    this.landmarkFilter.clear();
    this.probabilitySmoother.clear();
    this.stateDebouncer.clear();
    this.qualityMonitor.reset();
  }

  detectFingers(frameInput, rawHands) {
    const frame = frameInput.frame ?? { width: 1, height: 1 };
    const canvasLike = { width: frame.width, height: frame.height };
    const fretCount = frameInput.calibration?.fretCountK ?? 5;
    const observations = [];

    frameInput.hands.forEach((hand, handIndex) => {
      const rawHand = rawHands[handIndex] ?? hand;
      for (const tip of FINGERTIPS) {
        const landmark = hand.landmarks?.[tip.landmarkIndex];
        const rawLandmark = rawHand.landmarks?.[tip.landmarkIndex] ?? landmark;
        if (!landmark || !rawLandmark) continue;

        const rawPixel = normalizedLandmarkToPixel(rawLandmark, canvasLike, frameInput.isMirrored ?? true);
        const filteredPixel = normalizedLandmarkToPixel(landmark, canvasLike, frameInput.isMirrored ?? true);
        const mapped = frameInput.calibration
          ? applyHomography(frameInput.calibration.homographyImageToFretboard, filteredPixel)
          : null;
        const stringNumber = mapped ? getStringFromV(mapped.y) : null;
        const fret = mapped ? getFretFromU(mapped.x, fretCount) : null;
        const inFretboard = Boolean(mapped && stringNumber !== null && fret !== null);
        const posture = getFingerPosture(hand.landmarks, tip.finger);
        const base = {
          trackingId: `${hand.handIndex ?? handIndex}-${tip.finger}`,
          handIndex: hand.handIndex ?? handIndex,
          handedness: hand.handedness ?? "",
          confidence: hand.score ?? 0,
          finger: tip.finger,
          name: tip.name,
          landmarkIndex: tip.landmarkIndex,
          landmarks: hand.landmarks,
          rawPixel,
          filteredPixel,
          pixel: filteredPixel,
          fretboard: mapped ? { u: mapped.x, v: mapped.y } : null,
          string: stringNumber,
          fret,
          inFretboard,
          cellConfidence: inFretboard ? 1 : 0,
          posture,
        };
        const classified = this.classifier.classify(base, { fretCount });
        const stabilized = this.applyTemporalState(classified);
        observations.push(stabilized);
      }
    });

    return observations;
  }

  applyTemporalState(observation) {
    if (!this.config.temporal.enabled || observation.pressProbability === null) {
      return observation;
    }

    const pSmooth = this.probabilitySmoother.smooth(
      observation.trackingId,
      observation.pressProbability,
    );
    const debounced = this.stateDebouncer.update(observation.trackingId, pSmooth);
    const pressState = pSmooth >= this.config.classifier.pressAbove
      ? debounced.state
      : pSmooth <= this.config.classifier.liftBelow
        ? debounced.state
        : "UNKNOWN";

    return {
      ...observation,
      pSmooth,
      pressState,
      debouncedState: debounced,
      lowConfidence: observation.lowConfidence ||
        pressState === "UNKNOWN" ||
        (observation.confidence ?? 0) < this.config.classifier.unknownBelow,
    };
  }

  grade(observedFingers, quality, frameInput) {
    const targetChord = frameInput.targetChord;
    if (!targetChord) {
      return { match: null, reason: "no_target", evaluation: null };
    }

    if (this.config.cameraGuide.enabled && quality.gateGrading) {
      return { match: null, reason: "quality_gate", evaluation: null };
    }

    if (this.hasLowConfidenceForTarget(observedFingers, targetChord)) {
      return { match: null, reason: "low_confidence", evaluation: null };
    }

    const evaluation = evaluateVoicing(
      observedFingers,
      targetChord,
      frameInput.evaluateOptions ?? {},
    );
    return {
      match: evaluation.isCorrect,
      reason: evaluation.isCorrect ? "ok" : "needs_correction",
      evaluation,
    };
  }

  hasLowConfidenceForTarget(observedFingers, targetChord) {
    const required = getRequiredFingeredNotes(targetChord);
    if (!required.length || !observedFingers.length || !this.config.classifier.enabled) return false;

    const relevant = observedFingers.filter((observation) => (
      required.some((target) => Number(target.finger) === Number(observation.finger))
    ));
    if (!relevant.length) return false;
    const low = relevant.filter((observation) => observation.lowConfidence || (observation.confidence ?? 0) < this.config.classifier.unknownBelow);
    return low.length / relevant.length > 0.5;
  }
}

function normalizeHands(hands) {
  return hands.map((hand, index) => ({
    handIndex: hand.handIndex ?? index,
    handedness: hand.handedness ?? hand.categoryName ?? "",
    score: hand.score ?? hand.confidence ?? 0,
    landmarks: hand.landmarks ?? [],
  }));
}
