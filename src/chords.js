export const STRING_LABELS = {
  4: "G",
  3: "C",
  2: "E",
  1: "A",
};

export const FINGER_NAMES = {
  1: "검지",
  2: "중지",
  3: "약지",
  4: "새끼",
  T: "엄지",
};

export const CHORDS = {
  C: {
    id: "C",
    name: "C 메이저",
    voicing: "0003",
    strings: [
      { string: 4, fret: 0, finger: 0 },
      { string: 3, fret: 0, finger: 0 },
      { string: 2, fret: 0, finger: 0 },
      { string: 1, fret: 3, finger: 3 },
    ],
  },
  Am: {
    id: "Am",
    name: "A 마이너",
    voicing: "2000",
    strings: [
      { string: 4, fret: 2, finger: 2 },
      { string: 3, fret: 0, finger: 0 },
      { string: 2, fret: 0, finger: 0 },
      { string: 1, fret: 0, finger: 0 },
    ],
  },
  F: {
    id: "F",
    name: "F 메이저",
    voicing: "2010",
    strings: [
      { string: 4, fret: 2, finger: 2 },
      { string: 3, fret: 0, finger: 0 },
      { string: 2, fret: 1, finger: 1 },
      { string: 1, fret: 0, finger: 0 },
    ],
  },
  G: {
    id: "G",
    name: "G 메이저",
    voicing: "0232",
    strings: [
      { string: 4, fret: 0, finger: 0 },
      { string: 3, fret: 2, finger: 1 },
      { string: 2, fret: 3, finger: 3 },
      { string: 1, fret: 2, finger: 2 },
    ],
  },
  A: {
    id: "A",
    name: "A 메이저",
    voicing: "2100",
    strings: [
      { string: 4, fret: 2, finger: 2 },
      { string: 3, fret: 1, finger: 1 },
      { string: 2, fret: 0, finger: 0 },
      { string: 1, fret: 0, finger: 0 },
    ],
  },
  D: {
    id: "D",
    name: "D 메이저",
    voicing: "2220",
    strings: [
      { string: 4, fret: 2, finger: 1 },
      { string: 3, fret: 2, finger: 2 },
      { string: 2, fret: 2, finger: 3 },
      { string: 1, fret: 0, finger: 0 },
    ],
  },
  Dm: {
    id: "Dm",
    name: "D 마이너",
    voicing: "2210",
    strings: [
      { string: 4, fret: 2, finger: 2 },
      { string: 3, fret: 2, finger: 3 },
      { string: 2, fret: 1, finger: 1 },
      { string: 1, fret: 0, finger: 0 },
    ],
  },
  C7: {
    id: "C7",
    name: "C7",
    voicing: "0001",
    strings: [
      { string: 4, fret: 0, finger: 0 },
      { string: 3, fret: 0, finger: 0 },
      { string: 2, fret: 0, finger: 0 },
      { string: 1, fret: 1, finger: 1 },
    ],
  },
  G7: {
    id: "G7",
    name: "G7",
    voicing: "0212",
    strings: [
      { string: 4, fret: 0, finger: 0 },
      { string: 3, fret: 2, finger: 2 },
      { string: 2, fret: 1, finger: 1 },
      { string: 1, fret: 2, finger: 3 },
    ],
  },
  Em: {
    id: "Em",
    name: "E 마이너",
    voicing: "0432",
    strings: [
      { string: 4, fret: 0, finger: 0 },
      { string: 3, fret: 4, finger: 3 },
      { string: 2, fret: 3, finger: 2 },
      { string: 1, fret: 2, finger: 1 },
    ],
  },
};

export const CHORD_ORDER = ["C", "Am", "F", "G", "A", "D", "Dm", "C7", "G7", "Em"];

export const PRACTICE_PRESETS = {
  core: {
    id: "core",
    name: "기본 4코드",
    chords: ["C", "Am", "F", "G"],
  },
  easy: {
    id: "easy",
    name: "초보 3코드",
    chords: ["C", "F", "G"],
  },
  single: {
    id: "single",
    name: "한 손가락 점검",
    chords: ["C", "Am", "C7"],
  },
};
