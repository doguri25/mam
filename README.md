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

## 감정 단어 키우기
- 12가지 감정마다 더 꼭 맞는 말 3개(`lib/shared.ts`의 `NUANCE`). 학생이 카드에서 고르거나, 말로 하면 AI가 골라 준다(`word`).
- 반 감정 단어(교과서 연결로 더한 것)는 ⭐로 보인다. 주간 리포트에 이번 주·지난주 쓴 감정 단어 수를 비교한다.

## 교과서·학습지 연결
- 「📚 교과서 연결」에서 PDF·사진·HWP 등(4MB 안)을 올리면 업스테이지 Document Parse(`lib/upstage.ts`)가 글을 읽고, 고른 AI가 감정 단어·교실 활동을 뽑는다(`extractLesson`). 선생님이 고른 것만 반 감정 단어와 차시 목록에 저장. 업스테이지 키 필요.

## 이번 주 마음 요약·다음 주 활동 추천
- 주간 리포트의 「AI로 만들기」. 이름·번호 없이 모은 숫자(`weekStats`)만 AI에 보내 흐름 3줄과 활동 2가지를 만든다. 교과서 연결 활동이 있으면 그중에서 먼저 고른다.

## 다문화 학생(영어·중국어·베트남어·일본어)
- 학생 화면 위 🌐에서 언어를 고르면(기기에 학생별로 저장) 화면 문구·감정 이름·읽어 주기·음성 인식·AI 되묻기가 그 언어로 바뀐다(`lib/i18n.ts`). 감정 카드에는 한국어도 함께 보여 우리말 감정 단어를 익힌다.
- 선생님 화면에는 언제나 한국어 요약(`summaryKo`)과 원문, 🌐 언어 표시가 보인다.

## 말투(목소리 기운)

설정 → 「말투 살피기」에서 고른다. 선생님 화면에만 보인다.

- 끄기: 말 내용으로만 정리.
- 기기 안에서 재기(기본): 브라우저가 소리 크기·높낮이·빠르기를 숫자로만 재서(`lib/voice.ts`) 그 학생의 평소 목소리(이전 말하기 기록 3번 이상의 가운데값)와 비교한다(`lib/tone.ts`). 결과는 고른 AI(업스테이지 포함)가 감정을 정리할 때 함께 참고한다.
- Gemini가 직접 듣기: 16kHz WAV를 Gemini에 보내 말투까지 판단(저장 안 함). Gemini 키 필요, 실패하면 기기 재기로.

## 선생님 앱(PWA)·휴대폰 알림

- `/teacher`에만 매니페스트(`public/teacher.webmanifest`)가 붙어 선생님 화면을 앱으로 설치한다(안드로이드 크롬 「앱 설치」, 아이폰 Safari 「홈 화면에 추가」).
- 「설정 → 휴대폰으로 위험 표현 알림 받기」로 기기를 등록하면, 학생 기록에 위험 표현이 들어올 때 웹 푸시가 간다(`lib/push.ts`, `public/sw.js`). 알림에는 번호만 담는다.
- 환경 변수 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`가 필요하다.

## 읽기량(Firestore)

- 교사 화면은 20초마다 변경 표시 문서(`meta/stamp`) 하나만 읽고, 기록이 바뀌었을 때만 그 뒤 바뀐 기록(`updatedAt`)만 받아 합친다.
- 교사 기기에 최근 기록을 저장해 두고(`localStorage`, 잠그면 지움) 다시 열 때도 그 뒤 바뀐 기록만 받는다. 기록을 지우면 `meta/stamp.wipe`가 바뀌어 저장해 둔 것을 버린다.
- Firebase 무료(Spark) 요금제는 하루 읽기 5만 번이 한도다(미국 태평양 자정, 한국 16~17시에 초기화). 여러 반이 쓰면 Blaze(종량제)로 올린다.
- 학생 화면은 자기 번호 기록만 읽는다. 전체 읽기는 CSV 내보내기뿐.

## 연습 데이터

- 이 컴퓨터는 `.env.local`의 `DATA_PREFIX=maeumbit_dev_`로 배포(`maeumbit_`)와 다른 공간을 쓴다.
- 「연습 데이터 만들기」로 만든 기록에는 `demo` 표시가 붙고, 노란 띠의 「연습 데이터 지우기」로 그것만 지운다.

## 저장소

- 고르는 순서: `MONGODB_URI`가 있으면 MongoDB Atlas(데이터베이스 이름 `MONGODB_DB`, 기본 `maeumbit`), 없고 `FIREBASE_SERVICE_ACCOUNT`가 있으면 Firestore(`maeumbit-gil`, 서울), 둘 다 없으면 `.data/db.json`.
- MongoDB Atlas 무료(M0)는 하루 읽기 한도가 없다(저장 512MB). Vercel에서 붙으려면 Atlas 「Network Access」에 `0.0.0.0/0`을 허용해야 한다(Vercel 서버 주소가 바뀌므로). 그래서 DB 사용자 비밀번호를 길고 무작위로 둔다.
- Firestore에서 옮기기: `FIREBASE_SERVICE_ACCOUNT=… MONGODB_URI=… node scripts/copy-to-mongo.mjs maeumbit_` (같은 `SESSION_SECRET`이면 넣어 둔 AI 키도 그대로 풀린다).
- Firestore 규칙은 브라우저 접근을 모두 막는다(`firestore.rules`). 읽기·쓰기는 서버의 관리자 SDK만.
- 교사가 넣은 API 키는 `SESSION_SECRET`으로 암호화해 저장한다. 이 값을 바꾸면 키를 다시 넣어야 한다.

## Vercel 배포

환경 변수 `SESSION_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `TEACHER_PASSWORD`(4자리보다 길게)를 넣고 배포한다. `.env.example` 참고.
