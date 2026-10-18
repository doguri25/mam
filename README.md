# 마음빛 길잡이

초등 3학년이 카드나 한 문장으로 아침·하교 전 마음을 남기면, 선생님이 변화를 살펴보고 응원 한마디 초안을 받는 사회정서교육 도구.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000 (같은 와이파이 태블릿은 http://<이 컴퓨터 IP>:3000)
npm test           # 살펴볼 학생·위험 표현 규칙 테스트
```

- 학생: 첫 화면에 6자리 코드, 또는 QR(`/join?c=코드`).
- 선생님: `/teacher`, 비밀번호 `TEACHER_PASSWORD`(없으면 1324). 「설정」에서 AI 키(업스테이지·Claude·ChatGPT·Gemini)와 시연 데이터.

## 말투(목소리 기운)

설정 → 「말투 살피기」에서 고른다. 선생님 화면에만 보인다.

- 끄기: 말 내용으로만 정리.
- 기기 안에서 재기(기본): 브라우저가 소리 크기·높낮이·빠르기를 숫자로만 재서(`lib/voice.ts`) 그 학생의 평소 목소리(이전 말하기 기록 3번 이상의 가운데값)와 비교한다(`lib/tone.ts`). 결과는 고른 AI(업스테이지 포함)가 감정을 정리할 때 함께 참고한다.
- Gemini가 직접 듣기: 16kHz WAV를 Gemini에 보내 말투까지 판단(저장 안 함). Gemini 키 필요, 실패하면 기기 재기로.

## 저장소

- `.env.local`에 `FIREBASE_SERVICE_ACCOUNT`가 있으면 Firestore(`maeumbit-gil`, 서울), 없으면 `.data/db.json`.
- Firestore 규칙은 브라우저 접근을 모두 막는다(`firestore.rules`). 읽기·쓰기는 서버의 관리자 SDK만.
- 교사가 넣은 API 키는 `SESSION_SECRET`으로 암호화해 저장한다. 이 값을 바꾸면 키를 다시 넣어야 한다.

## Vercel 배포

환경 변수 `SESSION_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `TEACHER_PASSWORD`(4자리보다 길게)를 넣고 배포한다. `.env.example` 참고.
