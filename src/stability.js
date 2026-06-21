export class MovingAverageSmoother {
  constructor(windowSize = 6) {
    this.windowSize = windowSize;
    this.samples = new Map();
  }

  add(key, point) {
    if (!this.samples.has(key)) {
      this.samples.set(key, []);
    }

    const values = this.samples.get(key);
    values.push({ x: point.x, y: point.y });
    while (values.length > this.windowSize) {
      values.shift();
    }

    const total = values.reduce(
      (sum, value) => ({ x: sum.x + value.x, y: sum.y + value.y }),
      { x: 0, y: 0 },
    );

    return {
      x: total.x / values.length,
      y: total.y / values.length,
    };
  }

  clear() {
    this.samples.clear();
  }
}

export class StableEvaluationGate {
  constructor(options = {}) {
    this.wrongHoldMs = options.wrongHoldMs ?? 300;
    this.correctHoldMs = options.correctHoldMs ?? 700;
    this.activeSignature = null;
    this.firstSeenAt = 0;
    this.stableEvaluation = null;
    this.confirmedSuccessSignature = null;
  }

  update(evaluation, now = performance.now()) {
    if (!evaluation) {
      this.activeSignature = null;
      this.stableEvaluation = null;
      return {
        stableEvaluation: null,
        elapsedMs: 0,
        isStable: false,
        successJustConfirmed: false,
      };
    }

    const signature = evaluation.signature ?? JSON.stringify(evaluation);
    if (signature !== this.activeSignature) {
      this.activeSignature = signature;
      this.firstSeenAt = now;
    }

    const elapsedMs = now - this.firstSeenAt;
    const holdMs = evaluation.isCorrect ? this.correctHoldMs : this.wrongHoldMs;
    const isStable = elapsedMs >= holdMs;
    let successJustConfirmed = false;

    if (isStable) {
      const previousSignature = this.stableEvaluation?.signature;
      this.stableEvaluation = evaluation;

      if (
        evaluation.isCorrect &&
        signature !== previousSignature &&
        signature !== this.confirmedSuccessSignature
      ) {
        successJustConfirmed = true;
        this.confirmedSuccessSignature = signature;
      }
    }

    return {
      stableEvaluation: isStable ? this.stableEvaluation : null,
      elapsedMs,
      isStable,
      successJustConfirmed,
    };
  }

  getStableEvaluation() {
    return this.stableEvaluation;
  }

  reset() {
    this.activeSignature = null;
    this.firstSeenAt = 0;
    this.stableEvaluation = null;
    this.confirmedSuccessSignature = null;
  }
}
