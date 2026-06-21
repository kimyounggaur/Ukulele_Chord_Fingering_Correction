# Ukulele Fingering Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static ukulele chord fingering correction web app from the provided markdown spec.

**Architecture:** Keep browser UI in `main.js` and move pure logic into focused ES modules under `src/`. Use Node's built-in test runner for red-green verification before wiring the browser loop.

**Tech Stack:** Vanilla HTML/CSS/JS, Canvas 2D, MediaPipe Tasks Vision CDN, Web Speech API, Node test runner.

---

### Task 1: Test Harness And Domain Tests

**Files:**
- Create: `package.json`
- Create: `tests/domain.test.js`

- [x] Write failing tests for chord data, fretboard mapping, homography, evaluation, smoothing, and stable gates.
- [x] Run tests and confirm they fail because the source modules do not exist yet.

### Task 2: Pure Domain Modules

**Files:**
- Create: `src/chords.js`
- Create: `src/fretboard.js`
- Create: `src/homography.js`
- Create: `src/evaluation.js`
- Create: `src/stability.js`

- [x] Implement ukulele chord definitions exactly as G-C-E-A, strings 4 to 1.
- [x] Implement 4-point homography, matrix inversion, and point projection.
- [x] Implement string/fret mapping, target center positions, and equal-temperament fret ratios.
- [x] Implement chord evaluation and Korean correction messages.
- [x] Implement moving average and stable-evaluation gate.
- [x] Run tests until green.

### Task 3: Browser App

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `main.js`

- [x] Build the working camera-first UI.
- [x] Add MediaPipe hand landmark loading and rendering.
- [x] Add four-point ukulele fretboard calibration and localStorage persistence.
- [x] Map landmarks to string/fret labels and feed evaluation.
- [x] Draw fretboard grid, targets, fingertip statuses, arrows, chord diagram, and debug JSON.
- [x] Add voice feedback, practice mode, success count, and report summary.

### Task 4: Verification

**Files:**
- Modify: app files only if test or browser verification exposes issues.

- [x] Run `npm test`.
- [x] Run a local static server.
- [x] Use browser verification to confirm the page renders and main controls are present.
- [x] Share the local URL.
