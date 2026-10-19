"use client";
// 응원 한마디·상담 의견서가 함께 쓰는 틀:
// 위에는 여러 줄 학생 명단(🟡 살펴볼 학생 먼저, 가로 스크롤 없음), 아래는 왼쪽 「최근 기록」(화면에 고정, 칸 안에서만 스크롤) + 오른쪽 「작성 칸」.
// 넓은 화면(1280px 이상)은 좌우로 두고 왼쪽 칸이 화면에 고정된다. 그보다 좁으면(가로·세로 태블릿) 참고 칸을 위에 고정하고
// 높이를 줄여(화면의 1/3쯤) 아래 작성 칸을 써 내려가는 동안에도 기록이 계속 보이게 한다.
import BuddyFace from "../BuddyFace";
import ReflectBox from "./ReflectBox";
import Timeline from "./Timeline";
import type { NameOf, Overview } from "./types";

export function StudentStrip({ data, no, onPick, nameOf }: { data: Overview; no: number | null; onPick: (n: number) => void; nameOf: NameOf }) {
  const flagged = new Set(data.flags.map((f) => f.no));
  const order = [...data.students].sort((a, b) => Number(flagged.has(b.no)) - Number(flagged.has(a.no)) || a.no - b.no);
  const last = (n: number) => data.records.filter((r) => r.no === n).sort((a, b) => a.id.localeCompare(b.id)).at(-1)?.emotion;
  return (
    <div className="no-print card p-2">
      <p className="px-2 pb-1 text-xs text-soft">학생 고르기 · 🟡 살펴볼 신호가 있는 학생이 앞에 와요</p>
      {/* 가로 스크롤 없이 여러 줄로(25명이면 넓은 화면 두세 줄) */}
      <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="학생">
        {order.map((s) => (
          <button
            key={s.no}
            role="option"
            aria-selected={s.no === no}
            onClick={() => onPick(s.no)}
            className={`flex min-h-11 items-center gap-1 rounded-2xl border px-2.5 text-sm font-bold ${s.no === no ? "border-leaf bg-leaf text-white" : "border-line bg-card hover:bg-paper"}`}
          >
            <BuddyFace look={data.looks[s.no]} emotion={last(s.no)} size={22} />
            {s.no} {nameOf(s.no)}
            {flagged.has(s.no) && <span aria-label="살펴볼 신호">🟡</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// 왼쪽 참고 칸: 살펴볼 신호 · 한 주 돌아보기 · 최근 2주 기록
export function RefPanel({ data, no, nameOf }: { data: Overview; no: number; nameOf: NameOf }) {
  const last = data.records.filter((r) => r.no === no).sort((a, b) => a.id.localeCompare(b.id)).at(-1)?.emotion;
  return (
    <section
      aria-label="최근 기록"
      className="no-print card sticky top-[64px] z-10 max-h-[36dvh] space-y-3 overflow-y-auto shadow-lg lg:top-3 xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:shadow-[0_2px_0_rgba(45,58,51,0.04)]"
    >
      <h2 className="flex items-center gap-2 font-display text-xl">
        <BuddyFace look={data.looks[no]} emotion={last} size={40} />
        {no}번 {nameOf(no)} · 최근 2주
      </h2>
      {data.flags.find((f) => f.no === no)?.reasons.map((r) => <p key={r} className="rounded-xl bg-[#fff8e1] px-3 py-1 text-sm">🟡 {r}</p>)}
      <ReflectBox reflects={data.reflects} no={no} />
      <Timeline records={data.records.filter((r) => r.no === no)} today={data.today} />
    </section>
  );
}

export function TwoPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] print:block">
      {left}
      <div className="min-w-0 space-y-4">{right}</div>
    </div>
  );
}
