"use client";
// 학급 역량 진단: 회차(학기 초·학기 말 등)를 열면 학생 화면 「더 해 보기」 맨 앞에 「마음 점검」이 생기고, 닫으면 사라진다.
// 학생은 32문장(자기인식·관리 · 소통·협력 · 책임 · 마음돌봄 × 8)에 5단계로 답한다. 학생 화면에는 점수 없이 영역별 이야기와 해 볼 일만 보인다.
// 선생님은 영역별 점수(8~40)·수준을 반 전체와 학생마다 보고, 견줄 회차와 나란히 보며, 학생을 골라 관찰(간이 16 · 심층 32)·지도 가이드·
// 선생님만 보는 메모·학생에게 보낼 말(AI 초안)을 남긴다(SelStudent).
import { useEffect, useRef, useState } from "react";
import Doodle from "../Doodle";
import SelStudent, { Delta, type SelRow } from "./SelStudent";
import type { NameOf, Overview } from "./types";
import { api } from "@/lib/api";
import { label, today as todayOf } from "@/lib/date";
import { ownBy, type Student } from "@/lib/shared";
import { DOMAINS, LEVELS, levelOf, obsMax, obsScores, pctOf, scoresOf, selWatch, unread, type SelNote, type SelfAnswer, type SelfRound } from "@/lib/selfcheck";
import { SEL_CAUTION, SEL_SOURCE } from "@/lib/selguide";

export type SelData = { rounds: SelfRound[]; answers: SelfAnswer[]; notes: SelNote[] };
const TITLES = ["학기 초", "학기 말"];
const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// 같은 학생 것만(그사이 이 번호를 새 학생에게 줬으면 앞 학생 답·관찰은 빼고)
function rowsOf(d: SelData, students: Student[], round: string | null, base: string | null): SelRow[] {
  const pick = <T extends { round: string; no: number; at: string }>(xs: T[], r: string | null, st: Student) => xs.find((x) => x.round === r && x.no === st.no && ownBy(st, x.at)) ?? null;
  return students.map((st) => {
    const answer = pick(d.answers, round, st), note = pick(d.notes, round, st);
    const scores = scoresOf(answer, note);
    const before = base ? scoresOf(pick(d.answers, base, st), pick(d.notes, base, st)) : null;
    return { st, answer, note, scores, before, watch: scores ? selWatch(scores, before, note?.obs) : [] };
  });
}

