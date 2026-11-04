"use client";
// 내 마음 달력: 날마다 아침·하교 전 스티커 두 개. 내 기록만 보인다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { backToMe } from "@/lib/back";
import Doodle from "@/components/Doodle";
import { api } from "@/lib/api";
import { WEEKDAYS, isLang, langOf, t, w, type Lang } from "@/lib/i18n";
import { useLocal } from "@/lib/local";
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

export default function Calendar() {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [no, setNo] = useState(0);
  const [langRaw] = useLocal(`mb_lang_${no}`);
  const lang: Lang = isLang(langRaw) ? langRaw : "ko";
  const [records, setRecords] = useState<MoodRecord[]>([]);
  const [pick, setPick] = useState("");
  const [buddy, setBuddy] = useState<{ look: BuddyLook; flowers: number; emotion?: string } | null>(null);

  // 로그인이 풀렸을 때(401)만 첫 화면으로. 와이파이가 끊긴 것이면 잠시 뒤 다시 묻는다.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (wait: number) =>
      api<{ today: string; no: number; look: BuddyLook; flowers: { emotion: string }[] }>("student", "me").then(
        (m) => {
          if (!alive) return;
          setMonth((cur) => cur || m.today.slice(0, 7));
          setNo(m.no);
          setBuddy({ look: m.look, flowers: m.flowers.length, emotion: m.flowers.at(-1)?.emotion });
        },
        (e) => {
          if (!alive) return;
          if ((e as { status?: number }).status === 401) return router.replace("/");
          timer = setTimeout(() => load(Math.min(wait * 2, 10_000)), wait);
        },
      );
    load(2000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [router]);

  // 달을 빨리 넘기면 늦게 온 앞 달 답이 지금 달을 덮지 않게, 지금 달 답만 받는다
  useEffect(() => {
    if (!month) return;
    let alive = true;
    api<{ records: MoodRecord[] }>("student", "records", { month }).then((r) => alive && setRecords(r.records), () => {});
    return () => {
      alive = false;
    };
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
        <Link href="/me" onClick={backToMe} className="btn-sub min-h-10 px-3 text-sm">← {t(lang, "todayRec")}</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="btn-sub min-h-10 px-3" aria-label="지난달">‹</button>
          <h1 className="font-display text-2xl">{lang === "ko" ? `${y}년 ${m}월` : `${y} · ${m}`}</h1>
          <button onClick={() => setMonth(shift(month, 1))} className="btn-sub min-h-10 px-3" aria-label="다음 달">›</button>
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
      <div className="card p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-sm text-soft">
          {weekRow(lang).map((d, i) => <div key={i} className="py-1">{d}</div>)}
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
                  {am && <EmotionArt name={am.word || am.emotion} size={20} className="sm:size-7" />}
                  {pm && <EmotionArt name={pm.word || pm.emotion} size={20} className="sm:size-7" />}
                  {!am && !pm && <span className="text-line">·</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {pick && (
        <div className="card mt-4">
          <h2 className="font-display text-xl">{dayTitle(pick, lang)}</h2>
          {picked.length ? (
            picked.map((r) => (
              <div key={r.id} className="mt-3 flex items-start gap-3">
                <EmotionArt name={r.word || r.emotion} size={44} />
                <p>
                  <Doodle name={r.slot === "am" ? "sun" : "sunset"} /> {w(lang, r.slot === "am" ? "아침" : "하교 전")} · <b>{w(lang, r.emotion)}</b>{r.word && <> · {w(lang, r.word)}</>} · {w(lang, r.reason)}
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
