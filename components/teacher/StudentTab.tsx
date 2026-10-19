"use client";
// 학생별 누적 기록: 한 학생의 처음부터 지금까지 — 마음 기록 수·감정 흐름(전체·달마다)·써 본 감정 단어·까닭·마음 다스리기,
// 활동지 피드백(사회정서 4대 역량), 한 주 돌아보기, 공감 쪽지, 응원·면담 메모, 날마다 기록. 상담·학부모 면담 전에 한 장으로 본다.
import { useEffect, useState } from "react";
import BuddyFace from "../BuddyFace";
import { StudentStrip } from "./StudentPick";
import Timeline from "./Timeline";
import type { NameOf, Overview } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { CALM_KO, GROUPS, SEL_AREAS, groupOf, type Cheer, type Group, type Letter, type MoodRecord, type Reflect, type SheetItem } from "@/lib/shared";

interface All {
  records: MoodRecord[]; cheers: Cheer[]; notes: Cheer[]; sent: Letter[]; got: Letter[]; reflects: Reflect[];
  sheets: (SheetItem & { runId: string; date: string })[];
}

const GROUP_IDS = Object.keys(GROUPS) as Group[];
// 그래프 막대 색: 기쁨 노랑만 한 단계 진하게(밝은 바탕에서 보이고 색약 검사를 통과하는 값). 막대에는 늘 이름·숫자 글자를 함께 둔다.
const BAR: Record<Group, string> = { joy: "#D9A300", calm: GROUPS.calm.color, sad: GROUPS.sad.color, angry: GROUPS.angry.color, fear: GROUPS.fear.color };
const count = <T,>(xs: T[], key: (x: T) => string | undefined) =>
  Object.entries(xs.reduce<Record<string, number>>((m, x) => { const k = key(x); return k ? { ...m, [k]: (m[k] ?? 0) + 1 } : m; }, {})).sort((a, b) => b[1] - a[1]);

function Tile({ big, label: name, sub }: { big: string | number; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="text-xs text-soft">{name}</p>
      <p className="font-display text-3xl">{big}</p>
      {sub && <p className="text-xs text-soft">{sub}</p>}
    </div>
  );
}

