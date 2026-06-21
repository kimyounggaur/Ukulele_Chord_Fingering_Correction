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

const QUALITY_META = {
  major: {
    suffix: "",
    name: "메이저",
    sourceDirectory: "major",
  },
  seventh: {
    suffix: "7",
    name: "7",
    sourceDirectory: "seventh",
  },
  minor: {
    suffix: "m",
    name: "마이너",
    sourceDirectory: "minor",
  },
  minor7: {
    suffix: "m7",
    name: "m7",
    sourceDirectory: "minor7",
  },
  sus4: {
    suffix: "sus4",
    name: "sus4",
    sourceDirectory: "sus4",
  },
  major7: {
    suffix: "maj7",
    name: "maj7",
    sourceDirectory: "major7",
  },
  sixth: {
    suffix: "6",
    name: "6",
    sourceDirectory: "sixth",
  },
  "seventh-sus4": {
    suffix: "7sus4",
    name: "7sus4",
    sourceDirectory: "seventh-sus4",
  },
  add9: {
    suffix: "add9",
    name: "add9",
    sourceDirectory: "add9",
  },
  "minor7-flat5": {
    suffix: "m7b5",
    name: "m7b5",
    sourceDirectory: "minor7-flat5",
  },
  minor6: {
    suffix: "m6",
    name: "m6",
    sourceDirectory: "minor6",
  },
};

