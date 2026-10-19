"use client";
// 한 주 돌아보기: 이번 주(월요일부터) 내 마음 스티커를 보고 「이번 주 나는…」 한 줄을 쓰면 마음 친구가 답한다.
import { useEffect, useState } from "react";
import { EmotionArt } from "@/components/Art";
import BuddyLazy from "@/components/BuddyLazy";
import StudentFrame, { Loading, useStudent } from "@/components/StudentFrame";
import { api } from "@/lib/api";
import { addDays } from "@/lib/date";
import { WEEKDAYS, w, type UIKey } from "@/lib/i18n";
import { speak } from "@/lib/local";
import type { MoodRecord } from "@/lib/shared";

type Week = { weekStart: string; today: string; records: MoodRecord[]; reflect: { text: string; reply: string } | null };
const STARTERS: UIKey[] = ["weekS1", "weekS2", "weekS3", "weekS4"];

export default function WeekPage() {
  const { me, lang, tt } = useStudent();
  const [week, setWeek] = useState<Week | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cheer, setCheer] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<Week>("student", "week").then(setWeek, () => {});
  }, []);

  if (!me || !week) return <Loading />;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i)).filter((d) => d <= week.today);
  const last = week.records.at(-1)?.emotion;

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const full = `${tt("weekPrompt")} ${text.trim()}`;
      const { reply } = await api<{ reply: string }>("student", "reflect", { text: full, lang });
      setWeek({ ...week!, reflect: { text: full, reply } });
      setEditing(false);
      setCheer((n) => n + 1);
      speak(reply, false, lang);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <StudentFrame title={tt("weekTitle")} lang={lang} wide>
      <section className="card mb-4 overflow-x-auto">
        {week.records.length ? (
          <div className="grid min-w-[30rem] gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              const recs = week.records.filter((r) => r.date === d).sort((a, b) => a.slot.localeCompare(b.slot));
              return (
                <div key={d} className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${d === week.today ? "bg-leaf-soft" : "bg-paper"}`}>
                  <p className="text-sm font-bold text-soft">{WEEKDAYS[lang][new Date(`${d}T00:00:00Z`).getUTCDay()]} {Number(d.slice(8))}</p>
                  {recs.length ? recs.map((r) => (
                    <span key={r.id} className="flex flex-col items-center">
                      <EmotionArt name={r.emotion} size={48} />
                      <span className="text-center text-xs leading-tight">{w(lang, r.word || r.emotion)}</span>
                    </span>
                  )) : <span className="py-4 text-line">·</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-soft">{tt("weekNone")}</p>
        )}
      </section>

      <section className="card grid items-center gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          {week.reflect && !editing ? (
            <>
              <p className="font-display text-2xl leading-snug">“{week.reflect.text}”</p>
              <div className="rounded-2xl bg-leaf-soft p-4">
                <p className="text-sm font-bold text-leaf">{tt("weekReply")}</p>
                <p className="mt-1 text-xl leading-relaxed">{week.reflect.reply}</p>
              </div>
              <button onClick={() => { setText(""); setEditing(true); }} className="btn-sub">✏️ {tt("weekPrompt")}</button>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl">{tt("weekPrompt")}</h2>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((k) => (
                  <button key={k} onClick={() => setText(tt(k))} className={`chip min-h-12 px-4 text-lg ${text === tt(k) ? "border-leaf bg-leaf-soft" : ""}`}>{tt(k)}</button>
                ))}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 80))} rows={2} className="field text-xl" placeholder="…" />
              {err && <p className="text-alert">{err}</p>}
              <button onClick={send} disabled={busy || text.trim().length < 2} className="btn-main w-full text-lg sm:w-auto sm:px-10">{busy ? tt("thinking") : tt("weekSend")}</button>
            </>
          )}
        </div>
        <BuddyLazy emotion={last} look={me.look} cheer={cheer} size={220} className="mx-auto size-40 md:size-[220px]" />
      </section>
    </StudentFrame>
  );
}
