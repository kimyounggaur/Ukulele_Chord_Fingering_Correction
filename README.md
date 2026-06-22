# Ukulele Chord Fingering Correction

웹캠으로 우쿨렐레 운지 손을 추적하고, 4점 지판 보정과 MediaPipe 손 랜드마크를 이용해 목표 코드와 현재 손가락 위치를 비교하는 브라우저 앱입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다.

## 주요 기능

- 웹캠 비디오와 Canvas 2D 오버레이
- MediaPipe Tasks Vision Hand Landmarker 기반 손끝 추적
- 우쿨렐레 4줄(G-C-E-A) 지판 수동 캘리브레이션
- 손끝을 `N번줄 N프렛`으로 매핑
- `01 Source` 자료 기준 80개 목표 코드 판정
- Landmark 기반 press/lift 확률 추정으로 손끝 신뢰도 보류
- One Euro 필터, 확률 EMA, 히스테리시스 기반 시간적 스무딩
- 카메라 준비도 점수와 품질 게이트
- 운지 문법 prior 기반 유사 코드/애매성 표시
- MediaPipe 손가락 관절 각도 기반 자세 검사와 뮤트 위험 경고
- 한국어 교정 문구, 음성 안내, 스무딩, 홀드 게이트
- 코드 진행 연습 모드와 간단한 세션 리포트

## 고도화 파이프라인

새 인식 경로는 `src/fingeringEngine.js`에서 묶습니다.

```text
MediaPipe landmarks
-> One Euro landmark filter
-> 손끝 pixel / 지판 u,v / 줄·프렛 매핑
-> pressProbability / PRESS-LIFT-UNKNOWN
-> 카메라 품질 게이트
-> 운지 문법 prior(표시용)
-> prior 미적용 직접 채점
```

`src/visionConfig.js`에서 각 기능을 개별 토글할 수 있습니다. `grammar.applyToGrading`은 기본값과 설계 모두 `false`입니다. prior는 채점 결과를 바꾸지 않고, 유사 코드 안내와 애매성 표시용으로만 사용합니다.

## 검증

```bash
npm test
npm run test:browser
```

`npm run test:browser`는 로컬 서버가 `http://localhost:5173`에서 실행 중이어야 합니다.
