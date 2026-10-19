"use client";
// 우리 반 마음 지도: 위험 표현 알림 · 오늘 칸 · 먼저 살펴볼 학생 · 기록 없음 · 마음 날씨
import { useState } from "react";
import { EmotionArt } from "../Art";
import BuddyFace from "../BuddyFace";
import Notes from "./Notes";
import Timeline from "./Timeline";
import Weather from "./Weather";
import type { NameOf, Overview, Reload } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { isHard } from "@/lib/shared";

export default function MapTab({ data, reload, nameOf, onCheer }: { data: Overview; reload: Reload; nameOf: NameOf; onCheer: (no: number) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const { students, records, today, flags, settings, absent } = data;
  const todays = records.filter((r) => r.date === today);
  const alerts = records.filter((r) => r.risk && !r.riskChecked).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const flagKey = (no: number) => `${no}_${data.weekStart}`;
  const openFlags = flags.filter((f) => !settings.checks[flagKey(f.no)]);

  async function checkAlert(id: string) {
    await api("teacher", "checkAlert", { id });
    await reload();
  }
  async function checkFlag(no: number) {
    await api("teacher", "checkFlag", { key: flagKey(no) });
    await reload();
  }

  if (!students.length) {
    return (
      <div className="card text-center">
        <p className="text-lg">아직 반 명단이 없어요.</p>
        <p className="mt-1 text-soft">「학생 코드·QR」에서 명단을 넣거나, 「설정」에서 시연 데이터를 만들어 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <section className="rounded-3xl border-2 border-alert bg-alert-soft p-5" role="alert">
          <h2 className="font-display text-xl text-alert">⚠️ 바로 살펴봐 주세요 · 위험 표현 {alerts.length}건</h2>
          <p className="mt-1 text-sm">
            학생 화면에는 아무 표시도 나가지 않았어요. 진단이 아닌 신호예요. 학교 위기관리 절차에 따라 Wee클래스·상담교사와 함께 살펴봐 주세요.
            (청소년상담 1388, 자살예방상담 109)
          </p>
          <ul className="mt-3 space-y-2">
            {alerts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3">
                <span className="flex items-start gap-2">
                  <EmotionArt name={r.emotion} size={34} className="shrink-0" />
                  <span>
                    <b>{r.no}번 {nameOf(r.no)}</b> · {label(r.date)} {r.slot === "am" ? "아침" : "하교 전"} · {r.emotion}
                    {(r.summary || r.answer) && <span className="block text-sm">“{[r.summary, r.answer].filter(Boolean).join(" / ")}”</span>}
                    <span className="block text-xs text-soft">{r.riskHits.length ? `걸린 말: ${r.riskHits.join(", ")}` : "AI가 위험 내용으로 판단"}</span>
                  </span>
                </span>
                <button onClick={() => checkAlert(r.id)} className="btn-sub min-h-10 text-sm">살펴봤어요</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="오늘 기록한 학생" value={`${new Set(todays.map((r) => r.no)).size}/${students.length}`} />
        <Tile label="아침 · 하교 전" value={`${todays.filter((r) => r.slot === "am").length} · ${todays.filter((r) => r.slot === "pm").length}`} />
        <Tile label="이번 주 먼저 살펴볼 학생" value={openFlags.length} warm />
        <Tile label={`${settings.rules.absentDays}일째 기록 없음`} value={absent.length} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">오늘의 마음 칸 · {label(today)}</h2>
            <button onClick={() => window.print()} className="no-print btn-sub min-h-9 px-3 text-sm">🖨️ 인쇄</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {students.map((s) => {
              const am = todays.find((r) => r.no === s.no && r.slot === "am");
              const pm = todays.find((r) => r.no === s.no && r.slot === "pm");
              const flagged = flags.some((f) => f.no === s.no);
              const alerted = alerts.some((r) => r.no === s.no);
              const gone = absent.includes(s.no);
              return (
                <button
                  key={s.no}
                  onClick={() => setOpen(s.no)}
                  className={`rounded-2xl border p-2.5 text-left text-sm hover:border-leaf ${alerted ? "border-alert bg-alert-soft" : flagged ? "border-sun bg-[#fff8e1]" : gone ? "border-dashed border-soft/50" : "border-line"}`}
                >
                  <span className="flex justify-between gap-1 text-soft">
                    <span className="flex min-w-0 items-center gap-1">
                      <BuddyFace look={data.looks[s.no]} emotion={(pm ?? am)?.emotion} size={22} className="shrink-0" />
                      <span className="truncate">{s.no} <b className="text-ink">{nameOf(s.no)}</b></span>
                    </span>
                    {(flagged || alerted) && <span aria-label="살펴보기 신호">{alerted ? "🔴" : "🟡"}</span>}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1">
                    {am ? <EmotionArt name={am.emotion} size={28} /> : <Empty />}
                    <span className="text-xs text-soft">→</span>
                    {pm ? <EmotionArt name={pm.emotion} size={28} /> : <Empty />}
                    {am && pm && !isHard(am.emotion) && isHard(pm.emotion) && <span className="text-xs font-bold text-alert">↓</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-soft">빈 동그라미: 아직 기록 전 · 🟡 먼저 살펴볼 신호 · 🔴 위험 표현 · ↓ 하교 전에 마음이 가라앉음 · 점선: 기록 없음이 이어짐</p>
        </section>

        <div className="space-y-5 self-start">
          <section className="card">
            <h2 className="font-display text-xl">이번 주 먼저 살펴볼 학생</h2>
            <p className="mb-3 text-xs text-soft">최근 7일 규칙에 걸린 학생이에요. 진단이 아니라 대화를 시작할 신호예요.</p>
            {flags.length === 0 && <p className="text-soft">이번 주는 신호가 없어요.</p>}
            <ul className="space-y-2">
              {flags.map((f) => {
                const checked = settings.checks[flagKey(f.no)];
                return (
                  <li key={f.no} className={`rounded-2xl border p-3 ${checked ? "border-line opacity-60" : "border-sun"}`}>
                    <button onClick={() => setOpen(f.no)} className="font-bold underline-offset-4 hover:underline">{f.no}번 {nameOf(f.no)}</button>
                    {f.reasons.map((r) => <p key={r} className="text-sm">· {r}</p>)}
                    <div className="mt-2 flex gap-2">
                      {checked ? (
                        <span className="text-xs text-soft">✓ 살펴봤어요</span>
                      ) : (
                        <button onClick={() => checkFlag(f.no)} className="btn-sub min-h-8 px-3 text-xs">살펴봤어요</button>
                      )}
                      <button onClick={() => onCheer(f.no)} className="btn-sub min-h-8 px-3 text-xs">응원 한마디</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {absent.length > 0 && (
            <section className="card">
              <h2 className="font-display text-xl">기록이 없는 학생</h2>
              <p className="mb-2 text-xs text-soft">반 기록이 있던 최근 {settings.rules.absentDays}일 동안 한 번도 남기지 않았어요. 결석·조퇴일 수도 있어요.</p>
              <div className="flex flex-wrap gap-2">
                {absent.map((no) => (
                  <button key={no} onClick={() => setOpen(no)} className="rounded-full border border-line px-3 py-1 text-sm">{no} {nameOf(no)}</button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <Weather records={records} today={today} />

      {open !== null && (
        <div className="no-print fixed inset-0 z-10 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(null)} onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
          <div className="card max-h-[88dvh] w-full max-w-2xl space-y-4 overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${open}번 기록`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <BuddyFace look={data.looks[open]} emotion={records.filter((r) => r.no === open).sort((a, b) => a.id.localeCompare(b.id)).at(-1)?.emotion} size={44} />
                {open}번 {nameOf(open)} · 최근 2주
              </h2>
              <button onClick={() => setOpen(null)} className="btn-sub min-h-9 px-3" aria-label="닫기" autoFocus>✕</button>
            </div>
            {flags.find((f) => f.no === open)?.reasons.map((r) => <p key={r} className="rounded-xl bg-[#fff8e1] px-3 py-1 text-sm">🟡 {r}</p>)}
            <Timeline records={records.filter((r) => r.no === open)} today={today} />
            <div className="border-t border-line pt-3">
              <h3 className="mb-2 font-bold">📝 면담 메모</h3>
              <Notes no={open} notes={data.notes} reload={reload} />
            </div>
            <button onClick={() => onCheer(open)} className="btn-main w-full">💌 응원 한마디 쓰기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <span className="inline-block size-7 rounded-full border-2 border-dashed border-line" aria-label="기록 전" />;
}

function Tile({ label, value, warm }: { label: string; value: number | string; warm?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl ${warm ? "text-[#c98a00]" : ""}`}>{value}</p>
    </div>
  );
}
