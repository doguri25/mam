# 몽고DB → Turso 바꿔치기 순서

복사본(turso-preview 미리보기 + Turso `mam-test`)으로 시험을 마친 뒤 실제 앱을 Turso로 옮기는 순서다.
학생·선생님이 쓰지 않는 밤이나 주말에 한다. 복사한 뒤 실제 앱이 Turso로 바뀌기 전(1~2분) 사이에 몽고에 쓴 기록은 옮겨지지 않기 때문이다.

## 미리 해 둘 것(언제든)

1. **PR 합치기**: 코드만 main에 들어가고 실제 앱은 그대로 몽고로 돈다(Production에 `TURSO_DATABASE_URL`이 없으므로).
   저장소에 덜 오가게 고친 것은 몽고에서도 그대로 빨라진다. `/admin/db`는 실제 배포에서 404.
2. **실제용 Turso 데이터베이스** `mam`을 도쿄(AWS AP NorthEast)에 만들고, 읽기·쓰기 토큰을 만든다(만료 없음).
   시험용 `mam-test`는 앞으로도 미리보기 시험에 쓴다.

## 바꿔치기(10분쯤)

1. Vercel 환경 변수에서 **turso-preview 브랜치 전용** `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`을 실제용 `mam`으로 바꾸고 미리보기를 다시 배포한다.
2. 미리보기 `/admin/db`에서 마지막 옮기기(`source: "final"`, 알림 구독까지 모두)를 한다. 모음마다 수·내용이 맞는지 본다.
3. 곧바로 **Production**에 `TURSO_DATABASE_URL`(mam 주소)·`TURSO_AUTH_TOKEN`(토큰, Sensitive)을 넣고 실제 앱을 다시 배포한다.
4. 실제 앱에서 확인: 설정 화면의 저장소가 「Turso」, 선생님 화면·학생 기록 저장·쪽지·위험 표현 알림.
5. turso-preview 브랜치 환경 변수를 다시 `mam-test`로 돌린다(미리보기가 실제 데이터를 건드리지 않게).
6. 개인정보 처리방침의 저장 위치를 고친다(학생 기록이 일본 도쿄에 저장됨, Turso).

## 되돌리기

Production의 `TURSO_DATABASE_URL`을 지우고 다시 배포하면 몽고로 돌아간다. 몽고 데이터는 바꿔치기 때 그대로 두었으므로 남아 있다.
다만 Turso로 돈 동안 쓴 기록은 몽고에 없다. 그 기록까지 살려야 하면 Turso → 몽고로 옮기는 도구를 쓴다(필요하면 만든다).
몽고 데이터는 바꿔치기 뒤 한 달쯤 지우지 않고 둔다.
