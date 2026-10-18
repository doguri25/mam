"use client";
// 우리 반 마음 날씨: 주간(7일)·월간(30일) 날마다 감정 무리 비율
import { useState } from "react";
import { addDays, label, weekday } from "@/lib/date";
import { GROUPS, groupOf, type Group, type MoodRecord } from "@/lib/shared";

const groups = Object.keys(GROUPS) as Group[];

export function Bars({ records, days, today, compact }: { records: MoodRecord[]; days: string[]; today: string; compact?: boolean }) {
  return (
    <div className={`flex items-end ${compact ? "h-40 gap-[3px]" : "h-48 gap-3"}`}>
      {days.map((d) => {
        const day = records.filter((r) => r.date === d);
        return (
          <div key={d} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full max-w-14 flex-1 flex-col-reverse overflow-hidden rounded-lg bg-paper" title={`${label(d)} · ${day.length}건`}>
              {groups.map((g) => {
                const n = day.filter((r) => groupOf(r.emotion) === g).length;
                return n ? <div key={g} style={{ height: `${(n / day.length) * 100}%`, background: GROUPS[g].color }} /> : null;
              })}
            </div>
            {compact ? (
              <span className={`h-3.5 text-[10px] leading-none ${d === today ? "font-bold" : "text-soft"}`}>{Number(d.slice(8)) % 5 === 0 || d === today ? Number(d.slice(8)) : ""}</span>
            ) : (
              <>
                <span className={`text-xs ${d === today ? "font-bold" : "text-soft"}`}>{weekday(d)}</span>
                <span className="text-[10px] text-soft">{day.length}건</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs">
      {groups.map((g) => (
        <span key={g} className="flex items-center gap-1">
          <span className="size-3 rounded" style={{ background: GROUPS[g].color }} />
          {GROUPS[g].label}
        </span>
      ))}
    </div>
  );
}

export default function Weather({ records, today }: { records: MoodRecord[]; today: string }) {
  const [month, setMonth] = useState(false);
  const n = month ? 30 : 7;
  const days = Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">우리 반 마음 날씨</h2>
        <div role="group" className="flex rounded-xl border border-line p-0.5 text-sm">
          {[false, true].map((m) => (
            <button key={String(m)} aria-pressed={month === m} onClick={() => setMonth(m)} className={`rounded-lg px-3 py-1 ${month === m ? "bg-leaf text-white" : "text-soft"}`}>
              {m ? "최근 30일" : "이번 주"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-soft">날마다 모인 기록을 감정 무리로 나눈 비율이에요. 순위나 비교가 아니라 반 전체의 흐름이에요.</p>
      <Bars records={records} days={days} today={today} compact={month} />
      <Legend />
    </section>
  );
}