const CHORD_DEFINITIONS = [
  ["major", "A", "2100", [2, 1, 0, 0]],
  ["major", "B", "4322", [3, 2, 1, 1]],
  ["major", "C", "0003", [0, 0, 0, 3]],
  ["major", "D", "2220", [1, 2, 3, 0]],
  ["major", "E", "4442", [3, 4, 2, 1]],
  ["major", "F", "2010", [2, 0, 1, 0]],
  ["major", "G", "0232", [0, 1, 3, 2]],

  ["seventh", "A", "0100", [0, 1, 0, 0]],
  ["seventh", "B", "2322", [2, 3, 1, 1]],
  ["seventh", "C", "0001", [0, 0, 0, 1]],
  ["seventh", "D", "2223", [1, 1, 1, 2]],
  ["seventh", "E", "1202", [1, 2, 0, 3]],
  ["seventh", "F", "2313", [2, 3, 1, 4]],
  ["seventh", "G", "0212", [0, 2, 1, 3]],

  ["minor", "A", "2000", [2, 0, 0, 0]],
  ["minor", "B", "4222", [3, 1, 1, 1]],
  ["minor", "C", "0333", [0, 1, 1, 1]],
  ["minor", "D", "2210", [2, 3, 1, 0]],
  ["minor", "E", "0432", [0, 3, 2, 1]],
  ["minor", "F", "1013", [1, 0, 2, 4]],
  ["minor", "G", "0231", [0, 2, 3, 1]],

  ["minor7", "A", "0000", [0, 0, 0, 0]],
  ["minor7", "B", "2222", [1, 1, 1, 1]],
  ["minor7", "C#", "4444", [1, 1, 1, 1]],
  ["minor7", "C", "3333", [1, 1, 1, 1]],
  ["minor7", "D", "2213", [2, 3, 1, 4]],
  ["minor7", "E", "0202", [0, 2, 0, 3]],
  ["minor7", "F#", "2424", [1, 3, 2, 4]],
  ["minor7", "F", "1313", [1, 3, 2, 4]],
  ["minor7", "G#", "1322", [1, 3, 2, 2]],
  ["minor7", "G", "0211", [0, 2, 1, 1]],

  ["sus4", "A", "2200", [1, 2, 0, 0]],
  ["sus4", "B", "4422", [3, 4, 1, 1]],
  ["sus4", "C", "0013", [0, 0, 1, 3]],
  ["sus4", "D", "0230", [0, 1, 3, 0]],
  ["sus4", "E", "2452", [1, 3, 4, 1]],
  ["sus4", "F", "3011", [3, 0, 1, 1]],
  ["sus4", "G", "0233", [0, 1, 3, 4]],

  ["major7", "A", "1100", [1, 1, 0, 0]],
  ["major7", "B", "3322", [2, 3, 1, 1]],
  ["major7", "C", "0002", [0, 0, 0, 2]],
  ["major7", "D", "2224", [1, 1, 1, 4]],
  ["major7", "E", "1302", [1, 3, 0, 2]],
  ["major7", "F", "2413", [2, 4, 1, 3]],
  ["major7", "G", "0222", [0, 1, 1, 1]],

  ["sixth", "A", "2424", [1, 3, 2, 4]],
  ["sixth", "B", "1322", [1, 3, 2, 2]],
  ["sixth", "C", "0000", [0, 0, 0, 0]],
  ["sixth", "D", "2222", [1, 1, 1, 1]],
  ["sixth", "E", "4444", [1, 1, 1, 1]],
  ["sixth", "F", "2213", [2, 3, 1, 4]],
  ["sixth", "G", "0202", [0, 2, 0, 3]],

  ["seventh-sus4", "A", "0200", [0, 2, 0, 0]],
  ["seventh-sus4", "B", "2422", [2, 4, 1, 1]],
  ["seventh-sus4", "C", "0011", [0, 0, 1, 1]],
  ["seventh-sus4", "D", "2233", [1, 2, 3, 4]],
  ["seventh-sus4", "E", "2202", [1, 2, 0, 3]],
  ["seventh-sus4", "F", "3313", [2, 3, 1, 4]],
  ["seventh-sus4", "G", "0213", [0, 2, 1, 4]],

  ["add9", "A", "2102", [2, 1, 0, 3]],
  ["add9", "B", "4324", [3, 2, 1, 4]],
  ["add9", "C", "0203", [0, 2, 0, 3]],
  ["add9", "D", "2425", [1, 3, 2, 4]],
  ["add9", "E", "1422", [1, 4, 2, 3]],
  ["add9", "F", "0010", [0, 0, 1, 0]],
  ["add9", "G", "0252", [0, 1, 4, 2]],

  ["minor7-flat5", "A", "2333", [1, 2, 2, 2]],
  ["minor7-flat5", "B", "4210", [3, 2, 1, 0]],
  ["minor7-flat5", "C", "3323", [2, 3, 1, 4]],
  ["minor7-flat5", "D", "1213", [1, 2, 3, 4]],
  ["minor7-flat5", "E", "3435", [1, 2, 3, 4]],
  ["minor7-flat5", "F", "1312", [1, 3, 2, 4]],
  ["minor7-flat5", "G", "0111", [0, 1, 1, 1]],

  ["minor6", "A", "2020", [2, 0, 3, 0]],
  ["minor6", "B", "4242", [3, 1, 4, 1]],
  ["minor6", "C", "5353", [3, 1, 4, 1]],
  ["minor6", "D", "2212", [2, 3, 1, 4]],
  ["minor6", "E", "0102", [0, 1, 0, 2]],
  ["minor6", "F", "1213", [1, 2, 3, 4]],
  ["minor6", "G", "0201", [0, 2, 0, 1]],
];

export const CHORDS = Object.fromEntries(
  CHORD_DEFINITIONS.map(([quality, root, voicing, fingers]) => {
    const meta = QUALITY_META[quality];
    const id = `${root}${meta.suffix}`;
    return [
      id,
      {
        id,
        name: quality === "major" || quality === "minor"
          ? `${root} ${meta.name}`
          : `${root}${meta.name}`,
        quality,
        root,
        voicing,
        sourceImage: `./01 Source/${meta.sourceDirectory}/${rootToFileName(root)}.png`,
        strings: Array.from(voicing, (fret, index) => ({
          string: 4 - index,
          fret: fret === "x" ? "x" : Number(fret),
          finger: fingers[index],
        })),
      },
    ];
  }),
);

export const CHORD_ORDER = CHORD_DEFINITIONS.map(([quality, root]) => {
  const meta = QUALITY_META[quality];
  return `${root}${meta.suffix}`;
});

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
  sourceAll: {
    id: "sourceAll",
    name: "소스 전체 80코드",
    chords: CHORD_ORDER,
  },
};

function rootToFileName(root) {
  return root.toLowerCase().replace("#", "-sharp");
}
