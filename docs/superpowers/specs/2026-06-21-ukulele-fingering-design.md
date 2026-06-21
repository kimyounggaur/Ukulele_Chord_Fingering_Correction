# Ukulele Fingering Coach Design

## Goal

Build the app described in `우쿨렐레코드-운지교정-웹앱-바이브코딩-프롬프트.md`: a browser-based ukulele chord fingering coach that uses webcam hand landmarks, manual fretboard calibration, and chord evaluation to tell the learner which finger should move to which string and fret.

## Self-Approval

The user explicitly requested autonomous approval with no follow-up questions. This design follows the markdown spec directly and is approved for implementation.

## Architecture

The app is a static vanilla JavaScript web app with `index.html`, `style.css`, and `main.js`. Testable domain logic lives in `src/` modules so homography, fret mapping, chord evaluation, smoothing, and stable-state gating can be validated with Node tests before UI integration.

MediaPipe Tasks Vision is loaded in the browser from its CDN. The app mirrors the webcam video and applies the same mirror policy to landmark coordinates, then renders all overlays on a canvas that is kept pixel-aligned with the video.

## Core Units

- `src/chords.js`: ukulele chord definitions for C, Am, F, G, A, D, Dm, C7, G7, Em.
- `src/fretboard.js`: fret ratios, string/fret mapping, canvas coordinate helpers, and target-position helpers.
- `src/homography.js`: 4-point homography and point projection.
- `src/evaluation.js`: target note extraction, detected-finger matching, scoring, extras, and Korean correction messages.
- `src/stability.js`: moving-average smoothing and hold-gate logic.
- `main.js`: browser state, camera lifecycle, MediaPipe loop, calibration, drawing, speech, practice mode, and report UI.

## UX

The first screen is the working tool, not a landing page. It includes the camera/canvas stage, calibration controls, chord/practice controls, coaching panel, debug panel, chord diagram, and privacy notice. Correction text always uses string numbers such as `1번줄` and `4번줄`, never thick/thin string language.

## Verification

Automated tests cover:

- 4-string ukulele mapping: `string = 4 - round(v)`.
- Equal-temperament fret boundaries.
- Homography projection and inversion.
- Chord data and evaluation for C, Am, F, and common wrong-position cases.
- Stability timing for 300 ms coaching updates and 700 ms success confirmation.

Manual/browser verification covers layout render, controls, local camera permission flow, and canvas overlay startup.
