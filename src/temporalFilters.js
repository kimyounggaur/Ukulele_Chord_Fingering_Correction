import { DEFAULT_VISION_CONFIG } from "./visionConfig.js";

export class LowPassFilter {
  constructor() {
    this.initialized = false;
    this.value = 0;
  }

  filter(value, alpha) {
    if (!this.initialized) {
      this.initialized = true;
      this.value = value;
      return value;
    }

    this.value = alpha * value + (1 - alpha) * this.value;
    return this.value;
  }

  last() {
    return this.value;
  }
}

export class OneEuroFilter {
  constructor(config = DEFAULT_VISION_CONFIG.temporal.oneEuro) {
    this.config = { ...DEFAULT_VISION_CONFIG.temporal.oneEuro, ...config };
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
    this.lastRaw = null;
  }

  filter(value, timeMs) {
    if (this.lastTime === null) {
      this.lastTime = timeMs;
      this.lastRaw = value;
      return this.xFilter.filter(value, 1);
    }

    const dt = (timeMs - this.lastTime) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) return this.xFilter.last();

    const dx = (value - this.lastRaw) / dt;
    const edx = this.dxFilter.filter(dx, alpha(this.config.dCutoff, dt));
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edx);
    const filtered = this.xFilter.filter(value, alpha(cutoff, dt));

    this.lastTime = timeMs;
    this.lastRaw = value;
    return filtered;
  }
}

export class LandmarkFilterBank {
  constructor(config = DEFAULT_VISION_CONFIG.temporal.oneEuro) {
    this.config = { ...DEFAULT_VISION_CONFIG.temporal.oneEuro, ...config };
    this.filters = new Map();
  }

  filterHands(hands = [], timeMs = 0) {
    return hands.map((hand, fallbackHandIndex) => {
      const handIndex = hand.handIndex ?? fallbackHandIndex;
      const landmarks = (hand.landmarks ?? []).map((landmark, landmarkIndex) => ({
        x: this.filterValue(`${handIndex}-${landmarkIndex}-x`, landmark.x, timeMs),
        y: this.filterValue(`${handIndex}-${landmarkIndex}-y`, landmark.y, timeMs),
        z: this.filterValue(`${handIndex}-${landmarkIndex}-z`, landmark.z ?? 0, timeMs),
      }));
      return { ...hand, landmarks };
    });
  }

  clear() {
    this.filters.clear();
  }

  filterValue(key, value, timeMs) {
    if (!this.filters.has(key)) {
      this.filters.set(key, new OneEuroFilter(this.config));
    }
    return this.filters.get(key).filter(value, timeMs);
  }
}

export class ProbabilitySmoother {
  constructor(alphaValue = DEFAULT_VISION_CONFIG.temporal.probabilityEmaAlpha) {
    this.alpha = alphaValue;
    this.values = new Map();
  }

  smooth(key, probability) {
    if (!this.values.has(key)) {
      this.values.set(key, probability);
      return probability;
    }

    const next = this.alpha * this.values.get(key) + (1 - this.alpha) * probability;
    this.values.set(key, next);
    return next;
  }

  reset(key) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

export class StateDebouncer {
  constructor(config = DEFAULT_VISION_CONFIG.temporal.debouncer) {
    this.config = { ...DEFAULT_VISION_CONFIG.temporal.debouncer, ...config };
    this.states = new Map();
  }

  update(key, probability) {
    const record = this.states.get(key) ?? {
      state: "LIFT",
      candidate: null,
      frames: 0,
    };
    const desired = this.getDesiredState(record.state, probability);
    let changed = false;

    if (!desired || desired === record.state) {
      record.candidate = null;
      record.frames = 0;
    } else if (record.candidate === desired) {
      record.frames += 1;
    } else {
      record.candidate = desired;
      record.frames = 1;
    }

    if (record.candidate && record.frames >= this.config.minFrames) {
      record.state = record.candidate;
      record.candidate = null;
      record.frames = 0;
      changed = true;
    }

    this.states.set(key, record);
    return {
      state: record.state,
      candidate: record.candidate,
      frames: record.frames,
      changed,
    };
  }

  clear() {
    this.states.clear();
  }

  getDesiredState(current, probability) {
    if (current === "LIFT" && probability > this.config.pressHigh) return "PRESS";
    if (current === "PRESS" && probability < this.config.liftLow) return "LIFT";
    return null;
  }
}

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}
