# 몽고DB → Turso 바꿔치기 순서

복사본(turso-preview 미리보기 + Turso `mam-test`)으로 시험을 마친 뒤 실제 앱을 Turso(`mam`, 도쿄)로 옮긴 순서다.
끊기는 때를 몇 초로 줄이려고 Turso로 도는 실제 배포를 미리 만들어 두고, 마지막 옮기기를 한 뒤 바로 그 배포로 넘긴다.

## 순서

1. Turso에 실제용 데이터베이스 `mam`(AWS AP NorthEast, 도쿄)과 읽기·쓰기 토큰(만료 없음)을 만든다.
2. Vercel **Production** 환경 변수: `TURSO_AUTH_TOKEN`(토큰, Sensitive)과 `TURSO_COPY_URL`(mam 주소).
   `TURSO_DATABASE_URL`이 없으므로 실제 앱은 아직 몽고로 돈다. 관리 화면만 `TURSO_COPY_URL`로 옮길 수 있다.
3. PR을 main에 합친다 → 실제 배포 ①(몽고).
4. Production에 `TURSO_DATABASE_URL`(mam 주소)을 넣고, 도메인을 붙이지 않은 실제 배포 ②(Turso)를 미리 빌드한다.
5. 실제 앱(①)에 운영 선생님(홍북초)으로 들어가 `/admin/db`에서 마지막 옮기기(`source: "final"`, 알림 구독까지 모두)를 한다.
6. 곧바로 ②를 실제 배포로 올린다(promote). 설정 화면 저장소가 「Turso」인지, 선생님 화면·학생 저장·쪽지·위험 표현 알림을 본다.
7. `TURSO_COPY_URL`은 지워도 된다. 실제 배포에서는 앱이 쓰는 Turso로 옮기기를 막아 두었다.

## 되돌리기

Production의 `TURSO_DATABASE_URL`을 지우고 다시 배포하면 몽고로 돌아간다(Vercel의 Instant Rollback으로 ①에 되돌려도 된다).
몽고 데이터는 바꿔치기 때 그대로 두었으므로 남아 있다. 다만 Turso로 돈 동안 쓴 기록은 몽고에 없다.
그 기록까지 살려야 하면 Turso → 몽고로 옮기는 도구를 쓴다(필요하면 만든다). 몽고 데이터는 한 달쯤 지우지 않고 둔다.

## 미리보기

turso-preview 브랜치 미리보기는 그대로 `mam-test`를 쓴다(브랜치 전용 환경 변수). 실제 데이터와 섞이지 않는다.
