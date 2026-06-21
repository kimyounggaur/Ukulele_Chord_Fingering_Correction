import { CHORD_ORDER, CHORDS, FINGER_NAMES, PRACTICE_PRESETS, STRING_LABELS } from "./src/chords.js";
import {
  DEFAULT_FRET_COUNT,
  canvasEventToPixel,
  getFretFromU,
  getFretLines,
  getStringFromV,
  getTargetFretboardPoint,
  normalizedLandmarkToPixel,
} from "./src/fretboard.js";
import { applyHomography, computeHomography, invertHomography } from "./src/homography.js";
import { evaluateVoicing } from "./src/evaluation.js";
import { MovingAverageSmoother, StableEvaluationGate } from "./src/stability.js";

const CALIBRATION_KEY = "ukuleleFingering.calibration.v1";
const MIRROR_VIDEO = true;
const FINGERTIPS = [
  { finger: 1, name: "검지", landmarkIndex: 8 },
  { finger: 2, name: "중지", landmarkIndex: 12 },
  { finger: 3, name: "약지", landmarkIndex: 16 },
  { finger: 4, name: "새끼", landmarkIndex: 20 },
];
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
const CALIBRATION_STEPS = [
  "1/4 · 4번줄(G) 너트를 클릭하세요",
  "2/4 · 1번줄(A) 너트를 클릭하세요",
  "3/4 · 1번줄(A) 기준 프렛을 클릭하세요",
  "4/4 · 4번줄(G) 기준 프렛을 클릭하세요",
];

const elements = {
  startCameraButton: document.querySelector("#startCameraButton"),
  stopCameraButton: document.querySelector("#stopCameraButton"),
  cameraStatus: document.querySelector("#cameraStatus"),
  fpsBadge: document.querySelector("#fpsBadge"),
  calibrationBadge: document.querySelector("#calibrationBadge"),
  fretCountInput: document.querySelector("#fretCountInput"),
  calibrateButton: document.querySelector("#calibrateButton"),
  resetCalibrationButton: document.querySelector("#resetCalibrationButton"),
  cameraStage: document.querySelector("#cameraStage"),
  video: document.querySelector("#cameraVideo"),
  canvas: document.querySelector("#overlayCanvas"),
  stageHint: document.querySelector("#stageHint"),
  calibrationGuide: document.querySelector("#calibrationGuide"),
  chordSelect: document.querySelector("#chordSelect"),
  practicePresetSelect: document.querySelector("#practicePresetSelect"),
  customSequenceInput: document.querySelector("#customSequenceInput"),
  startPracticeButton: document.querySelector("#startPracticeButton"),
  finishPracticeButton: document.querySelector("#finishPracticeButton"),
  strictFingerToggle: document.querySelector("#strictFingerToggle"),
  muteToggle: document.querySelector("#muteToggle"),
  voiceToggle: document.querySelector("#voiceToggle"),
  debugToggle: document.querySelector("#debugToggle"),
  practiceStateBadge: document.querySelector("#practiceStateBadge"),
  successCount: document.querySelector("#successCount"),
  resultStatus: document.querySelector("#resultStatus"),
  scoreFill: document.querySelector("#scoreFill"),
  scoreText: document.querySelector("#scoreText"),
  correctionList: document.querySelector("#correctionList"),
  chordDiagram: document.querySelector("#chordDiagram"),
  nextChordLabel: document.querySelector("#nextChordLabel"),
  reportPanel: document.querySelector("#reportPanel"),
  reportSummaryBadge: document.querySelector("#reportSummaryBadge"),
  reportContent: document.querySelector("#reportContent"),
  debugPanel: document.querySelector("#debugPanel"),
  rawStableBadge: document.querySelector("#rawStableBadge"),
  debugOutput: document.querySelector("#debugOutput"),
};

const ctx = elements.canvas.getContext("2d");
const diagramCtx = elements.chordDiagram.getContext("2d");

