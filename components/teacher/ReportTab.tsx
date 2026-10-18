"use client";
// 주간 리포트: A4 한 장으로 인쇄(브라우저 인쇄 → PDF 저장도 됨). 기본은 학생을 번호로만 표시.
import { useState } from "react";
import { Bars, Legend } from "./Weather";
import type { NameOf, Overview } from "./types";
import { addDays, label, weekday } from "@/lib/date";
import { GROUPS, groupOf, type Group } from "@/lib/shared";

export default function ReportTab({ data, nameOf }: { data: Overview; nameOf: NameOf }) {
  const [onlyNo, setOnlyNo] = useState(true);
  const { today, weekStart, students, flags, settings, absent } = data;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week = data.records.filter((r) => r.date >= weekStart && r.date <= today);
  const who = (no: number) => (onlyNo ? `${no}번` : `${no}번 ${nameOf(no)}`);
  const risks = week.filter((r) => r.risk);
  const cheers = data.cheers.filter((c) => c.createdAt.slice(0, 10) >= weekStart);
  const groups = Object.keys(GROUPS) as Group[];
  const total = students.length || 1;
  const rates = days.map((d) => new Set(week.filter((r) => r.date === d).map((r) => r.no)).size);
  const recDays = rates.filter((n) => n > 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyNo} onChange={(e) => setOnlyNo(e.target.checked)} className="size-4 accent-leaf" />
          학생은 번호로만 표시(밖으로 내보낼 때 권장)
        </label>
        <button onClick={() => window.print()} className="btn-main">🖨️ A4로 인쇄·PDF 저장</button>
      </div>

      <article className="card mx-auto max-w-[210mm] space-y-5 bg-white p-8 print:border-0 print:p-0">
        <header className="flex items-end justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="text-sm text-soft">{settings.className}</p>
            <h2 className="font-display text-3xl">주간 마음 리포트</h2>
          </div>
          <p className="text-right text-sm text-soft">{label(weekStart)} ~ {label(today)}<br />만든 날 {label(today)}</p>
        </header>

        <section className="grid grid-cols-4 gap-3 text-center">
          <Stat label="평균 기록률" value={`${recDays.length ? Math.round((recDays.reduce((a, b) => a + b, 0) / recDays.length / total) * 100) : 0}%`} />
          <Stat label="먼저 살펴볼 학생" value={`${flags.length}명`} />
          <Stat label="위험 표현" value={`${risks.length}건`} />
          <Stat label="건넨 응원 한마디" value={`${cheers.length}개`} />
        </section>

        <section>
          <h3 className="mb-2 font-bold">날마다 기록한 학생</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {days.map((d, i) => (
              <div key={d} className="rounded-lg bg-paper py-1.5">
                <p className="text-xs text-soft">{weekday(d)} {Number(d.slice(8))}</p>
                <p className="font-bold">{rates[i]}/{students.length}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-bold">이번 주 마음 날씨</h3>
          <Bars records={week} days={days} today={today} />
          <Legend />
          <p className="mt-2 text-sm">
            {groups.map((g) => `${GROUPS[g].label} ${week.filter((r) => groupOf(r.emotion) === g).length}건`).join(" · ")}
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-bold">먼저 살펴볼 학생 (진단이 아닌 살펴보기 신호)</h3>
          {flags.length ? (
            <table className="w-full text-sm">
              <tbody>
                {flags.map((f) => (
                  <tr key={f.no} className="border-t border-line align-top">
                    <td className="w-28 py-1.5 font-bold">{who(f.no)}</td>
                    <td className="py-1.5">{f.reasons.join(" / ")}</td>
                    <td className="w-24 py-1.5 text-right text-soft">{settings.checks[`${f.no}_${weekStart}`] ? "✓ 살펴봄" : "아직"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-soft">이번 주는 신호가 없어요.</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="mb-1 font-bold">위험 표현</h3>
            {risks.length ? (
              <p>{risks.map((r) => `${who(r.no)}(${label(r.date)}${r.riskChecked ? ", 살펴봄" : ", 아직"})`).join(", ")}</p>
            ) : (
              <p className="text-soft">없어요.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-bold">{settings.rules.absentDays}일째 기록 없음</h3>
            <p className={absent.length ? "" : "text-soft"}>{absent.length ? absent.map(who).join(", ") : "없어요."}</p>
          </div>
        </section>

        <footer className="border-t border-line pt-2 text-xs text-soft">
          이 리포트는 학생이 스스로 남긴 마음 기록을 모은 것이며 진단 자료가 아닙니다. 교사만 열람하고, 필요한 경우 학교 절차에 따라 상담과 연계합니다.
        </footer>
      </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-2">
      <p className="text-xs text-soft">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}
