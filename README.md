# 📷 인생네컷 — 웹 포토부스

> 설치 없이 링크 하나로 즐기는 4컷 포토부스 웹앱

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://77jumpstart77-code.github.io/livephoto/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#)

---

## 🌐 바로 사용하기

| 환경 | URL |
|------|-----|
| **GitHub Pages** | https://77jumpstart77-code.github.io/livephoto/ |
| **AWS 서버** | https://15.165.116.71/livephoto/ |

> 📱 모바일 / 💻 노트북 브라우저에서 모두 사용 가능  
> 🔒 카메라 데이터는 기기 밖으로 나가지 않습니다 (로컬 처리)

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| ⏱ 카운트다운 촬영 | 0 / 3 / 5초 타이머 선택 |
| 🪞 거울 모드 | 좌우 반전 실시간 토글 |
| 📸 4컷 자동 촬영 | 연속 촬영 후 자동으로 다음 컷 진행 |
| 🖼 2×2 합성 | 촬영 즉시 인생네컷 스타일 이미지 생성 |
| 🎨 프레임 6종 | 없음 · 핑크 · 블루 · 골드 · 다크 · 봄날 |
| ✏️ 문구 입력 | 결과 이미지에 텍스트 삽입 |
| 🔄 컷 교체 | 개별 컷만 재촬영 가능 |
| ⬇ 저장 | JPEG 파일로 즉시 다운로드 |
| 📲 PWA | 홈 화면에 앱처럼 설치 가능 |

---

## 🗂 파일 구조

```
livephoto/
├── index.html      # 3개 화면 (랜딩 / 촬영 / 결과)
├── style.css       # 다크 퍼플 테마, 애니메이션
├── app.js          # 카메라 · 카운트다운 · 합성 · 저장 로직
├── manifest.json   # PWA 메타데이터
└── sw.js           # 오프라인 캐시 서비스 워커
```

---

## 🚀 로컬 실행

HTTPS 또는 localhost 환경이 필요합니다 (`getUserMedia` 보안 정책).

```powershell
# PowerShell HTTP 서버 예시
$l = [System.Net.HttpListener]::new()
$l.Prefixes.Add('http://localhost:3000/')
$l.Start()
```

또는 VS Code **Live Server** 확장을 사용하세요.

---

## 🧑‍💻 사용자 흐름

```
[랜딩] 카메라 켜기
  → [촬영] 타이머 설정 → 촬영 시작 → 카운트다운 × 4
  → [결과] 프레임 선택 → 문구 입력 → 저장하기
```

---

## 🔒 보안 / 개인정보

- 모든 이미지 처리는 **브라우저 내 Canvas API** 로컬 처리
- 서버로 사진이 전송되지 않음
- HTTPS/localhost 환경에서만 카메라 접근 가능 (브라우저 표준)

---

## 📝 라이선스

MIT License
