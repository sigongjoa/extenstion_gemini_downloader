# Gemini Conversation Downloader - 배포 가이드

이 확장 프로그램을 다른 사람들에게 공유하거나 크롬 웹 스토어에 올리는 방법을 안내합니다.

## 1. 배포용 파일 준비 (패키징)

확장 프로그램을 배포하려면 다음 파일 및 폴더들만 포함하여 ZIP 파일로 압축해야 합니다.

### 필수 포함 목록:
- `manifest.json`
- `dist/` (빌드된 자바스크립트 파일들)
- `src/*.html` (offscreen.html, sandbox.html, popup.html)
- `lib/` (Typst WASM 파일들)
- `fonts/` (나눔고딕 폰트)
- `icons/` (확장 프로그램 아이콘)

### 제외 대상 (용량 최적화):
- `node_modules/` (매우 큼, 절대 포함 금지) 
- `src/` 내의 `.js` 파일들 (이미 `dist/`에 합쳐짐)
- `.git/` 폴더
- `package.json`, `package-lock.json`
- 기타 임시 파일 (`*.zip`, `*.pdf` 등)

---

## 2. 배포 방법

### 방법 A: 개인적인 공유 (개발자 모드용)
1. 위 필수 목록을 ZIP으로 압축하여 공유합니다.
2. 받는 사람은 압축을 풀고 크롬의 `chrome://extensions`에서 **'압축해제된 확장 프로그램을 로드'** 버튼으로 폴더를 선택하면 바로 사용할 수 있습니다.

### 방법 B: 크롬 웹 스토어 공식 출시
1. **개발자 대시보드 접속**: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)에 접속합니다. (최초 등록 시 등록비 $5가 발생할 수 있습니다.)
2. **새 항목 추가**: 위에서 만든 ZIP 파일을 업로드합니다.
3. **정보 입력**: 설명, 스크린샷, 아이콘 등을 등록합니다.
4. **심사 요청**: 구글의 보안 심사(보통 1~3일 소요)를 거친 후 공식적으로 게시됩니다.

---

## 3. 업데이트 방법
1. 코드를 수정한 후 반드시 `npm run build`를 실행하여 `dist/` 폴더를 최신화합니다.
2. `manifest.json`의 `"version"` 번호를 올립니다 (예: `1.0` -> `1.1`).
3. 다시 ZIP으로 압축하여 웹 스토어 대시보드에 업로드하면 업데이트 심사가 시작됩니다.
