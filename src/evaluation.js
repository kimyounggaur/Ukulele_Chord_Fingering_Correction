import { FINGER_NAMES } from "./chords.js";

export function getRequiredFingeredNotes(chord) {
  return chord.strings.filter((note) => typeof note.fret === "number" && note.fret > 0);
}

export function getOpenStrings(chord) {
  return chord.strings.filter((note) => note.fret === 0);
}

export function getMutedStrings(chord) {
  return chord.strings.filter((note) => note.fret === "x");
}

export function evaluateVoicing(detectedFingers, chord, options = {}) {
  const strictFinger = options.strictFinger ?? false;
  const requireMute = options.requireMute ?? false;
  const required = getRequiredFingeredNotes(chord);
  const mutedStrings = getMutedStrings(chord);
  const candidates = normalizeDetected(detectedFingers);
  const usedFingerIndexes = new Set();
  const requiredResults = [];

  for (const target of required) {
    const exactIndex = candidates.findIndex((candidate, index) => {
      if (usedFingerIndexes.has(index)) return false;
      return candidate.string === target.string &&
        candidate.fret === target.fret &&
        (!strictFinger || candidate.finger === target.finger);
    });

    if (exactIndex !== -1) {
      usedFingerIndexes.add(exactIndex);
      requiredResults.push({
        target,
        status: "correct",
        matchedFinger: candidates[exactIndex],
        delta: { string: 0, fret: 0 },
        message: `${fingerName(candidates[exactIndex].finger)}가 ${target.string}번줄 ${target.fret}프렛에 있습니다.`,
      });
      continue;
    }

    const wrongIndex = candidates.findIndex((candidate, index) => {
      if (usedFingerIndexes.has(index)) return false;
      return candidate.finger === target.finger;
    });

    if (wrongIndex !== -1) {
      usedFingerIndexes.add(wrongIndex);
      const matchedFinger = candidates[wrongIndex];
      const delta = {
        string: target.string - matchedFinger.string,
        fret: target.fret - matchedFinger.fret,
      };
      requiredResults.push({
        target,
        status: "wrong_position",
        matchedFinger,
        delta,
        message: buildMoveMessage(target, matchedFinger),
      });
      continue;
    }

    requiredResults.push({
      target,
      status: "missing",
      matchedFinger: null,
      delta: null,
      message: buildMissingMessage(target, candidates.length),
    });
  }

  const extras = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => !usedFingerIndexes.has(index) && candidate.fret > 0)
    .filter(({ candidate }) => {
      if (!requireMute) return true;
      return !mutedStrings.some((note) => note.string === candidate.string);
    })
    .map(({ candidate }) => ({
      finger: candidate.finger,
      string: candidate.string,
      fret: candidate.fret,
      trackingId: candidate.trackingId,
      pixel: candidate.pixel,
      detectedFinger: candidate,
      message: `${fingerName(candidate.finger)}는 지금 불필요하게 ${candidate.string}번줄 ${candidate.fret}프렛에 있습니다.`,
    }));

  const correctCount = requiredResults.filter((result) => result.status === "correct").length;
  const score = required.length === 0 ? 1 : correctCount / required.length;
  const isCorrect = required.length > 0 && correctCount === required.length && extras.length === 0;
  const corrections = [
    ...requiredResults
      .filter((result) => result.status === "missing" || result.status === "wrong_position")
      .map((result) => ({
        finger: result.target.finger,
        from: result.matchedFinger
          ? { string: result.matchedFinger.string, fret: result.matchedFinger.fret }
          : null,
        to: { string: result.target.string, fret: result.target.fret },
        message: result.message,
        status: result.status,
      })),
    ...extras.map((extra) => ({
      finger: extra.finger,
      from: { string: extra.string, fret: extra.fret },
      to: null,
      message: extra.message,
      status: "extra",
    })),
  ];

  const statusText = getStatusText(isCorrect, score, candidates.length);
  const signature = createEvaluationSignature(chord, requiredResults, extras);

  return {
    chordId: chord.id,
    score,
    scoreText: `${correctCount}/${required.length}`,
    percent: Math.round(score * 100),
    isCorrect,
    statusText,
    requiredResults,
    extras,
    corrections,
    signature,
  };
}

function normalizeDetected(detectedFingers) {
  return (detectedFingers ?? [])
    .filter((finger) => finger && finger.inFretboard !== false)
    .filter((finger) => finger.string !== null && finger.string !== undefined)
    .filter((finger) => finger.fret !== null && finger.fret !== undefined)
    .map((finger) => ({
      ...finger,
      finger: Number(finger.finger),
      string: Number(finger.string),
      fret: Number(finger.fret),
    }))
    .filter((finger) => Number.isFinite(finger.finger) && Number.isFinite(finger.string) && Number.isFinite(finger.fret));
}

function buildMissingMessage(target, detectedCount) {
  const prefix = detectedCount === 0 ? "손을 지판 위에 올려주세요. " : "";
  return `${prefix}${fingerName(target.finger)}를 ${target.string}번줄 ${target.fret}프렛에 놓으세요.`;
}

function buildMoveMessage(target, current) {
  const moves = [];
  const fretDelta = target.fret - current.fret;
  const stringDelta = target.string - current.string;

  if (stringDelta > 0) {
    moves.push(`4번줄 쪽으로 ${Math.abs(stringDelta)}줄`);
  } else if (stringDelta < 0) {
    moves.push(`1번줄 쪽으로 ${Math.abs(stringDelta)}줄`);
  }

  if (fretDelta > 0) {
    moves.push(`브리지 쪽으로 ${fretDelta}프렛`);
  } else if (fretDelta < 0) {
    moves.push(`너트 쪽으로 ${Math.abs(fretDelta)}프렛`);
  }

  const moveText = moves.length > 0 ? `${moves.join(", ")} 이동해 ` : "";
  return `${fingerName(target.finger)}를 ${moveText}${target.string}번줄 ${target.fret}프렛에 놓으세요.`;
}

function fingerName(finger) {
  return FINGER_NAMES[finger] ?? `${finger}번 손가락`;
}

function getStatusText(isCorrect, score, detectedCount) {
  if (isCorrect) return "정확합니다";
  if (detectedCount === 0) return "손을 지판 위에 올려주세요";
  if (score >= 0.67) return "거의 맞아요";
  return "교정이 필요해요";
}

function createEvaluationSignature(chord, requiredResults, extras) {
  const requiredPart = requiredResults
    .map((result) => {
      const matched = result.matchedFinger
        ? `${result.matchedFinger.finger}:${result.matchedFinger.string}:${result.matchedFinger.fret}`
        : "none";
      return `${result.target.string}:${result.target.fret}:${result.target.finger}:${result.status}:${matched}`;
    })
    .join("|");
  const extrasPart = extras
    .map((extra) => `${extra.finger}:${extra.string}:${extra.fret}`)
    .join("|");
  return `${chord.id}:${requiredPart}:extras=${extrasPart}`;
}
