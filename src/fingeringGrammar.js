import { getRequiredFingeredNotes } from "./evaluation.js";
import { DEFAULT_VISION_CONFIG } from "./visionConfig.js";

export function buildValidVoicingDictionary(chords) {
  return Object.values(chords).map((chord) => ({
    chordId: chord.id,
    chord,
    required: getRequiredFingeredNotes(chord),
  }));
}

export function scoreObservationAgainstVoicing(observations = [], chord, options = {}) {
  const config = {
    ...DEFAULT_VISION_CONFIG.grammar,
    ...(options.config ?? {}),
  };
  const required = getRequiredFingeredNotes(chord);
  const used = new Set();
  let score = Math.log(options.prior ?? 1);

  for (const target of required) {
    const match = findBestObservation(observations, target, used, options.strictFinger);
    if (!match) {
      score -= 2.4;
      continue;
    }

    used.add(match.index);
    score += match.score;
  }

  const extras = observations.filter((observation, index) => (
    !used.has(index) &&
    observation.inFretboard !== false &&
    Number.isFinite(Number(observation.fret)) &&
    Number(observation.fret) > 0
  ));
  score -= extras.length * 0.55;
  score += physicalConstraintScore(observations, config.physicalConstraints);

  return { chordId: chord.id, score, extras: extras.length };
}

export class FingeringGrammar {
  constructor(dictionary, config = DEFAULT_VISION_CONFIG.grammar) {
    this.dictionary = dictionary;
    this.config = { ...DEFAULT_VISION_CONFIG.grammar, ...config };
  }

  mapSnap(observations = [], context = {}) {
    if (!this.config.enabled) return null;
    const candidates = context.candidateChordIds
      ? this.dictionary.filter((entry) => context.candidateChordIds.includes(entry.chordId))
      : this.dictionary;
    const sequence = context.practiceSequence ?? [];
    const scored = candidates
      .map((entry) => {
        const prior = sequence.includes(entry.chordId) ? 1.08 : 1;
        const result = scoreObservationAgainstVoicing(observations, entry.chord, {
          config: this.config,
          prior,
          strictFinger: context.strictFinger,
        });
        return { chordId: entry.chordId, posterior: result.score };
      })
      .sort((a, b) => b.posterior - a.posterior);
    const best = scored[0] ?? null;
    const second = scored[1] ?? null;
    const gap = best && second ? best.posterior - second.posterior : Infinity;
    const ambiguous = gap < Math.log(this.config.ambiguityGap);

    return {
      snappedChordId: best?.chordId ?? null,
      confidence: Number.isFinite(gap) ? 1 - Math.exp(-Math.max(0, gap)) : 1,
      ambiguous,
      alternatives: scored.slice(0, 4),
      displayFingers: observations,
    };
  }
}

function findBestObservation(observations, target, used, strictFinger = false) {
  let best = null;
  observations.forEach((observation, index) => {
    if (used.has(index) || observation.inFretboard === false) return;
    if (strictFinger && Number(observation.finger) !== Number(target.finger)) return;

    const stringDistance = Math.abs(Number(observation.string) - target.string);
    const fretDistance = Math.abs(Number(observation.fret) - target.fret);
    const distance = stringDistance + fretDistance;
    const positionScore = Math.max(-2.2, 2.6 - distance * 1.15);
    const fingerBonus = Number(observation.finger) === Number(target.finger) ? 0.35 : 0;
    const pressBonus = observation.pressState === "PRESS"
      ? 0.32
      : observation.pressState === "UNKNOWN"
        ? -0.12
        : 0;
    const confidenceBonus = ((observation.pSmooth ?? observation.pressProbability ?? 0.5) - 0.5) * 0.3;
    const score = positionScore + fingerBonus + pressBonus + confidenceBonus;

    if (!best || score > best.score) {
      best = { observation, index, score };
    }
  });
  return best;
}

function physicalConstraintScore(observations, constraints) {
  let score = 0;
  const pressed = observations.filter((observation) => (
    observation.inFretboard !== false &&
    Number.isFinite(Number(observation.fret)) &&
    Number(observation.fret) > 0
  ));

  if (constraints.preventSameCellDuplicates) {
    const cells = new Set();
    for (const observation of pressed) {
      const cell = `${observation.string}:${observation.fret}`;
      if (cells.has(cell)) score -= 0.7;
      cells.add(cell);
    }
  }

  const frets = pressed.map((observation) => Number(observation.fret));
  if (frets.length > 1) {
    const span = Math.max(...frets) - Math.min(...frets);
    if (span > constraints.maxFretSpan) score -= (span - constraints.maxFretSpan) * 0.6;
  }

  if (constraints.preferFingerOrder) {
    const ordered = pressed
      .filter((observation) => Number.isFinite(Number(observation.finger)))
      .sort((a, b) => Number(a.finger) - Number(b.finger));
    for (let index = 1; index < ordered.length; index += 1) {
      if (Number(ordered[index].fret) + 2 < Number(ordered[index - 1].fret)) {
        score -= 0.25;
      }
    }
  }

  return score;
}