const state = {
  isMirrored: MIRROR_VIDEO,
  stream: null,
  running: false,
  handLandmarker: null,
  mediaPipeLoading: false,
  animationId: null,
  lastVideoTime: -1,
  fpsLastAt: 0,
  fpsFrames: 0,
  fps: 0,
  handResults: null,
  detectedFingers: [],
  rawEvaluation: null,
  stableInfo: null,
  calibration: null,
  calibrationDraft: [],
  calibrationActive: false,
  smoother: new MovingAverageSmoother(6),
  stableGate: new StableEvaluationGate({ wrongHoldMs: 300, correctHoldMs: 700 }),
  successTotal: 0,
  lastSpeechMessage: "",
  lastSpeechAt: 0,
  practice: {
    active: false,
    sequence: [],
    index: 0,
    records: [],
    mistakes: [],
    startedAt: 0,
    chordStartedAt: 0,
  },
};

init();

function init() {
  populateChordSelect();
  loadCalibration();
  bindEvents();
  drawChordDiagram();
  updateCalibrationBadge();
  updateFeedback(null);
  requestAnimationFrame(() => window.lucide?.createIcons());
}

function populateChordSelect() {
  for (const id of CHORD_ORDER) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${id} · ${CHORDS[id].name}`;
    elements.chordSelect.append(option);
  }
  elements.chordSelect.value = "C";
}

function bindEvents() {
  elements.startCameraButton.addEventListener("click", startCamera);
  elements.stopCameraButton.addEventListener("click", stopCamera);
  elements.calibrateButton.addEventListener("click", startCalibration);
  elements.resetCalibrationButton.addEventListener("click", resetCalibration);
  elements.canvas.addEventListener("click", handleCanvasClick);
  elements.chordSelect.addEventListener("change", handleChordChange);
  elements.strictFingerToggle.addEventListener("change", resetEvaluationGate);
  elements.muteToggle.addEventListener("change", resetEvaluationGate);
  elements.debugToggle.addEventListener("change", updateDebugVisibility);
  elements.startPracticeButton.addEventListener("click", startPractice);
  elements.finishPracticeButton.addEventListener("click", finishPractice);
  elements.fretCountInput.addEventListener("change", () => {
    elements.fretCountInput.value = clamp(Number(elements.fretCountInput.value), 3, 12);
  });
  window.addEventListener("resize", resizeCanvasToVideo);
}

async function startCamera() {
  try {
    setCameraStatus("MediaPipe 준비 중", "warn");
    await ensureHandLandmarker();

    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
    });

    elements.video.srcObject = state.stream;
    await elements.video.play();
    resizeCanvasToVideo();

    state.running = true;
    elements.startCameraButton.disabled = true;
    elements.stopCameraButton.disabled = false;
    elements.stageHint.hidden = true;
    setCameraStatus("카메라 실행 중", "ready");
    state.animationId = requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error(error);
    const message = error?.name === "NotAllowedError"
      ? "카메라 권한이 필요합니다"
      : "카메라를 시작할 수 없습니다";
    setCameraStatus(message, "error");
    elements.stageHint.hidden = false;
    elements.stageHint.querySelector("span").textContent =
      "브라우저 권한과 카메라 연결 상태를 확인하세요.";
  }
}

function stopCamera() {
  state.running = false;
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.handResults = null;
  state.detectedFingers = [];
  state.smoother.clear();

  elements.video.srcObject = null;
  elements.startCameraButton.disabled = false;
  elements.stopCameraButton.disabled = true;
  elements.stageHint.hidden = false;
  setCameraStatus("정지됨", "neutral");
  drawOverlay();
}

async function ensureHandLandmarker() {
  if (state.handLandmarker || state.mediaPipeLoading) return state.handLandmarker;
  state.mediaPipeLoading = true;

  const { FilesetResolver, HandLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );
  const options = {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  };

  try {
    state.handLandmarker = await HandLandmarker.createFromOptions(vision, options);
  } catch (error) {
    state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: options.baseOptions.modelAssetPath,
      },
    });
  } finally {
    state.mediaPipeLoading = false;
  }

  return state.handLandmarker;
}

function resizeCanvasToVideo() {
  const width = elements.video.videoWidth || 1280;
  const height = elements.video.videoHeight || 720;
  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }
}

function renderLoop(now) {
  if (!state.running) return;

  resizeCanvasToVideo();
  if (elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (state.lastVideoTime !== elements.video.currentTime) {
      state.handResults = state.handLandmarker.detectForVideo(elements.video, now);
      state.lastVideoTime = elements.video.currentTime;
      updateFps(now);
    }
  }

  updateDomainState(now);
  drawOverlay();
  renderPanels();
  state.animationId = requestAnimationFrame(renderLoop);
}

function updateFps(now) {
  state.fpsFrames += 1;
  if (!state.fpsLastAt) state.fpsLastAt = now;
  const elapsed = now - state.fpsLastAt;
  if (elapsed >= 500) {
    state.fps = Math.round((state.fpsFrames * 1000) / elapsed);
    state.fpsFrames = 0;
    state.fpsLastAt = now;
    elements.fpsBadge.textContent = `FPS ${state.fps}`;
  }
}

function updateDomainState(now) {
  state.detectedFingers = detectFingerPositions();
  const chord = getActiveChord();

  if (state.calibration && chord) {
    state.rawEvaluation = evaluateVoicing(state.detectedFingers, chord, {
      strictFinger: elements.strictFingerToggle.checked,
      requireMute: elements.muteToggle.checked,
    });
    state.stableInfo = state.stableGate.update(state.rawEvaluation, now);
    handleStableEvaluation(state.stableInfo, now);
  } else {
    state.rawEvaluation = null;
    state.stableInfo = null;
  }
}

function detectFingerPositions() {
  if (!state.handResults?.landmarks?.length) return [];

  const detected = [];
  state.handResults.landmarks.forEach((landmarks, handIndex) => {
    const handedness = state.handResults.handednesses?.[handIndex]?.[0];
    for (const tip of FINGERTIPS) {
      const landmark = landmarks[tip.landmarkIndex];
      if (!landmark) continue;

      const rawPixel = normalizedLandmarkToPixel(landmark, elements.canvas, state.isMirrored);
      const pixel = state.smoother.add(`${handIndex}-${tip.finger}`, rawPixel);
      const mapped = state.calibration
        ? applyHomography(state.calibration.homographyImageToFretboard, pixel)
        : null;
      const stringNumber = mapped ? getStringFromV(mapped.y) : null;
      const fret = mapped ? getFretFromU(mapped.x, getFretCount()) : null;
      const inFretboard = Boolean(mapped && stringNumber !== null && fret !== null);

      detected.push({
        trackingId: `${handIndex}-${tip.finger}`,
        handIndex,
        handedness: handedness?.categoryName ?? "",
        confidence: handedness?.score ?? 0,
        finger: tip.finger,
        name: tip.name,
        landmarkIndex: tip.landmarkIndex,
        rawPixel,
        pixel,
        fretboard: mapped ? { u: mapped.x, v: mapped.y } : null,
        string: stringNumber,
        fret,
        inFretboard,
      });
    }
  });

  return detected;
}

function drawOverlay() {
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  drawCalibrationGrid();
  drawTargetsAndArrows();
  drawHands();
  drawCalibrationDraft();
}

function drawCalibrationGrid() {
  if (!state.calibration) return;

  const fretCount = getFretCount();
  const fretLines = getFretLines(fretCount);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(73, 209, 125, 0.85)";
  ctx.fillStyle = "rgba(73, 209, 125, 0.95)";
  ctx.font = "16px sans-serif";

  for (const u of fretLines) {
    drawProjectedLine({ x: u, y: 0 }, { x: u, y: 3 }, state.calibration.homographyFretboardToImage);
  }

  for (let v = 0; v <= 3; v += 1) {
    drawProjectedLine({ x: 0, y: v }, { x: fretCount, y: v }, state.calibration.homographyFretboardToImage);
    const labelPoint = applyHomography(state.calibration.homographyFretboardToImage, { x: 0, y: v });
    const stringNumber = 4 - v;
    ctx.fillText(`${stringNumber}번줄(${STRING_LABELS[stringNumber]})`, labelPoint.x + 10, labelPoint.y - 8);
  }

  ctx.restore();
}

function drawProjectedLine(from, to, matrix) {
  const p1 = applyHomography(matrix, from);
  const p2 = applyHomography(matrix, to);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawTargetsAndArrows() {
  if (!state.calibration || !state.rawEvaluation) return;

  const targetPixels = new Map();
  ctx.save();
  for (const result of state.rawEvaluation.requiredResults) {
    const targetPoint = getTargetFretboardPoint(result.target, getFretCount());
    if (!targetPoint) continue;
    const pixel = applyHomography(state.calibration.homographyFretboardToImage, {
      x: targetPoint.u,
      y: targetPoint.v,
    });
    targetPixels.set(`${result.target.string}:${result.target.fret}:${result.target.finger}`, pixel);

    ctx.lineWidth = 3;
    ctx.setLineDash(result.status === "missing" ? [8, 6] : []);
    ctx.strokeStyle = result.status === "correct"
      ? "rgba(73, 209, 125, 0.95)"
      : "rgba(102, 199, 255, 0.95)";
    ctx.fillStyle = "rgba(102, 199, 255, 0.12)";
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f4f6f8";
    ctx.font = "700 15px sans-serif";
    ctx.fillText(FINGER_NAMES[result.target.finger], pixel.x + 22, pixel.y + 5);

    if (result.status === "wrong_position" && result.matchedFinger?.pixel) {
      drawArrow(result.matchedFinger.pixel, pixel, "rgba(241, 196, 91, 0.95)");
    }
  }
  ctx.restore();
}

function drawHands() {
  if (!state.handResults?.landmarks?.length) return;
  const statusByTrackingId = getFingerStatusMap();

  ctx.save();
  state.handResults.landmarks.forEach((landmarks, handIndex) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = handIndex === 0 ? "rgba(182, 156, 255, 0.72)" : "rgba(55, 214, 192, 0.72)";
    for (const [start, end] of HAND_CONNECTIONS) {
      const p1 = normalizedLandmarkToPixel(landmarks[start], elements.canvas, state.isMirrored);
      const p2 = normalizedLandmarkToPixel(landmarks[end], elements.canvas, state.isMirrored);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  });

  for (const finger of state.detectedFingers) {
    const status = statusByTrackingId.get(finger.trackingId) ?? "unknown";
    const color = {
      correct: "#49d17d",
      wrong_position: "#f1c45b",
      extra: "#f26b6b",
      unknown: "#f4f6f8",
    }[status] ?? "#f4f6f8";

    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(finger.pixel.x, finger.pixel.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "700 15px sans-serif";
    ctx.fillStyle = "#f4f6f8";
    const label = finger.inFretboard
      ? `${finger.name}: ${finger.string}번줄 ${finger.fret}프렛`
      : `${finger.name}: 지판 밖`;
    drawLabel(label, finger.pixel.x + 12, finger.pixel.y - 12);
  }
  ctx.restore();
}

function getFingerStatusMap() {
  const map = new Map();
  if (!state.rawEvaluation) return map;
  for (const result of state.rawEvaluation.requiredResults) {
    if (result.matchedFinger?.trackingId) {
      map.set(result.matchedFinger.trackingId, result.status);
    }
  }
  for (const extra of state.rawEvaluation.extras) {
    if (extra.trackingId) {
      map.set(extra.trackingId, "extra");
    }
  }
  return map;
}

function drawCalibrationDraft() {
  if (!state.calibrationActive && state.calibrationDraft.length === 0) return;

  ctx.save();
  ctx.fillStyle = "#f1c45b";
  ctx.strokeStyle = "rgba(241, 196, 91, 0.85)";
  ctx.lineWidth = 2;
  state.calibrationDraft.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(String(index + 1), point.x + 12, point.y - 10);
  });

  if (state.calibrationDraft.length > 1) {
    ctx.beginPath();
    ctx.moveTo(state.calibrationDraft[0].x, state.calibrationDraft[0].y);
    for (const point of state.calibrationDraft.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArrow(from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = 16;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(text, x, y) {
  ctx.save();
  ctx.font = "700 15px sans-serif";
  const metrics = ctx.measureText(text);
  const width = metrics.width + 14;
  ctx.fillStyle = "rgba(13, 15, 18, 0.78)";
  ctx.fillRect(x - 7, y - 18, width, 24);
  ctx.fillStyle = "#f4f6f8";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function renderPanels() {
  const displayEvaluation = state.stableInfo?.stableEvaluation ?? state.rawEvaluation;
  updateFeedback(displayEvaluation);
  drawChordDiagram();
  updatePracticeLabels();
  updateDebugVisibility();
}

function updateFeedback(evaluation) {
  if (!state.calibration) {
    elements.resultStatus.textContent = "지판 보정을 완료하세요";
    elements.resultStatus.className = "result-status waiting";
    elements.scoreFill.style.width = "0%";
    elements.scoreText.textContent = "0/0 · 0%";
    elements.correctionList.replaceChildren();
    return;
  }

  if (!evaluation) {
    elements.resultStatus.textContent = "손을 지판 위에 올려주세요";
    elements.resultStatus.className = "result-status waiting";
    return;
  }

  elements.resultStatus.textContent = evaluation.isCorrect
    ? "정확합니다. 이 자세를 1초만 유지하세요."
    : evaluation.statusText;
  elements.resultStatus.className = `result-status ${
    evaluation.isCorrect ? "correct" : evaluation.score >= 0.67 ? "near" : "waiting"
  }`;
  elements.scoreFill.style.width = `${evaluation.percent}%`;
  elements.scoreText.textContent = `${evaluation.scoreText} · ${evaluation.percent}%`;

  const messages = evaluation.isCorrect
    ? ["정확합니다. 이 자세를 1초만 유지하세요."]
    : evaluation.corrections.slice(0, 3).map((correction) => correction.message);

  elements.correctionList.replaceChildren(
    ...messages.map((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      return li;
    }),
  );
}

function drawChordDiagram() {
  const chord = getActiveChord() ?? CHORDS.C;
  const width = elements.chordDiagram.width;
  const height = elements.chordDiagram.height;
  const fretCount = Math.max(4, Math.min(getFretCount(), 5));
  const margin = { left: 44, right: 30, top: 42, bottom: 34 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const stringGap = chartWidth / 3;
  const fretGap = chartHeight / fretCount;

  diagramCtx.clearRect(0, 0, width, height);
  diagramCtx.fillStyle = "#0f1115";
  diagramCtx.fillRect(0, 0, width, height);
  diagramCtx.fillStyle = "#f4f6f8";
  diagramCtx.font = "800 22px sans-serif";
  diagramCtx.fillText(`${chord.id} · ${chord.voicing}`, 18, 28);

  diagramCtx.strokeStyle = "#56606f";
  diagramCtx.lineWidth = 2;
  for (let index = 0; index < 4; index += 1) {
    const x = margin.left + index * stringGap;
    diagramCtx.beginPath();
    diagramCtx.moveTo(x, margin.top);
    diagramCtx.lineTo(x, margin.top + chartHeight);
    diagramCtx.stroke();
    const stringNumber = 4 - index;
    diagramCtx.fillStyle = "#abb4c0";
    diagramCtx.font = "700 13px sans-serif";
    diagramCtx.fillText(`${stringNumber}${STRING_LABELS[stringNumber]}`, x - 12, height - 12);
  }

  for (let fret = 0; fret <= fretCount; fret += 1) {
    const y = margin.top + fret * fretGap;
    diagramCtx.lineWidth = fret === 0 ? 5 : 2;
    diagramCtx.beginPath();
    diagramCtx.moveTo(margin.left, y);
    diagramCtx.lineTo(margin.left + chartWidth, y);
    diagramCtx.stroke();
    if (fret > 0) {
      diagramCtx.fillStyle = "#737d8b";
      diagramCtx.font = "12px sans-serif";
      diagramCtx.fillText(String(fret), 18, y - fretGap / 2 + 5);
    }
  }

  for (const note of chord.strings) {
    if (typeof note.fret !== "number" || note.fret <= 0 || note.fret > fretCount) continue;
    const stringIndex = 4 - note.string;
    const x = margin.left + stringIndex * stringGap;
    const y = margin.top + (note.fret - 0.5) * fretGap;
    diagramCtx.fillStyle = "#37d6c0";
    diagramCtx.beginPath();
    diagramCtx.arc(x, y, 17, 0, Math.PI * 2);
    diagramCtx.fill();
    diagramCtx.fillStyle = "#06110f";
    diagramCtx.font = "900 16px sans-serif";
    diagramCtx.textAlign = "center";
    diagramCtx.textBaseline = "middle";
    diagramCtx.fillText(String(note.finger), x, y + 1);
    diagramCtx.textAlign = "start";
    diagramCtx.textBaseline = "alphabetic";
  }
}

function startCalibration() {
  state.calibrationActive = true;
  state.calibrationDraft = [];
  elements.calibrationGuide.hidden = false;
  elements.calibrationGuide.textContent = CALIBRATION_STEPS[0];
  setCameraStatus("보정점을 클릭하세요", "warn");
  drawOverlay();
}

function handleCanvasClick(event) {
  if (!state.calibrationActive) return;

  const point = canvasEventToPixel(event, elements.canvas);
  state.calibrationDraft.push(point);

  if (state.calibrationDraft.length < 4) {
    elements.calibrationGuide.textContent = CALIBRATION_STEPS[state.calibrationDraft.length];
    drawOverlay();
    return;
  }

  completeCalibration();
}

function completeCalibration() {
  const fretCount = getFretCount();
  const dst = [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: fretCount, y: 3 },
    { x: fretCount, y: 0 },
  ];

  try {
    const homographyImageToFretboard = computeHomography(state.calibrationDraft, dst);
    const homographyFretboardToImage = invertHomography(homographyImageToFretboard);
    state.calibration = {
      clickedPoints: state.calibrationDraft,
      fretCountK: fretCount,
      homographyImageToFretboard,
      homographyFretboardToImage,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(state.calibration));
    elements.fretCountInput.value = fretCount;
    state.calibrationActive = false;
    state.calibrationDraft = [];
    elements.calibrationGuide.hidden = true;
    setCameraStatus("보정 완료", "ready");
    updateCalibrationBadge();
    resetEvaluationGate();
  } catch (error) {
    console.error(error);
    setCameraStatus("보정 실패", "error");
    state.calibrationActive = false;
    elements.calibrationGuide.hidden = true;
  }
}

function resetCalibration() {
  state.calibration = null;
  state.calibrationDraft = [];
  state.calibrationActive = false;
  localStorage.removeItem(CALIBRATION_KEY);
  elements.calibrationGuide.hidden = true;
  updateCalibrationBadge();
  resetEvaluationGate();
  drawOverlay();
}

function loadCalibration() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALIBRATION_KEY));
    if (!saved?.homographyImageToFretboard || !saved?.homographyFretboardToImage) return;
    state.calibration = saved;
    elements.fretCountInput.value = saved.fretCountK ?? DEFAULT_FRET_COUNT;
  } catch {
    localStorage.removeItem(CALIBRATION_KEY);
  }
}

function updateCalibrationBadge() {
  if (!state.calibration) {
    elements.calibrationBadge.textContent = "보정 없음";
    return;
  }
  elements.calibrationBadge.textContent = `${state.calibration.fretCountK}프렛 보정`;
}

function handleChordChange() {
  state.practice.active = false;
  resetEvaluationGate();
  updatePracticeLabels();
  drawChordDiagram();
}

function resetEvaluationGate() {
  state.stableGate.reset();
  state.rawEvaluation = null;
  state.stableInfo = null;
}

function startPractice() {
  const sequence = getPracticeSequence();
  state.practice = {
    active: true,
    sequence,
    index: 0,
    records: [],
    mistakes: [],
    startedAt: performance.now(),
    chordStartedAt: performance.now(),
  };
  elements.reportPanel.hidden = true;
  elements.chordSelect.value = sequence[0];
  resetEvaluationGate();
  updatePracticeLabels();
}

function finishPractice() {
  if (!state.practice.active && state.practice.records.length === 0) return;
  state.practice.active = false;
  renderReport();
  updatePracticeLabels();
}

function getPracticeSequence() {
  if (elements.practicePresetSelect.value !== "custom") {
    return [...PRACTICE_PRESETS[elements.practicePresetSelect.value].chords];
  }

  const parsed = elements.customSequenceInput.value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((id) => CHORDS[id]);
  return parsed.length > 0 ? parsed : [...PRACTICE_PRESETS.core.chords];
}

function handleStableEvaluation(stableInfo, now) {
  const stable = stableInfo?.stableEvaluation;
  if (!stable) return;

  if (state.practice.active && !stable.isCorrect && stable.corrections.length > 0) {
    state.practice.mistakes.push({
      chordId: stable.chordId,
      finger: stable.corrections[0].finger,
      message: stable.corrections[0].message,
    });
  }

  if (stableInfo.successJustConfirmed) {
    state.successTotal += 1;
    elements.successCount.textContent = `성공 ${state.successTotal}`;
    speak("좋아요");

    if (state.practice.active) {
      const chordId = state.practice.sequence[state.practice.index];
      state.practice.records.push({
        chordId,
        durationMs: now - state.practice.chordStartedAt,
        success: true,
      });
      advancePractice(now);
    }
    return;
  }

  if (!stable.isCorrect && stable.corrections[0]) {
    speak(stable.corrections[0].message);
  }
}

function advancePractice(now) {
  if (state.practice.index < state.practice.sequence.length - 1) {
    state.practice.index += 1;
    elements.chordSelect.value = state.practice.sequence[state.practice.index];
    state.practice.chordStartedAt = now;
    resetEvaluationGate();
  } else {
    state.practice.active = false;
    renderReport();
  }
  updatePracticeLabels();
}

function updatePracticeLabels() {
  if (!state.practice.active) {
    elements.practiceStateBadge.textContent = "단일 코드";
    elements.nextChordLabel.textContent = "다음 --";
    return;
  }

  const current = state.practice.sequence[state.practice.index];
  const next = state.practice.sequence[state.practice.index + 1] ?? "완료";
  elements.practiceStateBadge.textContent = `${state.practice.index + 1}/${state.practice.sequence.length} · ${current}`;
  elements.nextChordLabel.textContent = `다음 ${next}`;
}

function renderReport() {
  const records = state.practice.records;
  const count = records.length;
  const averageMs = count
    ? Math.round(records.reduce((sum, record) => sum + record.durationMs, 0) / count)
    : 0;
  const slowest = [...records].sort((a, b) => b.durationMs - a.durationMs)[0];
  const frequentMistake = mostCommon(state.practice.mistakes.map((mistake) => FINGER_NAMES[mistake.finger]));

  elements.reportPanel.hidden = false;
  elements.reportSummaryBadge.textContent = `${count}/${state.practice.sequence.length}`;
  elements.reportContent.innerHTML = `
    <div><strong>성공 코드</strong> ${count}개</div>
    <div><strong>평균 전환</strong> ${averageMs ? (averageMs / 1000).toFixed(1) : "0.0"}초</div>
    <div><strong>가장 오래 걸린 코드</strong> ${slowest ? `${slowest.chordId} · ${(slowest.durationMs / 1000).toFixed(1)}초` : "--"}</div>
    <div><strong>자주 흔들린 손가락</strong> ${frequentMistake ?? "--"}</div>
  `;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function speak(message) {
  if (!elements.voiceToggle.checked || !("speechSynthesis" in window)) return;
  const now = performance.now();
  if (message === state.lastSpeechMessage && now - state.lastSpeechAt < 3000) return;
  state.lastSpeechMessage = message;
  state.lastSpeechAt = now;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function updateDebugVisibility() {
  elements.debugPanel.hidden = !elements.debugToggle.checked;
  if (!elements.debugToggle.checked) return;

  elements.rawStableBadge.textContent = state.stableInfo?.stableEvaluation ? "stable" : "raw";
  elements.debugOutput.textContent = JSON.stringify(
    {
      detectedFingers: state.detectedFingers.map((finger) => ({
        finger: finger.name,
        string: finger.string,
        fret: finger.fret,
        inFretboard: finger.inFretboard,
        uv: finger.fretboard
          ? {
              u: Number(finger.fretboard.u.toFixed(2)),
              v: Number(finger.fretboard.v.toFixed(2)),
            }
          : null,
      })),
      rawEvaluation: state.rawEvaluation,
      stableEvaluation: state.stableInfo?.stableEvaluation ?? null,
    },
    null,
    2,
  );
}

function getActiveChord() {
  if (state.practice.active) {
    return CHORDS[state.practice.sequence[state.practice.index]];
  }
  return CHORDS[elements.chordSelect.value];
}

function getFretCount() {
  return state.calibration?.fretCountK ?? clamp(Number(elements.fretCountInput.value) || DEFAULT_FRET_COUNT, 3, 12);
}

function setCameraStatus(text, variant) {
  elements.cameraStatus.textContent = text;
  elements.cameraStatus.className = `status-pill ${variant}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
