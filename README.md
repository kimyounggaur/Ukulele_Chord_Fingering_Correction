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
- C, Am, F, G, A, D, Dm, C7, G7, Em 코드 판정
- 한국어 교정 문구, 음성 안내, 스무딩, 홀드 게이트
- 코드 진행 연습 모드와 간단한 세션 리포트

## 검증

```bash
npm test
npm run test:browser
```

`npm run test:browser`는 로컬 서버가 `http://localhost:5173`에서 실행 중이어야 합니다.