export default function StudentTab({ data, nameOf, no, setNo }: { data: Overview; nameOf: NameOf; no: number | null; setNo: (n: number) => void }) {
  const [all, setAll] = useState<All | null>(null);
  const [err, setErr] = useState("");
  const s = data.students.find((x) => x.no === no);

  useEffect(() => {
    if (no == null) return;
    let live = true;
    api<All>("teacher", "studentAll", { no }).then((r) => live && setAll(r), (e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [no]);

  const pick = (n: number) => { setAll(null); setErr(""); setNo(n); };
  return (
    <div className="space-y-4">
      <StudentStrip data={data} no={no} nameOf={nameOf} onPick={pick} />
      {!s ? (
        <div className="card text-soft">위에서 학생을 골라 주세요. 처음부터 지금까지 남긴 기록과 활동지 피드백을 한곳에 모아 보여 줘요.</div>
      ) : err ? (
        <div className="card text-alert">{err}</div>
      ) : !all ? (
        <div className="card text-soft">불러오는 중…</div>
      ) : (
        <Report all={all} data={data} no={s.no} nameOf={nameOf} />
      )}
    </div>
  );
}

function Report({ all, data, no, nameOf }: { all: All; data: Overview; no: number; nameOf: NameOf }) {
  const rs = all.records;
  const first = rs[0]?.date, last = rs.at(-1)?.date;
  const days = new Set(rs.map((r) => r.date)).size;
  const groups = GROUP_IDS.map((g) => [g, rs.filter((r) => groupOf(r.emotion) === g).length] as const);
  const maxG = Math.max(1, ...groups.map(([, n]) => n));
  const months = [...new Set(rs.map((r) => r.date.slice(0, 7)))];
  const words = count(rs, (r) => r.word);
  const reasons = count(rs, (r) => r.reason);
  const calm = rs.flatMap((r) => r.calm ?? []);
  const tools = count(calm, (c) => CALM_KO[c.tool]);
  const areas = SEL_AREAS.map((a) => [a, all.sheets.flatMap((x) => x.strengths).filter((p) => p.area === a).length, all.sheets.flatMap((x) => x.grow).filter((p) => p.area === a).length] as const);
  const maxA = Math.max(1, ...areas.map(([, n]) => n));
  const span = first ? Math.round((Date.parse(data.today) - Date.parse(first)) / 864e5) + 1 : 0;

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-center gap-4">
        <BuddyFace look={data.looks[no]} emotion={rs.at(-1)?.emotion} size={56} />
        <div className="min-w-[12rem] flex-1">
          <h2 className="font-display text-2xl">{no}번 {nameOf(no)} · 누적 기록</h2>
          <p className="text-sm text-soft">{first ? `${label(first)} ~ ${label(last!)} · ${days}일 기록` : "아직 마음 기록이 없어요."}</p>
        </div>
        <button onClick={() => window.print()} className="no-print btn-sub">🖨️ 인쇄·PDF 저장</button>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="모아 보기">
        <Tile big={rs.length} label="마음 기록" sub={`아침 ${rs.filter((r) => r.slot === "am").length} · 하교 전 ${rs.filter((r) => r.slot === "pm").length}`} />
        <Tile big={words.length} label="써 본 감정 단어" sub={words[0] ? `가장 많이: ${words[0][0]}` : undefined} />
        <Tile big={calm.length} label="마음 다스리기" sub={`나아졌어요 ${calm.filter((c) => c.felt === "better").length}번`} />
        <Tile big={`${all.sent.length}·${all.got.length}`} label="공감 쪽지 보냄·받음" />
        <Tile big={all.reflects.length} label="한 주 돌아보기" />
        <Tile big={all.sheets.length} label="활동지 피드백" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-3">
          <h3 className="font-display text-xl">감정 흐름</h3>
          {!rs.length ? <p className="text-soft">기록이 없어요.</p> : (
            <>
              <ul className="space-y-1.5" aria-label="전체 감정 묶음">
                {groups.map(([g, n]) => (
                  <li key={g} className="grid grid-cols-[3rem_1fr_5rem] items-center gap-2 text-sm">
                    <span className="font-bold">{GROUPS[g].label}</span>
                    <span className="h-4 rounded-r bg-paper">
                      {n > 0 && <span className="block h-full rounded-r" style={{ width: `${(n / maxG) * 100}%`, background: BAR[g] }} title={`${GROUPS[g].label} ${n}번`} />}
                    </span>
                    <span className="text-right tabular-nums">{n}번 · {Math.round((n / rs.length) * 100)}%</span>
                  </li>
                ))}
              </ul>
              {months.length > 1 && (
                <div className="space-y-1.5 border-t border-line pt-3">
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-soft">
                    달마다 ·{GROUP_IDS.map((g) => <span key={g} className="inline-flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm" style={{ background: BAR[g] }} />{GROUPS[g].label}</span>)}
                  </p>
                  {months.map((m) => {
                    const mr = rs.filter((r) => r.date.startsWith(m));
                    return (
                      <div key={m} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 text-sm">
                        <span className="font-bold">{Number(m.slice(5))}월</span>
                        <span className="flex h-4 gap-[2px]">
                          {GROUP_IDS.map((g) => {
                            const n = mr.filter((r) => groupOf(r.emotion) === g).length;
                            return n > 0 && <span key={g} className="h-full first:rounded-l last:rounded-r" style={{ flex: n, background: BAR[g] }} title={`${Number(m.slice(5))}월 ${GROUPS[g].label} ${n}번`} />;
                          })}
                        </span>
                        <span className="text-right tabular-nums">{mr.length}번</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <section className="card space-y-3">
          <h3 className="font-display text-xl">자주 쓴 말</h3>
          {([["감정 단어", words], ["까닭", reasons], ["마음 다스리기 도구", tools]] as const).map(([name, list]) => (
            <div key={name}>
              <p className="text-sm font-bold">{name}</p>
              {list.length ? (
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {list.slice(0, 12).map(([w, n]) => <span key={w} className="rounded-full bg-paper px-2.5 py-1 text-sm">{w} <b className="tabular-nums">{n}</b></span>)}
                </p>
              ) : <p className="text-sm text-soft">아직 없어요.</p>}
            </div>
          ))}
        </section>
      </div>

      <section className="card space-y-3">
        <h3 className="font-display text-xl">🖍️ 활동지 피드백 <span className="text-base text-soft">· 사회정서교육 4대 핵심역량</span></h3>
        {!all.sheets.length ? <p className="text-soft">아직 이 학생의 활동지 피드백이 없어요. 「활동지 피드백」에서 스캔한 활동지를 올려 보세요.</p> : (
          <>
            <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2" aria-label="역량별로 잘 드러난 점">
              {areas.map(([a, n, g]) => (
                <li key={a} className="text-sm">
                  <span className="flex flex-wrap justify-between gap-x-2">
                    <b>{a}</b>
                    <span className="tabular-nums">잘 드러남 {n} · 키울 점 {g}</span>
                  </span>
                  <span className="mt-1 block h-3 rounded-r bg-paper">
                    {n > 0 && <span className="block h-full rounded-r bg-leaf" style={{ width: `${(n / maxA) * 100}%` }} title={`${a} 잘 드러남 ${n}번`} />}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-line">
              {all.sheets.map((x) => (
                <li key={`${x.runId}-${x.no}`} className="space-y-1 py-3 text-sm">
                  <p><b>{label(x.date)} · {x.topic}</b></p>
                  <p className="flex flex-wrap gap-1">
                    {x.strengths.map((p, i) => <span key={i} className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-bold text-leaf">👍 {p.area}</span>)}
                    {x.grow.map((p, i) => <span key={i} className="rounded-full bg-paper px-2 py-0.5 text-xs">🌱 {p.area}</span>)}
                  </p>
                  <p>💬 {x.toStudent}</p>
                  {x.check && <p className="font-bold text-alert">🚨 {x.check}</p>}
                  <details className="text-soft">
                    <summary className="cursor-pointer">읽은 내용·이렇게 쓴 이유</summary>
                    <p className="mt-1">📖 {x.read}</p>
                    <p className="mt-1">🧭 {x.why}</p>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-2">
          <h3 className="font-display text-xl">한 주 돌아보기</h3>
          {!all.reflects.length ? <p className="text-sm text-soft">아직 없어요.</p> : all.reflects.map((r) => (
            <div key={r.id} className="border-t border-line pt-2 text-sm first:border-0 first:pt-0">
              <p className="text-xs text-soft">{label(r.weekStart)} 주</p>
              <p>“{r.text}”</p>
              {r.reply && <p className="text-soft">↳ 마음 친구: {r.reply}</p>}
            </div>
          ))}
        </section>
        <section className="card space-y-2">
          <h3 className="font-display text-xl">공감 쪽지</h3>
          {!all.sent.length && !all.got.length ? <p className="text-sm text-soft">아직 없어요.</p> : (
            [...all.sent.map((l) => ({ l, out: true })), ...all.got.map((l) => ({ l, out: false }))]
              .sort((a, b) => b.l.createdAt.localeCompare(a.l.createdAt)).slice(0, 10).map(({ l, out }) => (
                <p key={l.id + out} className="border-t border-line pt-2 text-sm first:border-0 first:pt-0">
                  <span className="text-xs text-soft">{l.createdAt.slice(0, 10)} · {out ? `→ ${l.to}번 ${nameOf(l.to)}에게` : `← ${l.from}번 ${nameOf(l.from)}에게서`} · {{ wait: "확인 전", ok: "전함", no: "보내지 않음" }[l.status]}</span>
                  <br />{l.text}
                </p>
              ))
          )}
        </section>
        <section className="card space-y-2">
          <h3 className="font-display text-xl">💌 전한 응원</h3>
          {!all.cheers.length ? <p className="text-sm text-soft">아직 없어요.</p> : all.cheers.map((c) => (
            <p key={c.id} className="border-t border-line pt-2 text-sm first:border-0 first:pt-0"><span className="text-xs text-soft">{c.createdAt.slice(0, 10)}</span><br />{c.text}</p>
          ))}
        </section>
        <section className="card space-y-2">
          <h3 className="font-display text-xl">📝 면담 메모 <span className="text-sm text-soft">(선생님만)</span></h3>
          {!all.notes.length ? <p className="text-sm text-soft">아직 없어요.</p> : all.notes.map((c) => (
            <p key={c.id} className="border-t border-line pt-2 text-sm first:border-0 first:pt-0"><span className="text-xs text-soft">{c.createdAt.slice(0, 10)}</span><br />{c.text}</p>
          ))}
        </section>
      </div>

      {rs.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-display text-xl">날마다 기록 전체 ({days}일)</summary>
          <div className="mt-3"><Timeline records={rs} today={data.today} days={span} /></div>
        </details>
      )}
    </div>
  );
}
