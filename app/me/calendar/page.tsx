"use client";
// 내 마음 달력: 날마다 아침·하교 전 스티커 두 개. 내 기록만 보인다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { backToMe } from "@/lib/back";
import Doodle from "@/components/Doodle";
import { Loading, useRetry, useStudentLang } from "@/components/StudentFrame";
import { api } from "@/lib/api";
import { WEEKDAYS, langOf, t, w, type Lang } from "@/lib/i18n";
import { label } from "@/lib/date";
import { EmotionArt } from "@/components/Art";
import BuddyLazy from "@/components/BuddyLazy";
import type { BuddyLook, MoodRecord } from "@/lib/shared";

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const weekRow = (l: Lang) => WEEKDAYS[l];
// 고른 날 머리말: 한국어는 「11월 4일 (수)」, 다른 언어는 그 나라 날짜 모양으로
const dayTitle = (date: string, l: Lang) =>
  l === "ko" ? label(date) : new Intl.DateTimeFormat(langOf(l).speech, { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
// 달 머리말: 한국어는 「2026년 11월」, 다른 언어는 그 나라 모양으로
const monthTitle = (y: number, m: number, l: Lang) =>
  l === "ko" ? `${y}년 ${m}월` : new Intl.DateTimeFormat(langOf(l).speech, { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
const slotWord = (r: MoodRecord, l: Lang) => w(l, r.slot === "am" ? "아침" : "하교 전");

type CalMe = { today: string; no: number; space?: string; look: BuddyLook; flowers: { emotion: string }[] };

export default function Calendar() {
  const [month, setMonth] = useState("");
  const [who, setWho] = useState<{ no: number; space?: string } | null>(null);
  const [lang] = useStudentLang(who);
  // 받은 달과 그 달 기록: 달을 넘긴 뒤 새 달 기록이 오기 전에는 앞 달 기록으로 「아직」만 가득한 달을 보이지 않게
  const [got, setGot] = useState<{ month: string; list: MoodRecord[] } | null>(null);
  const [pick, setPick] = useState("");
  const [buddy, setBuddy] = useState<{ look: BuddyLook; flowers: number; emotion?: string } | null>(null);

  // 로그인이 풀렸을 때(401)만 첫 화면으로. 와이파이가 끊긴 것이면 잠시 뒤 다시 묻는다(달력 칸도 같게).
  useRetry(() => api<CalMe>("student", "me"), (m) => {
    setMonth((cur) => cur || m.today.slice(0, 7));
    setWho((cur) => (cur?.no === m.no && cur.space === m.space ? cur : { no: m.no, space: m.space }));
    setBuddy({ look: m.look, flowers: m.flowers.length, emotion: m.flowers.at(-1)?.emotion });
  });
  // 달을 빨리 넘기면 늦게 온 앞 달 답이 지금 달을 덮지 않게, 지금 달 답만 받는다
  useRetry(month ? () => api<{ records: MoodRecord[] }>("student", "records", { month }).then((r) => ({ month, list: r.records })) : null, setGot, month);
  const records = got?.month === month ? got.list : null;
  // 새 달을 읽는 중: 잠깐은 「…」, 오래 걸리면(와이파이 끊김) 연결을 기다린다고 알린다(다시 묻기는 useRetry가)
  const [slow, setSlow] = useState(false);
  const waiting = !!month && !!got && !records;
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setSlow(true), 1500);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [waiting]);

  if (!month || !who || !got) return <Loading lang={who ? lang : undefined} />;

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const picked = (records ?? []).filter((r) => r.date === pick).sort((a, b) => a.slot.localeCompare(b.slot));

  return (
    <main className="mx-auto max-w-3xl px-4 py-5" lang={lang}>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/me" onClick={backToMe} className="btn-sub min-h-10 px-3 text-sm">← {t(lang, "todayRec")}</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="btn-sub min-h-10 px-3" aria-label={t(lang, "prevMonth")}>‹</button>
          <h1 className="font-display text-2xl">{monthTitle(y, m, lang)}</h1>
          <button onClick={() => setMonth(shift(month, 1))} className="btn-sub min-h-10 px-3" aria-label={t(lang, "nextMonth")}>›</button>
        </div>
      </div>
      {buddy && (
        <div className="card mb-4 flex items-center gap-4 p-3">
          <BuddyLazy look={buddy.look} emotion={buddy.emotion} size={110} className="size-24 shrink-0 sm:size-28" />
          <div>
            <p className="text-sm text-soft">{buddy.look.name || t(lang, "buddy")}</p>
            <p className="font-display text-xl sm:text-2xl">{buddy.flowers ? t(lang, "calBuddy", { n: buddy.flowers }) : t(lang, "calBuddyEmpty")}</p>
          </div>
        </div>
      )}
      <div className="card relative p-3 sm:p-5" aria-busy={!records}>
        {!records && (
          <p className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-card/85 px-4 text-center text-lg text-soft" aria-live="polite">
            {slow ? t(lang, "waitNet") : "…"}
          </p>
        )}
        <div className="grid grid-cols-7 gap-1 text-center text-sm text-soft">
          {weekRow(lang).map((d, i) => <div key={i} className="py-1">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`x${i}`} />;
            const am = records?.find((r) => r.date === date && r.slot === "am");
            const pm = records?.find((r) => r.date === date && r.slot === "pm");
            const said = [am, pm].filter((r): r is MoodRecord => !!r).map((r) => `${slotWord(r, lang)} ${w(lang, r.word || r.emotion)}`);
            return (
              <button
                key={date}
                onClick={() => setPick(date)}
                aria-label={[dayTitle(date, lang), ...said].join(", ")}
                aria-pressed={pick === date}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border ${pick === date ? "border-leaf bg-leaf-soft" : "border-transparent hover:bg-paper"}`}
              >
                <span className="text-xs text-ink">{Number(date.slice(8))}</span>
                {/* 아침·하교 전 두 얼굴을 나란히, 겹치지 않게 */}
                <span className="flex h-5 items-center gap-px sm:h-7 sm:gap-1">
                  {am && <EmotionArt lang={lang} name={am.word || am.emotion} size={20} className="sm:size-7" />}
                  {pm && <EmotionArt lang={lang} name={pm.word || pm.emotion} size={20} className="sm:size-7" />}
                  {!am && !pm && <span className="text-line">·</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {pick && records && (
        <div className="card mt-4">
          <h2 className="font-display text-xl">{dayTitle(pick, lang)}</h2>
          {picked.length ? (
            picked.map((r) => (
              <div key={r.id} className="mt-3 flex items-start gap-3">
                <EmotionArt lang={lang} name={r.word || r.emotion} size={44} />
                <p>
                  <Doodle name={r.slot === "am" ? "sun" : "sunset"} /> {slotWord(r, lang)} · <b>{w(lang, r.emotion)}</b>{r.word && <> · {w(lang, r.word)}</>} · {w(lang, r.reason)}
                  {r.summary && <span className="block text-soft">“{r.summary}”</span>}
                </p>
              </div>
            ))
          ) : (
            <p className="mt-2 text-soft">{t(lang, "notYet")}</p>
          )}
        </div>
      )}
    </main>
  );
}
