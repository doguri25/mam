"use client";
// 교사용 한 장 사용 설명서: 화면에서 읽고 A4 한 장으로 인쇄
const STEPS: [string, string, string[]][] = [
  ["1", "처음 한 번 (10분)", [
    "「설정」 → 「선생님 비밀번호 바꾸기」에서 처음 비밀번호를 학생들이 모르는 숫자로 바꿔요.",
    "「설정」에서 쓸 AI를 고르고 API 키를 넣은 뒤 「연결 확인」을 눌러요(업스테이지 권장).",
    "「학생 코드·QR」에 「번호 가명」 명단을 넣고 「명단 저장」 → 「QR 카드 인쇄」로 나눠 줘요. 실명은 넣지 않아요.",
    "실명으로 보고 싶으면 같은 탭 「실명 보기」에 명렬표를 붙여 넣어요(이 컴퓨터에만 저장).",
    "연습해 봤다면 위쪽 노란 띠의 「연습 데이터 지우기」로 지우고 시작해요.",
    "보호자 동의(AI 사용·받아쓰기·말투 방식·보관 기간)를 먼저 받아 주세요.",
  ]],
  ["2", "매일 아침·하교 전 (학생 2분)", [
    "학생이 태블릿으로 QR을 찍거나 코드를 넣고 「카드로 골라요」 또는 「말로 해요」로 기록해요.",
    "마음 친구가 한 번만 되묻고, 답하지 않아도 저장돼요. 끝나면 「다음 친구 차례」를 눌러 넘겨요.",
    "글을 읽기 어려운 학생은 위쪽 「🔊 읽어 주기」를 켜 주세요.",
  ]],
  ["3", "수업 후 (교사 5분)", [
    "「마음 지도」에서 오늘 칸(아침→하교 전)과 🟡 먼저 살펴볼 학생, 기록 없음 학생을 확인해요.",
    "학생 칸을 누르면 2주 기록·말투가 보여요. 이야기를 나눴다면 「면담 메모」를 남기고 「살펴봤어요」를 눌러요.",
    "신호는 진단이 아니에요. 대화를 시작할 실마리로만 써 주세요.",
  ]],
  ["4", "금요일 (교사 10분)", [
    "「응원 한마디」에서 학생을 골라 「AI 초안 만들기」 → 마음에 드는 초안을 고쳐 「저장하고 복사」 → 쪽지·알림장으로 전해요.",
    "⚠️ 표시가 뜬 말(횟수·「기록」 같은 말)은 아이에게 맞게 고쳐 주세요. 학생에게 자동으로 가지 않아요.",
    "「주간 리포트」의 「AI로 만들기」로 이번 주 흐름 3줄과 다음 주 활동 2가지를 받아요. 그다음 A4로 인쇄하거나 PDF로 저장해요(밖으로 낼 때는 번호로만).",
    "도덕 시간에 쓴 교과서·학습지 쪽은 「📚 교과서 연결」에 올려요. 고른 감정 단어가 학생 화면에 ⭐로 나타나요.",
    "다문화 학생은 학생 화면 위 🌐에서 언어(영어·중국어·베트남어·일본어)를 골라 주세요. 선생님 화면에는 한국어로 정리돼요.",
  ]],
];

export default function GuideTab() {
  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end">
        <button onClick={() => window.print()} className="btn-main">🖨️ 한 장으로 인쇄</button>
      </div>
      <article className="card mx-auto max-w-[210mm] space-y-4 bg-white p-7 text-[13.5px] leading-6 print:border-0 print:p-0 print:text-[11.5px] print:leading-5">
        <header className="flex items-end justify-between border-b-2 border-ink pb-2">
          <h2 className="font-display text-3xl">마음빛 길잡이 · 선생님 한 장 안내</h2>
          <p className="text-sm text-soft">하루 두 번 마음 기록 → 수업 후 살펴보기</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {STEPS.map(([n, title, items]) => (
            <section key={n} className="rounded-2xl border border-line p-3">
              <h3 className="mb-1 font-bold"><span className="mr-1.5 inline-grid size-6 place-items-center rounded-full bg-leaf text-xs text-white">{n}</span>{title}</h3>
              <ul className="list-disc space-y-0.5 pl-5">
                {items.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <section className="rounded-2xl border-2 border-alert bg-alert-soft p-3">
          <h3 className="font-bold text-alert">⚠️ 위험 표현 알림이 오면</h3>
          <ul className="list-disc pl-5">
            <li>마음 지도 맨 위 빨간 띠에서 학생 말을 확인해요. 학생 화면에는 아무 표시도 나가지 않아요.</li>
            <li>그날 안에 조용히 이야기를 나누고, 학교 위기관리 절차에 따라 Wee클래스·상담교사와 함께 판단해요. (청소년상담 1388 · 자살예방상담 109)</li>
            <li>확인했다면 「살펴봤어요」를 눌러 띠를 내려요.</li>
          </ul>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <section className="rounded-2xl border border-line p-3">
            <h3 className="mb-1 font-bold">📱 휴대폰으로 알림 받기</h3>
            <ul className="list-disc pl-5">
              <li><b>안드로이드:</b> 크롬으로 선생님 화면 → 메뉴 「앱 설치(홈 화면에 추가)」 → 앱의 「설정」 → 「이 기기에서 알림 받기」.</li>
              <li><b>아이폰(iOS 16.4+):</b> Safari로 선생님 화면 → 공유(□↑) → 「홈 화면에 추가」 → 홈 화면 앱을 열고 「설정」 → 「이 기기에서 알림 받기」.</li>
              <li>「시험 알림 보내기」로 확인해요. 알림엔 번호만 나와요.</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-line p-3">
            <h3 className="mb-1 font-bold">🔒 지켜 주세요</h3>
            <ul className="list-disc pl-5">
              <li>명단에는 가명, AI에는 가명만 가요. 면담 메모는 AI에 쓰이지 않아요.</li>
              <li>자리를 비울 때는 「잠그기」. 비밀번호는 다른 사람과 나누지 않아요.</li>
              <li>말투(목소리 기운)는 참고일 뿐 감정을 단정하지 않아요.</li>
              <li>학년도가 끝나면 「설정」 → CSV 내보내기 후 「모두 지우기」.</li>
            </ul>
          </section>
        </div>

        <footer className="border-t border-line pt-2 text-xs text-soft">
          자주 묻는 것 — 코드를 잃어버렸어요: 「학생 코드·QR」에서 「새 코드」. · 기록이 안 보여요: 20초 안에 자동으로 바뀌어요. · AI가 안 돼요: 「설정」 → 「연결 확인」, 키가 없어도 카드 기록과 기본 질문은 돼요.
        </footer>
      </article>
    </div>
  );
}