// version: 선생님 화면이 다시 불러오거나 새 기록을 합칠 때마다 바뀐다 → 학생이 새로 답한 것도 보이게 다시 불러온다
export default function SelCheckTab({ data, nameOf, version }: { data: Overview; nameOf: NameOf; version: number }) {
  const [d, setD] = useState<SelData | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<string | null>(null); // 보고 있는 회차
  const [base, setBase] = useState<string | null>(null); // 견줄 회차
  const [title, setTitle] = useState(TITLES[0]);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<string | null>(null); // 지우기 한 번 더 묻기
  const [hide, setHide] = useState(false);
  const [pick, setPick] = useState<number | null>(null); // 자세히 보는 학생 번호
  const first = useRef(true); // 처음 불러올 때만 볼 회차·견줄 회차를 골라 준다
  const detail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api<SelData>("teacher", "selfChecks").then((r) => {
      if (!live) return;
      setD(r);
      const has = (id: string | null) => !!id && r.rounds.some((x) => x.id === id);
      if (first.current) {
        first.current = false;
        const withAns = r.rounds.filter((x) => r.answers.some((a) => a.round === x.id));
        const last = r.rounds.find((x) => !x.closedAt) ?? withAns.at(-1) ?? r.rounds.at(-1);
        setView(last?.id ?? null);
        setBase(withAns.filter((x) => x.id !== last?.id && x.openedAt <= (last?.openedAt ?? "")).at(-1)?.id ?? null);
        if (r.rounds.some((x) => x.title === TITLES[0])) setTitle(TITLES[1]); // 학기 초가 있으면 다음은 학기 말
      } else {
        // 다시 불러올 때는 고른 회차를 그대로 두고, 다른 기기에서 지운 회차만 정리한다
        setView((v) => (has(v) ? v : r.rounds.at(-1)?.id ?? null));
        setBase((b) => (has(b) ? b : null));
      }
    }, (e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [version]);

  async function act(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<SelData>("teacher", action, body);
      setD(r);
      if (action === "selfOpen") { setView(r.rounds.at(-1)?.id ?? null); setPick(null); }
      if (action === "selfDelete") { setView(r.rounds.at(-1)?.id ?? null); setBase(null); setPick(null); }
    } catch (e) {
      setErr((e as Error).message);
    }
    setSure(null);
    setBusy(false);
  }

  if (!d) return <div className="card text-soft">{err || "불러오는 중…"}</div>;
  const open = d.rounds.find((r) => !r.closedAt);
  const round = d.rounds.find((r) => r.id === view) ?? null;
  const baseId = base === view ? null : base; // 보는 회차를 자기 자신과 견주지 않게
  const baseRound = d.rounds.find((r) => r.id === baseId) ?? null;
  const rows = rowsOf(d, data.students, view, baseId);
  const done = rows.filter((r) => r.scores);
  const who = (no: number, at?: string) => (hide ? `${no}번` : `${no} ${nameOf(no, at)}`);
  const sel = rows.find((r) => r.st.no === pick) ?? null;
  const choose = (no: number | null) => {
    setPick(no);
    if (no != null) requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const onSaved = (note: SelNote) => setD((cur) => cur && { ...cur, notes: [...cur.notes.filter((n) => !(n.round === note.round && n.no === note.no)), note] });
  const answeredIn = (id: string) => rowsOf(d, data.students, id, null).filter((r) => r.scores).length;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="text-sm text-soft">
          학생이 스스로 32문장(영역마다 8문장)에 5단계로 답해요. 영역별 점수와 수준은 선생님만 보고, 학생 화면에는 점수 없이 영역별 이야기와 해 볼 일만 보여요.
          학생을 골라 관찰을 더하고, 지도 가이드를 보며 학생에게 보낼 말을 남겨 주세요.
        </p>
        {open ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-soft p-4">
            <div>
              <p className="font-bold"><Doodle name="clipboard" /> 학생 화면에 열려 있어요 · 「{open.title}」 ({label(open.openedAt)}부터)</p>
              {open.id === view && (
                <p className="text-sm">
                  답한 학생 {done.length}/{data.students.length}
                  {data.students.length > done.length && <span className="text-soft"> · 아직: {rows.filter((r) => !r.scores).map((r) => r.st.no).join(", ")}번</span>}
                </p>
              )}
            </div>
            <button onClick={() => act("selfClose", { id: open.id })} disabled={busy} className="btn-sub">회차 닫기</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-line p-4">
            <label className="text-sm">
              <span className="block text-soft">새 회차 이름</span>
              <input list="self-titles" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 20))} className="field mt-1 min-h-11 w-44 py-2" />
              <datalist id="self-titles">{TITLES.map((x) => <option key={x} value={x} />)}</datalist>
            </label>
            <button onClick={() => act("selfOpen", { title })} disabled={busy || !title.trim()} className="btn-main">학생 화면에 열기</button>
            <p className="w-full text-xs text-soft">열면 학생 화면 「더 해 보기」 맨 앞에 「마음 점검」이 생겨요. 다 모이면 닫아 주세요. 닫은 뒤에도 보낸 말은 학생이 읽을 때까지 보여요.</p>
          </div>
        )}
        {err && <p role="alert" className="text-alert">{err}</p>}
        <p className="text-xs text-soft">{SEL_SOURCE} {SEL_CAUTION}</p>
      </section>

      {d.rounds.length > 0 && (
        <section className="no-print flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-soft">볼 회차</span>
            <select value={view ?? ""} onChange={(e) => { setView(e.target.value); setPick(null); if (e.target.value === base) setBase(null); }} className="field mt-1 min-h-11 py-2">
              {d.rounds.map((r) => <option key={r.id} value={r.id}>{r.title} · {label(r.openedAt)} ({answeredIn(r.id)}명)</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-soft">견줄 회차</span>
            <select value={baseId ?? ""} onChange={(e) => setBase(e.target.value || null)} className="field mt-1 min-h-11 py-2">
              <option value="">견주지 않기</option>
              {d.rounds.filter((r) => r.id !== view).map((r) => <option key={r.id} value={r.id}>{r.title} · {label(r.openedAt)}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-5 accent-leaf" /> 학생은 번호로만</label>
          <div className="ml-auto flex flex-wrap gap-2">
            {round?.closedAt && !open && <button onClick={() => act("selfReopen", { id: round.id })} disabled={busy} className="btn-sub min-h-11 text-sm">다시 열기</button>}
            {round && (sure === round.id
              ? <button onClick={() => act("selfDelete", { id: round.id })} disabled={busy} className="btn-sub min-h-11 border-alert text-sm text-alert">정말 지우기(답·관찰·메모·보낸 말 모두)</button>
              : <button onClick={() => setSure(round.id)} className="btn-sub min-h-11 text-sm">회차 지우기</button>)}
            {round && done.length > 0 && <button onClick={() => downloadCsv(round, rows)} className="btn-sub min-h-11 text-sm"><Doodle name="download" /> CSV</button>}
            <button onClick={() => window.print()} className="btn-sub min-h-11 text-sm"><Doodle name="printer" /> 인쇄</button>
          </div>
        </section>
      )}

      {!round ? (
        <div className="card text-soft">아직 회차가 없어요. 위에서 「학기 초」 회차를 열어 보세요.</div>
      ) : (
        <>
          {done.length > 0 ? <ClassSummary round={round} base={baseRound} rows={rows} /> : <div className="card text-soft">「{round.title}」에 아직 답한 학생이 없어요. 학생을 골라 종이 검사 점수나 관찰을 먼저 넣을 수도 있어요.</div>}
          <StudentTable rows={rows} base={baseRound} who={who} pick={pick} onPick={choose} />
          <div ref={detail} className="scroll-mt-4">
            {sel && round && (
              <SelStudent key={`${round.id}_${sel.st.no}`} round={round} base={baseRound} row={sel} who={who(sel.st.no, sel.answer?.at)} onSaved={onSaved}
                onClose={() => setPick(null)}
                onMove={(dir) => { const i = rows.indexOf(sel); const next = rows[i + dir]; if (next) choose(next.st.no); }}
                first={rows[0] === sel} last={rows.at(-1) === sel} aiLabel={data.trial ? "체험용 AI" : "AI"} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 반 전체: 영역마다 평균 점수(40점 만점) 막대 · 견줄 회차 평균(세로선) · 수준별 학생 수 · 선생님 관찰 평균
function ClassSummary({ round, base, rows }: { round: SelfRound; base: SelfRound | null; rows: SelRow[] }) {
  const done = rows.filter((r) => r.scores);
  const obsRows = done.filter((r) => r.note?.obs);
  return (
    <section className="card space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">「{round.title}」 반 전체 · {done.length}/{rows.length}명</h2>
        <p className="text-sm text-soft">{base ? `견줌: 「${base.title}」 ${rows.filter((r) => r.before).length}명` : "견줄 회차 없음"}{obsRows.length ? ` · 선생님 관찰 ${obsRows.length}명` : ""}</p>
      </header>
      <div className="space-y-4">
        {DOMAINS.map((dom, i) => {
          const a = avg(done.map((r) => r.scores![i]))!;
          const b = avg(rows.flatMap((r) => (r.before ? [r.before[i]] : [])));
          const oa = avg(obsRows.map((r) => pctOf(obsScores(r.note!.obs!)[i], obsMax(r.note!.obs!))));
          const o = oa == null ? null : Math.round(oa);
          const counts = LEVELS.map((l) => done.filter((r) => levelOf(r.scores![i]) === l).length);
          return (
            <div key={dom.key} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr_11rem]">
              <p className="flex items-center gap-1.5 font-bold" style={{ color: dom.color }}><Doodle name={dom.icon} size={22} /> {dom.name}</p>
              <div className="space-y-1.5">
                <div className="relative h-5 rounded-full bg-[#f1eee7]" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctOf(a)}%`, background: dom.color }} />
                  {b != null && <span className="absolute -inset-y-1 w-0.5 rounded bg-ink/80" style={{ left: `${pctOf(b)}%` }} title={`견준 회차 평균 ${f1(b)}`} />}
                  {o != null && <span className="absolute -bottom-1.5 size-2.5 -translate-x-1/2 rotate-45 border border-white bg-ink" style={{ left: `${o}%` }} title={`선생님 관찰 평균 ${o}%`} />}
                </div>
                <div className="flex h-3 overflow-hidden rounded-full" aria-label={LEVELS.map((l, k) => `${l.name} ${counts[k]}명`).join(", ")}>
                  {counts.map((n, k) => n > 0 && <span key={k} style={{ flex: n, background: LEVELS[k].color }} title={`${LEVELS[k].name} ${n}명`} />)}
                </div>
                <p className="text-xs text-soft">{LEVELS.map((l, k) => `${l.name} ${counts[k]}`).join(" · ")}</p>
              </div>
              <p className="text-sm tabular-nums">
                <b>{f1(a)}</b><span className="text-soft"> / 40</span>
                {b != null && <Delta v={a - b} />}
                <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: levelOf(a).color, background: levelOf(a).bg }}>{levelOf(a).name}</span>
                {o != null && <span className="block text-xs text-soft">선생님 관찰 평균 {o}%</span>}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-soft">
        막대는 학생 스스로 답한 반 평균(영역마다 8~40점)이에요.{base && " 검은 세로선은 견준 회차 평균,"}{obsRows.length > 0 && " ◆는 선생님 관찰 평균을 같은 눈금(만점 대비 %)으로 옮긴 자리,"}
        {" "}아래 띠는 수준별 학생 수예요(만점의 85% 이상 아주 잘함 · 65% 이상 잘함 · 45% 이상 자라나는 중 · 그 아래 도움 필요).
      </p>
    </section>
  );
}

function Chip({ score, max = 40, small }: { score: number; max?: number; small?: boolean }) {
  const l = levelOf(score, max);
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-bold ${small ? "text-[11px]" : "text-xs"}`} style={{ color: l.color, background: l.bg }}>{l.name}</span>;
}

// 학생별: 영역마다 수준·점수(견줄 회차와의 차이), 관찰, 학생에게 보낸 말. 줄을 누르면 아래에 자세히(SelStudent)
function StudentTable({ rows, base, who, pick, onPick }: { rows: SelRow[]; base: SelfRound | null; who: (no: number, at?: string) => string; pick: number | null; onPick: (no: number | null) => void }) {
  const watch = rows.filter((r) => r.watch.length);
  return (
    <section className="card space-y-3">
      <h3 className="font-display text-xl">학생별 결과 <span className="text-sm text-soft">(선생님만 · 이름을 누르면 관찰·지도 가이드·보낼 말)</span></h3>
      {watch.length > 0 && (
        <div className="space-y-1 rounded-2xl bg-[#fff8e1] p-3 text-sm">
          <p className="font-bold"><Doodle name="dotYellow" /> 먼저 이야기 나눠 볼 학생 (진단이 아닌 살펴보기 신호)</p>
          {watch.map((r) => (
            <p key={r.st.no}>· <button onClick={() => onPick(r.st.no)} className="font-bold underline decoration-dotted underline-offset-4">{who(r.st.no, r.answer?.at)}</button>: {r.watch.join(" / ")}</p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-xs text-soft">
              <th className="py-1.5 pr-2 font-normal">학생</th>
              {DOMAINS.map((x) => <th key={x.key} className="px-1 font-normal" style={{ color: x.color }}>{x.name}</th>)}
              <th className="px-1 font-normal">관찰</th>
              <th className="px-1 font-normal">보낸 말</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.st.no} className={`border-b border-line/60 ${pick === r.st.no ? "bg-leaf-soft" : r.watch.length ? "bg-[#fff8e1]" : ""}`}>
                <td className="whitespace-nowrap py-1 pr-2">
                  <button onClick={() => onPick(pick === r.st.no ? null : r.st.no)} aria-expanded={pick === r.st.no} className="min-h-10 text-left font-bold hover:text-leaf">
                    {who(r.st.no, r.answer?.at)}
                    {r.note?.memo?.trim() && <span className="ml-1" title="선생님 메모 있음"><Doodle name="memo" size={18} /></span>}
                  </button>
                  {!r.answer && r.scores && <span className="ml-1 text-xs text-soft">종이</span>}
                </td>
                {r.scores ? r.scores.map((v, i) => (
                  <td key={i} className="px-1">
                    <Chip score={v} /> <span className="text-xs">{v}</span>
                    {r.before && <Delta v={v - r.before[i]} small />}
                  </td>
                )) : <td colSpan={DOMAINS.length} className="px-1 text-xs text-soft">아직 안 했어요</td>}
                <td className="px-1 text-xs">{r.note?.obs ? (r.note.obs.mode === 32 ? "심층" : "간이") : <span className="text-soft">–</span>}</td>
                <td className="px-1 text-xs">{!r.note?.feedback ? <span className="text-soft">–</span> : unread(r.note) ? "보냄 · 안 읽음" : <b className="text-[#1d7144]">읽었어요</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-soft">{base && `작은 ▲▼는 「${base.title}」보다 오르내린 점수예요. `}학생이 스스로 고른 답이라 그날 기분에 따라 달라질 수 있어요. 점수로 견주지 말고 대화를 시작하는 데 써 주세요.</p>
    </section>
  );
}

// 회차 결과 CSV(가명 기준, 선생님 메모는 넣지 않음)
function downloadCsv(round: SelfRound, rows: SelRow[]) {
  const head = ["번호", "가명", "방식", ...DOMAINS.flatMap((x) => [`${x.name} 점수`, `${x.name} 수준`]), "관찰", ...DOMAINS.map((x) => `${x.name} 관찰`), "보낸 말", "학생이 읽음"];
  const body = rows.filter((r) => r.scores || r.note?.obs).map((r): (string | number)[] => {
    const o = r.note?.obs ? obsScores(r.note.obs) : null;
    return [
      r.st.no, r.st.alias, r.answer ? "화면" : r.scores ? "종이" : "",
      ...DOMAINS.flatMap((_, i): (string | number)[] => (r.scores ? [r.scores[i], levelOf(r.scores[i]).name] : ["", ""])),
      r.note?.obs ? `${r.note.obs.mode === 32 ? "심층" : "간이"}(영역 만점 ${obsMax(r.note.obs)})` : "",
      ...DOMAINS.map((_, i) => (o ? o[i] : "")),
      r.note?.feedback?.text ?? "", r.note?.feedback ? (unread(r.note) ? "아니요" : "예") : "",
    ];
  });
  // 엑셀·구글 시트가 = + - @ 탭·줄바꿈으로 시작하는 칸을 수식으로 읽지 않게 앞에 '를 붙인다(설정의 기록 내보내기와 같게)
  const cell = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + [head, ...body].map((row) => row.map(cell).join(",")).join("\r\n"); // 엑셀 한글이 깨지지 않게 BOM
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `마음빛-역량진단-${round.title}-${todayOf()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
