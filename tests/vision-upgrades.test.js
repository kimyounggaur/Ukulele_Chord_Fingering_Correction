import test from "node:test";
import assert from "node:assert/strict";

import { CHORDS } from "../src/chords.js";
import { evaluateVoicing } from "../src/evaluation.js";
import { getTargetFretboardPoint } from "../src/fretboard.js";
import { applyHomography, computeHomography, invertHomography } from "../src/homography.js";
import { DEFAULT_VISION_CONFIG } from "../src/visionConfig.js";
import {
  FretPressClassifier,
  extractFingerFeatures,
  normalizeHand,
} from "../src/fingerClassifier.js";
import {
  LandmarkFilterBank,
  OneEuroFilter,
  ProbabilitySmoother,
  StateDebouncer,
} from "../src/temporalFilters.js";
import { CameraQualityMonitor } from "../src/cameraQuality.js";
import {
  FingeringGrammar,
  buildValidVoicingDictionary,
  scoreObservationAgainstVoicing,
} from "../src/fingeringGrammar.js";
import { FingeringEngine } from "../src/fingeringEngine.js";

test("vision config keeps safety gates enabled and prior out of grading", () => {
  assert.equal(DEFAULT_VISION_CONFIG.classifier.enabled, true);
  assert.equal(DEFAULT_VISION_CONFIG.temporal.enabled, true);
  assert.equal(DEFAULT_VISION_CONFIG.cameraGuide.enabled, true);
  assert.equal(DEFAULT_VISION_CONFIG.grammar.enabled, true);
  assert.equal(DEFAULT_VISION_CONFIG.grammar.applyToGrading, false);
});

test("normalizeHand removes translation and scale from landmark geometry", () => {
  const base = makeLandmarks({
    0: { x: 1, y: 1, z: 0 },
    5: { x: 1.5, y: 2, z: 0 },
    8: { x: 1.6, y: 2.5, z: 0.1 },
    9: { x: 1, y: 3, z: 0 },
  });
  const movedAndScaled = base.map((point) => ({
    x: point.x * 2 + 9,
    y: point.y * 2 - 4,
    z: point.z * 2,
  }));

  const normalizedBase = normalizeHand(base);
  const normalizedMoved = normalizeHand(movedAndScaled);

  assert.equal(normalizedBase.valid, true);
  assert.equal(normalizedMoved.valid, true);
  assert.ok(Math.abs(normalizedBase.landmarks[8].x - normalizedMoved.landmarks[8].x) < 1e-9);
  assert.ok(Math.abs(normalizedBase.landmarks[8].y - normalizedMoved.landmarks[8].y) < 1e-9);
  assert.ok(Math.abs(normalizedBase.landmarks[8].z - normalizedMoved.landmarks[8].z) < 1e-9);
});

test("finger classifier scores centered curved fingertips higher than invalid or flat ones", () => {
  const landmarks = makeLandmarks({
    0: { x: 0, y: 0, z: 0 },
    9: { x: 0, y: 1, z: 0 },
    13: { x: 0, y: 0, z: 0 },
    14: { x: 0, y: 1, z: 0 },
    15: { x: 0.45, y: 1.45, z: -0.05 },
    16: { x: 0.95, y: 1.15, z: -0.08 },
  });
  const fretboard = getTargetFretboardPoint({ string: 1, fret: 3 }, 5);
  const centered = {
    finger: 3,
    string: 1,
    fret: 3,
    inFretboard: true,
    fretboard,
    posture: { risk: false, pipAngle: 112, dipAngle: 96 },
  };
  const edge = {
    ...centered,
    fretboard: { u: fretboard.u + 0.55, v: fretboard.v + 0.45 },
  };
  const outside = {
    ...centered,
    string: null,
    fret: null,
    inFretboard: false,
    fretboard: null,
  };

  const centerFeatures = extractFingerFeatures({ landmarks, observation: centered, fretCount: 5 });
  const edgeFeatures = extractFingerFeatures({ landmarks, observation: edge, fretCount: 5 });
  const outsideFeatures = extractFingerFeatures({ landmarks, observation: outside, fretCount: 5 });

  assert.ok(centerFeatures.cellCenterScore > edgeFeatures.cellCenterScore);
  assert.equal(outsideFeatures.inFretboardScore, 0);

  const classifier = new FretPressClassifier();
  const pressed = classifier.classify({ ...centered, landmarks }, { fretCount: 5 });
  const flat = classifier.classify({
    ...centered,
    landmarks,
    posture: { risk: true, pipAngle: 178, dipAngle: 175 },
  }, { fretCount: 5 });
  const lifted = classifier.classify({ ...outside, landmarks }, { fretCount: 5 });

  assert.ok(pressed.pressProbability >= DEFAULT_VISION_CONFIG.classifier.pressAbove);
  assert.equal(pressed.pressState, "PRESS");
  assert.ok(flat.pressProbability < pressed.pressProbability);
  assert.ok(lifted.pressProbability <= DEFAULT_VISION_CONFIG.classifier.liftBelow);
});

