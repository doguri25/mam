"use client";
// 상담 연계 의견서: Wee클래스·상담교사에게 넘길 관찰 의견을 A4 한 장으로. AI는 최근 2주 기록(가명)으로
// 「관찰된 정서 흐름 · 학생이 말한 까닭 · 도움이 된 것」 초안만 쓰고, 선생님이 고치고 나머지를 채운 뒤 인쇄한다. 자동으로 보내지 않는다.
// 위 학생 명단 → 왼쪽 최근 2주 기록(화면에 고정)을 보며 오른쪽 의견서를 쓴다.
import { useState } from "react";
import { RefPanel, StudentStrip, TwoPane } from "./StudentPick";
import type { NameOf, Overview } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";

type Draft = { flow: string; reasons: string; helps: string };

export default function ReferralTab({ data, nameOf }: { data: Overview; nameOf: NameOf }) {
  // 선생님이 남긴 면담 메모는 AI에 보내지 않고, 「담임이 해 본 지원」 칸에만 미리 채워 둔다
  const memo = (n: number | null) => data.notes.filter((x) => x.no === n).slice(0, 3).map((x) => `· ${label(x.createdAt.slice(0, 10))}: ${x.text}`).join("\n");
  const first = data.flags[0]?.no ?? null;
  const [no, setNo] = useState<number | null>(first);
  const [draft, setDraft] = useState<Draft>({ flow: "", reasons: "", helps: "" });
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [tried, setTried] = useState(() => memo(first));
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function choose(n: number) {
    setNo(n);
    setDraft({ flow: "", reasons: "", helps: "" });
    setRange(null);
    setErr("");
    setTried(memo(n));
    setAsk("");
  }

  async function make() {
    if (no === null) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ draft: Draft; from: string; to: string }>("teacher", "referral", { no });
      setDraft(r.draft);
      setRange({ from: r.from, to: r.to });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const box = (title: string, value: string, set: (v: string) => void, rows = 4, hint = "") => (
    <label className="block">
      <span className="text-sm font-bold">{title}</span>
      {hint && <span className="ml-2 text-xs text-soft print:hidden">{hint}</span>}
      <textarea value={value} onChange={(e) => set(e.target.value)} rows={rows} className="field mt-1 print:border-0 print:p-0" />
    </label>
  );

  return (
    <div className="space-y-4">
      <StudentStrip data={data} no={no} nameOf={nameOf} onPick={choose} />
      {no === null ? (
        <div className="card text-soft">위에서 학생을 골라 주세요. 🟡 표시는 이번 주 먼저 살펴볼 학생이에요.</div>
      ) : (
        <TwoPane
          left={<RefPanel data={data} no={no} nameOf={nameOf} />}
          right={
            <>
              <div className="no-print flex flex-wrap items-center gap-2">
                <button onClick={make} disabled={busy} className="btn-main">{busy ? "AI가 쓰는 중…" : "✨ AI 초안 만들기"}</button>
                <button onClick={() => window.print()} className="btn-sub">🖨️ A4로 인쇄·PDF 저장</button>
                {err && <span className="text-sm text-alert">{err}</span>}
              </div>
              <article className="card mx-auto max-w-[210mm] space-y-4 bg-white p-6 sm:p-8 print:border-0 print:p-0">
                <header className="border-b-2 border-ink pb-3">
                  <h2 className="font-display text-2xl sm:text-3xl">학생 관찰 의견 (상담 연계용)</h2>
                  <p className="mt-1 text-sm text-soft">
                    {data.settings.className} · {no}번 {nameOf(no)}
                    {range && <> · 관찰 기간 {label(range.from)} ~ {label(range.to)}</>}
                  </p>
                </header>
                {/* 화면에서는 왼쪽 칸에 보이므로 인쇄할 때만 */}
                <div className="hidden space-y-1 print:block">
                  {data.flags.find((f) => f.no === no)?.reasons.map((r) => <p key={r} className="text-sm">🟡 {r}</p>)}
                </div>
                {box("1. 관찰된 정서 흐름", draft.flow, (v) => setDraft({ ...draft, flow: v }), 5, "AI 초안 — 사실과 다르면 고쳐 주세요")}
                {box("2. 학생이 스스로 말한 까닭·상황", draft.reasons, (v) => setDraft({ ...draft, reasons: v }), 3)}
                {box("3. 도움이 된 것으로 보이는 것", draft.helps, (v) => setDraft({ ...draft, helps: v }), 2)}
                {box("4. 담임이 해 본 지원", tried, setTried, 3, "면담 메모에서 미리 채움(AI에는 보내지 않음)")}
                {box("5. 요청 사항", ask, setAsk, 2, "예: 개별 상담, 보호자 상담 연계")}
                <footer className="border-t border-line pt-2 text-xs text-soft">
                  학생이 스스로 남긴 마음 기록과 담임 관찰을 정리한 참고 자료이며 진단이 아닙니다. 학교 위기관리·상담 절차에 따라 다뤄 주세요.
                </footer>
              </article>
            </>
          }
        />
      )}
    </div>
  );
}
