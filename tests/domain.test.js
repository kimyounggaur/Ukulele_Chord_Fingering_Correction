import test from "node:test";
import assert from "node:assert/strict";

import { CHORDS } from "../src/chords.js";
import {
  getFretFromU,
  getFretLines,
  getFretRatios,
  getStringFromV,
  getTargetFretboardPoint,
} from "../src/fretboard.js";
import {
  applyHomography,
  computeHomography,
  invertHomography,
} from "../src/homography.js";
import {
  evaluateVoicing,
  getRequiredFingeredNotes,
} from "../src/evaluation.js";
import {
  MovingAverageSmoother,
  StableEvaluationGate,
} from "../src/stability.js";

test("chords use ukulele G-C-E-A voicings in string order 4 to 1", () => {
  assert.deepEqual(
    CHORDS.C.strings.map((note) => note.string),
    [4, 3, 2, 1],
  );
  assert.deepEqual(getRequiredFingeredNotes(CHORDS.C), [
    { string: 1, fret: 3, finger: 3 },
  ]);
  assert.deepEqual(getRequiredFingeredNotes(CHORDS.Am), [
    { string: 4, fret: 2, finger: 2 },
  ]);
  assert.deepEqual(getRequiredFingeredNotes(CHORDS.F), [
    { string: 4, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
  ]);
});

test("string mapping uses four ukulele strings from v=0 to v=3", () => {
  assert.equal(getStringFromV(0), 4);
  assert.equal(getStringFromV(1), 3);
  assert.equal(getStringFromV(2), 2);
  assert.equal(getStringFromV(3), 1);
  assert.equal(getStringFromV(-0.39), 4);
  assert.equal(getStringFromV(3.39), 1);
  assert.equal(getStringFromV(-0.41), null);
  assert.equal(getStringFromV(3.41), null);
});

test("fret lines use equal-temperament spacing and map spaces to sounding frets", () => {
  const ratios = getFretRatios(5);
  assert.equal(ratios.length, 6);
  assert.equal(ratios[0], 0);
  assert.equal(ratios[5], 1);
  assert.ok(ratios[1] > 0);
  assert.ok(ratios[2] > ratios[1]);

  const lines = getFretLines(5);
  assert.equal(lines[0], 0);
  assert.equal(lines[5], 5);

  assert.equal(getFretFromU(0.03, 5), 0);
  assert.equal(getFretFromU((lines[0] + lines[1]) / 2, 5), 1);
  assert.equal(getFretFromU((lines[2] + lines[3]) / 2, 5), 3);
  assert.equal(getFretFromU(5.5, 5), null);
});

test("target positions convert ukulele strings and frets into fretboard coordinates", () => {
  const target = getTargetFretboardPoint(
    { string: 1, fret: 3, finger: 3 },
    5,
  );
  assert.equal(target.v, 3);
  assert.ok(target.u > 0);
  assert.ok(target.u < 5);
});

test("homography maps a four-point calibration and inverts back to pixels", () => {
  const src = [
    { x: 10, y: 20 },
    { x: 15, y: 120 },
    { x: 230, y: 130 },
    { x: 220, y: 25 },
  ];
  const dst = [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: 0 },
  ];

  const h = computeHomography(src, dst);
  const inverse = invertHomography(h);

  for (let index = 0; index < src.length; index += 1) {
    const mapped = applyHomography(h, src[index]);
    assert.ok(Math.abs(mapped.x - dst[index].x) < 1e-6);
    assert.ok(Math.abs(mapped.y - dst[index].y) < 1e-6);

    const restored = applyHomography(inverse, mapped);
    assert.ok(Math.abs(restored.x - src[index].x) < 1e-4);
    assert.ok(Math.abs(restored.y - src[index].y) < 1e-4);
  }
});

test("evaluateVoicing accepts correct single-finger C and Am chords", () => {
  const cResult = evaluateVoicing(
    [{ finger: 3, string: 1, fret: 3, inFretboard: true }],
    CHORDS.C,
    { strictFinger: true },
  );
  assert.equal(cResult.isCorrect, true);
  assert.equal(cResult.score, 1);
  assert.equal(cResult.requiredResults[0].status, "correct");

  const amResult = evaluateVoicing(
    [{ finger: 2, string: 4, fret: 2, inFretboard: true }],
    CHORDS.Am,
    { strictFinger: true },
  );
  assert.equal(amResult.isCorrect, true);
});

test("evaluateVoicing reports wrong positions, missing notes, extras, and numbered-string correction text", () => {
  const wrong = evaluateVoicing(
    [
      { finger: 3, string: 1, fret: 2, inFretboard: true },
      { finger: 1, string: 2, fret: 1, inFretboard: true },
    ],
    CHORDS.C,
    { strictFinger: true },
  );

  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.requiredResults[0].status, "wrong_position");
  assert.equal(wrong.extras.length, 1);
  assert.match(wrong.corrections[0].message, /약지/);
  assert.match(wrong.corrections[0].message, /1번줄 3프렛/);
  assert.match(wrong.corrections[0].message, /브리지 쪽으로 1프렛/);
  assert.doesNotMatch(wrong.corrections[0].message, /굵|얇/);

  const missing = evaluateVoicing([], CHORDS.C, { strictFinger: true });
  assert.equal(missing.requiredResults[0].status, "missing");
  assert.match(missing.corrections[0].message, /손을 지판 위에 올려주세요|약지를 1번줄 3프렛/);
});

test("moving average smoother keeps a rolling pixel average per finger", () => {
  const smoother = new MovingAverageSmoother(3);
  assert.deepEqual(smoother.add(1, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(smoother.add(1, { x: 3, y: 6 }), { x: 1.5, y: 3 });
  assert.deepEqual(smoother.add(1, { x: 6, y: 9 }), { x: 3, y: 5 });
  assert.deepEqual(smoother.add(1, { x: 9, y: 12 }), { x: 6, y: 9 });
});

test("stable evaluation gate waits 300ms for coaching and 700ms for success", () => {
  const gate = new StableEvaluationGate({
    wrongHoldMs: 300,
    correctHoldMs: 700,
  });
  const wrong = { isCorrect: false, signature: "C:wrong" };
  const correct = { isCorrect: true, signature: "C:correct" };

  assert.equal(gate.update(wrong, 1000).stableEvaluation, null);
  assert.equal(gate.update(wrong, 1299).stableEvaluation, null);
  assert.equal(gate.update(wrong, 1300).stableEvaluation.signature, "C:wrong");

  assert.equal(gate.update(correct, 2000).successJustConfirmed, false);
  assert.equal(gate.update(correct, 2699).successJustConfirmed, false);
  const success = gate.update(correct, 2700);
  assert.equal(success.stableEvaluation.signature, "C:correct");
  assert.equal(success.successJustConfirmed, true);
});