test("OneEuroFilter adapts to jumps and filter bank isolates hands", () => {
  const slow = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 });
  const adaptive = new OneEuroFilter({ minCutoff: 1, beta: 1, dCutoff: 1 });

  assert.equal(adaptive.filter(0, 0), 0);
  adaptive.filter(0, 16);
  slow.filter(0, 0);
  slow.filter(0, 16);

  const slowJump = slow.filter(10, 32);
  const adaptiveJump = adaptive.filter(10, 32);
  assert.ok(adaptiveJump > slowJump);

  const bank = new LandmarkFilterBank({ minCutoff: 1, beta: 0.02, dCutoff: 1 });
  const hands = [
    { handIndex: 0, landmarks: makeLandmarks({ 8: { x: 0.1, y: 0.1, z: 0 } }) },
    { handIndex: 1, landmarks: makeLandmarks({ 8: { x: 0.9, y: 0.9, z: 0 } }) },
  ];
  const filtered = bank.filterHands(hands, 0);
  assert.equal(filtered[0].landmarks[8].x, 0.1);
  assert.equal(filtered[1].landmarks[8].x, 0.9);
});

test("probability smoother and state debouncer stabilize press lift states", () => {
  const smoother = new ProbabilitySmoother(0.5);
  assert.equal(smoother.smooth("f1", 0.2), 0.2);
  assert.equal(smoother.smooth("f1", 0.8), 0.5);
  smoother.reset("f1");
  assert.equal(smoother.smooth("f1", 0.9), 0.9);

  const debouncer = new StateDebouncer({ pressHigh: 0.6, liftLow: 0.4, minFrames: 2 });
  assert.equal(debouncer.update("f1", 0.7).state, "LIFT");
  const pressed = debouncer.update("f1", 0.7);
  assert.equal(pressed.state, "PRESS");
  assert.equal(pressed.changed, true);
  assert.equal(debouncer.update("f1", 0.5).state, "PRESS");
  assert.equal(debouncer.update("f1", 0.2).state, "PRESS");
  const lifted = debouncer.update("f1", 0.2);
  assert.equal(lifted.state, "LIFT");
});

test("camera quality monitor gives concrete tips and gates bad frames", () => {
  const monitor = new CameraQualityMonitor();

  const empty = monitor.evaluate({ frame: { width: 1000, height: 800 }, hands: [] });
  assert.equal(empty.gateGrading, true);
  assert.match(empty.primaryTip, /손을 화면/);

  const tinyHand = monitor.evaluate({
    frame: { width: 1000, height: 800 },
    hands: [{ handIndex: 0, score: 0.95, landmarks: makeNormalizedBox(0.1, 0.1, 0.15, 0.15) }],
  });
  assert.ok(tinyHand.metrics.handSize < 0.5);
  assert.match(tinyHand.primaryTip, /가까이|크게/);

  const dark = monitor.evaluate({
    frame: { width: 1000, height: 800 },
    hands: [{ handIndex: 0, score: 0.95, landmarks: makeNormalizedBox(0.2, 0.2, 0.6, 0.6) }],
    brightnessSample: 20,
  });
  assert.ok(dark.metrics.brightness < 0.5);

  const skewed = monitor.evaluate({
    frame: { width: 1000, height: 800 },
    hands: [{ handIndex: 0, score: 0.95, landmarks: makeNormalizedBox(0.2, 0.2, 0.6, 0.6) }],
    calibration: {
      clickedPoints: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 900, y: 105 },
        { x: 160, y: 4 },
      ],
    },
  });
  assert.ok(skewed.metrics.fretboardPerspective < 0.8);
});

