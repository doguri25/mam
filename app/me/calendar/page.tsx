"use client";
// 내 마음 달력: 날마다 아침·하교 전 스티커 두 개. 내 기록만 보인다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { EmotionArt } from "@/components/Art";
import type { MoodRecord } from "@/lib/shared";

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default function Calendar() {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [records, setRecords] = useState<MoodRecord[]>([]);
  const [pick, setPick] = useState("");

  useEffect(() => {
    api<{ today: string }>("student", "me").then((m) => setMonth(m.today.slice(0, 7)), () => router.replace("/"));
  }, [router]);

  useEffect(() => {
    if (month) api<{ records: MoodRecord[] }>("student", "records", { month }).then((r) => setRecords(r.records));
  }, [month]);

  if (!month) return <main className="grid min-h-dvh place-items-center text-soft">불러오는 중…</main>;

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const picked = records.filter((r) => r.date === pick).sort((a, b) => a.slot.localeCompare(b.slot));

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/me" className="btn-sub min-h-10 px-3 text-sm">← 오늘의 마음</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="btn-sub min-h-10 px-3" aria-label="지난달">‹</button>
          <h1 className="font-display text-2xl">{y}년 {m}월</h1>
          <button onClick={() => setMonth(shift(month, 1))} className="btn-sub min-h-10 px-3" aria-label="다음 달">›</button>
        </div>
      </div>
      <div className="card p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-sm text-soft">
          {"일월화수목금토".split("").map((d) => <div key={d} className="py-1">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`x${i}`} />;
            const am = records.find((r) => r.date === date && r.slot === "am");
            const pm = records.find((r) => r.date === date && r.slot === "pm");
            return (
              <button
                key={date}
                onClick={() => setPick(date)}
                aria-label={`${Number(date.slice(8))}일${am ? ` 아침 ${am.emotion}` : ""}${pm ? ` 하교 전 ${pm.emotion}` : ""}`}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border ${pick === date ? "border-leaf bg-leaf-soft" : "border-transparent hover:bg-paper"}`}
              >
                <span className="text-xs text-ink">{Number(date.slice(8))}</span>
                {/* 아침·하교 전 두 얼굴을 나란히, 겹치지 않게 */}
                <span className="flex h-5 items-center gap-px sm:h-7 sm:gap-1">
                  {am && <EmotionArt name={am.emotion} size={20} className="sm:size-7" />}
                  {pm && <EmotionArt name={pm.emotion} size={20} className="sm:size-7" />}
                  {!am && !pm && <span className="text-line">·</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {pick && (
        <div className="card mt-4">
          <h2 className="font-display text-xl">{label(pick)}</h2>
          {picked.length ? (
            picked.map((r) => (
              <div key={r.id} className="mt-3 flex items-start gap-3">
                <EmotionArt name={r.emotion} size={44} />
                <p>
                  {r.slot === "am" ? "☀️ 아침" : "🌇 하교 전"} · <b>{r.emotion}</b> · {r.reason}
                  {r.summary && <span className="block text-soft">“{r.summary}”</span>}
                </p>
              </div>
            ))
          ) : (
            <p className="mt-2 text-soft">이날은 기록이 없어요.</p>
          )}
        </div>
      )}
    </main>
  );
}
