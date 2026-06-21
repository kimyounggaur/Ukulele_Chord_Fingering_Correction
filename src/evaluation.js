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
  const checkPosture = options.checkPosture ?? false;
  const requireMute = options.requireMute ?? false;
  const required = getRequiredFingeredNotes(chord);
  const requiredGroups = collectTargetGroups(required);
  const mutedStrings = getMutedStrings(chord);
  const candidates = normalizeDetected(detectedFingers);
  const usedFingerIndexes = new Set();
  const requiredResults = [];

  for (const group of requiredGroups) {
    const exactIndex = candidates.findIndex((candidate, index) => {
      if (usedFingerIndexes.has(index)) return false;
      return matchesTargetGroup(candidate, group, strictFinger);
    });

    if (exactIndex !== -1) {
      usedFingerIndexes.add(exactIndex);
      const postureWarning = checkPosture &&
        group.targets.length === 1 &&
        candidates[exactIndex].posture?.risk;
      for (const target of group.targets) {
        requiredResults.push({
          target,
          status: postureWarning ? "posture_warning" : "correct",
          matchedFinger: candidates[exactIndex],
          delta: { string: 0, fret: 0 },
          message: postureWarning
            ? buildPostureMessage(target, candidates[exactIndex])
            : `${fingerName(candidates[exactIndex].finger)}가 ${target.string}번줄 ${target.fret}프렛에 있습니다.`,
        });
      }
      continue;
    }

    const wrongIndex = candidates.findIndex((candidate, index) => {
      if (usedFingerIndexes.has(index)) return false;
      return candidate.finger === group.finger;
    });

    if (wrongIndex !== -1) {
      usedFingerIndexes.add(wrongIndex);
      const matchedFinger = candidates[wrongIndex];
      for (const target of group.targets) {
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
      }
      continue;
    }

    for (const target of group.targets) {
      requiredResults.push({
        target,
        status: "missing",
        matchedFinger: null,
        delta: null,
        message: buildMissingMessage(target, candidates.length),
      });
    }
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
  const postureWarningCount = requiredResults.filter((result) => result.status === "posture_warning").length;
  const score = required.length === 0
    ? 1
    : (correctCount + postureWarningCount * 0.75) / required.length;
  const isCorrect = correctCount === required.length && extras.length === 0;
  const corrections = [
    ...requiredResults
      .filter((result) => (
        result.status === "missing" ||
        result.status === "wrong_position" ||
        result.status === "posture_warning"
      ))
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

  const statusText = getStatusText(isCorrect, score, candidates.length, postureWarningCount);
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

function collectTargetGroups(required) {
  const consumed = new Set();
  const groups = [];

  for (const target of required) {
    const key = `${target.finger}:${target.fret}`;
    if (consumed.has(key)) continue;

    const matches = required.filter((note) => `${note.finger}:${note.fret}` === key);
    const shouldGroup = matches.length > 1 && isContiguousStrings(matches);
    const targets = shouldGroup ? matches : [target];

    groups.push({
      finger: target.finger,
      fret: target.fret,
      targets,
      strings: targets.map((note) => note.string),
    });

    if (shouldGroup) consumed.add(key);
  }

  return groups;
}

function isContiguousStrings(targets) {
  const strings = [...new Set(targets.map((target) => target.string))].sort((a, b) => a - b);
  if (strings.length < 2) return false;

  for (let index = 1; index < strings.length; index += 1) {
    if (strings[index] !== strings[index - 1] + 1) return false;
  }

  return true;
}

function matchesTargetGroup(candidate, group, strictFinger) {
  if (candidate.fret !== group.fret) return false;
  if (strictFinger && candidate.finger !== group.finger) return false;

  if (group.strings.length === 1) {
    return candidate.string === group.strings[0];
  }

  return candidate.string >= Math.min(...group.strings) &&
    candidate.string <= Math.max(...group.strings);
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

function buildPostureMessage(target, current) {
  const posture = current.posture;
  const angleText = posture?.pipAngle && posture?.dipAngle
    ? ` 현재 각도 PIP ${posture.pipAngle}도, DIP ${posture.dipAngle}도입니다.`
    : "";
  return `${fingerName(target.finger)}를 조금 더 세워 손끝으로 ${target.string}번줄 ${target.fret}프렛을 누르세요.${angleText}`;
}

function fingerName(finger) {
  return FINGER_NAMES[finger] ?? `${finger}번 손가락`;
}

function getStatusText(isCorrect, score, detectedCount, postureWarningCount = 0) {
  if (isCorrect) return "정확합니다";
  if (postureWarningCount > 0) return "손가락 각도를 세워주세요";
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