test("fingering grammar ranks candidates, reports ambiguity, and stays out of grading", () => {
  const dictionary = buildValidVoicingDictionary(CHORDS);
  assert.equal(dictionary.length, Object.keys(CHORDS).length);

  const cObservation = [
    { finger: 3, string: 1, fret: 3, inFretboard: true, pressState: "PRESS", pSmooth: 0.9 },
  ];
  const cScore = scoreObservationAgainstVoicing(cObservation, CHORDS.C);
  const amScore = scoreObservationAgainstVoicing(cObservation, CHORDS.Am);
  assert.ok(cScore.score > amScore.score);

  const grammar = new FingeringGrammar(dictionary, { ...DEFAULT_VISION_CONFIG.grammar, ambiguityGap: 100 });
  const snapped = grammar.mapSnap(cObservation);
  assert.equal(snapped.snappedChordId, "C");
  assert.equal(snapped.ambiguous, true);
  assert.ok(snapped.alternatives.some((candidate) => candidate.chordId === "C7"));

  const wrongForC = [{ finger: 3, string: 1, fret: 2, inFretboard: true, pressState: "PRESS", pSmooth: 0.9 }];
  const grammarResult = grammar.mapSnap(wrongForC, { candidateChordIds: ["C"] });
  const directEvaluation = evaluateVoicing(wrongForC, CHORDS.C, { strictFinger: true });
  assert.equal(grammarResult.snappedChordId, "C");
  assert.equal(directEvaluation.isCorrect, false);
  assert.equal(directEvaluation.requiredResults[0].status, "wrong_position");
});

test("fingering engine preserves direct grading and gates low quality or low confidence", () => {
  const calibration = makeCalibration();
  const cPoint = pointForNote(calibration, { string: 1, fret: 3 });
  const landmarks = makeLandmarks({
    8: { x: -0.5, y: -0.5, z: 0 },
    12: { x: -0.5, y: -0.5, z: 0 },
    9: { x: 0.4, y: 0.2, z: 0 },
    13: { x: 0.4, y: 0.4, z: 0 },
    14: { x: 0.42, y: 0.48, z: 0 },
    15: { x: 0.46, y: 0.53, z: -0.03 },
    16: { x: cPoint.x / 500, y: cPoint.y / 300, z: -0.06 },
    20: { x: -0.5, y: -0.5, z: 0 },
  });
  const baseFrame = {
    t: 1000,
    frame: { width: 500, height: 300 },
    isMirrored: false,
    calibration,
    targetChord: CHORDS.C,
    evaluateOptions: { strictFinger: true },
    hands: [{ handIndex: 0, handedness: "Left", score: 0.95, landmarks }],
    brightnessSample: 120,
  };

  const directEngine = new FingeringEngine({
    ...DEFAULT_VISION_CONFIG,
    classifier: { ...DEFAULT_VISION_CONFIG.classifier, enabled: false },
    temporal: { ...DEFAULT_VISION_CONFIG.temporal, enabled: false },
    cameraGuide: { ...DEFAULT_VISION_CONFIG.cameraGuide, enabled: false },
    grammar: { ...DEFAULT_VISION_CONFIG.grammar, enabled: false },
  });
  const direct = directEngine.process(baseFrame);
  assert.equal(direct.grading.match, true);
  assert.equal(direct.grading.evaluation.isCorrect, true);

  const gatedEngine = new FingeringEngine(DEFAULT_VISION_CONFIG);
  const gated = gatedEngine.process({ ...baseFrame, hands: [] });
  assert.equal(gated.grading.match, null);
  assert.equal(gated.grading.reason, "quality_gate");

  const lowConfidenceEngine = new FingeringEngine({
    ...DEFAULT_VISION_CONFIG,
    cameraGuide: { ...DEFAULT_VISION_CONFIG.cameraGuide, enabled: false },
  });
  const lowConfidence = lowConfidenceEngine.process({
    ...baseFrame,
    hands: [{ ...baseFrame.hands[0], score: 0.2 }],
  });
  assert.equal(lowConfidence.grading.match, null);
  assert.equal(lowConfidence.grading.reason, "low_confidence");
});

function makeLandmarks(overrides = {}) {
  return Array.from({ length: 21 }, (_, index) => (
    overrides[index] ?? { x: index * 0.01, y: index * 0.01, z: 0 }
  ));
}

function makeNormalizedBox(minX, minY, maxX, maxY) {
  return Array.from({ length: 21 }, (_, index) => {
    const ratio = index / 20;
    return {
      x: minX + (maxX - minX) * ratio,
      y: minY + (maxY - minY) * ((index * 7) % 20) / 20,
      z: 0,
    };
  });
}

function makeCalibration() {
  const src = [
    { x: 0, y: 0 },
    { x: 0, y: 300 },
    { x: 500, y: 300 },
    { x: 500, y: 0 },
  ];
  const dst = [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: 0 },
  ];
  const homographyImageToFretboard = computeHomography(src, dst);
  return {
    fretCountK: 5,
    clickedPoints: src,
    homographyImageToFretboard,
    homographyFretboardToImage: invertHomography(homographyImageToFretboard),
  };
}

function pointForNote(calibration, note) {
  const target = getTargetFretboardPoint(note, calibration.fretCountK);
  return applyHomography(calibration.homographyFretboardToImage, { x: target.u, y: target.v });
}
