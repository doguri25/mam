"use client";
// 학급 사회·정서역량 진단: 선생님이 우리 반 전체를 떠올리며 20문항(5개 역량 × 4)에 5점으로 답한다.
// 체크하기 → 결과(평균·역량별 수준·레이더·강점/보완·요약 복사·메모) → 누적 기록(회차별 변화 꺾은선·처음과 최근 겹쳐 보기).
// 학급 저장 공간에 쌓여 어느 기기에서든 같은 기록을 본다. 학생 이름·번호는 담지 않는다.
import { useEffect, useMemo, useState } from "react";
import Doodle, { DoodleText } from "../Doodle";
import type { Overview } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { useLocal } from "@/lib/local";
import {
  SEL_COMPS, SEL_ITEMS, SEL_SCALE, compScores, fmt, levelOf, overall, strongWeak, summaryText, type SelCheck, type SelLevel,
} from "@/lib/selcheck";

type View = { kind: "check"; edit?: SelCheck } | { kind: "result"; id: string } | { kind: "history" };
const LEVEL: Record<SelLevel, string> = { 상: "bg-[#e3f4e8] text-[#1d7144]", 중: "bg-[#eef0ee] text-[#4f5a53]", 하: "bg-alert-soft text-[#b8352d]" };
const DRAFT = "mb_sel_draft";
const short = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;

export default function SelCheckTab({ data }: { data: Overview }) {
  const [items, setItems] = useState<SelCheck[] | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>({ kind: "history" });

  useEffect(() => {
    let live = true;
    api<{ items: SelCheck[] }>("teacher", "selChecks").then(
      (r) => {
        if (!live) return;
        setItems(r.items);
        if (!r.items.length) setView({ kind: "check" });
      },
      (e) => live && setErr((e as Error).message),
    );
    return () => { live = false; };
  }, []);

  if (err) return <div className="card text-alert">{err}</div>;
  if (!items) return <div className="card text-soft">불러오는 중…</div>;
  const open = view.kind === "result" ? items.find((c) => c.id === view.id) : undefined;
  const go = (v: View) => { setView(v); window.scrollTo(0, 0); };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="학급 역량 진단" className="no-print grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1">
        {([["check", "pencil", "체크하기"], ["history", "chart", `누적 기록 ${items.length ? `(${items.length}회)` : ""}`]] as const).map(([k, icon, name]) => {
          const on = view.kind === k || (k === "history" && view.kind === "result");
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => go(k === "check" ? { kind: "check" } : { kind: "history" })}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl font-bold transition ${on ? "bg-leaf text-white" : "text-soft hover:bg-paper"}`}>
              <Doodle name={icon} size={24} />{name}
            </button>
          );
        })}
      </div>

      {view.kind === "check" && (
        <CheckFlow key={view.edit?.id ?? "new"} data={data} edit={view.edit} onSaved={(check, all) => { setItems(all); go({ kind: "result", id: check.id }); }} />
      )}
      {view.kind === "result" && open && (
        <Result
          check={open} items={items}
          onItems={setItems}
          onEdit={() => go({ kind: "check", edit: open })}
          onBack={() => go({ kind: "history" })}
          onOpen={(id) => go({ kind: "result", id })}
        />
      )}
      {(view.kind === "history" || (view.kind === "result" && !open)) && (
        <History items={items} onOpen={(id) => go({ kind: "result", id })} onNew={() => go({ kind: "check" })} />
      )}
    </div>
  );
}

// ── 체크하기: 기본 정보 → 20문항(누르면 다음으로) → 저장 ──
interface Draft { date: string; school: string; group: string; rater: string; answers: number[]; step: number }
function readDraft(): Draft | null {
  try { return JSON.parse(localStorage.getItem(DRAFT) ?? "null"); } catch { return null; }
}
function writeDraft(d: Draft | null) {
  try { if (d) localStorage.setItem(DRAFT, JSON.stringify(d)); else localStorage.removeItem(DRAFT); } catch { /* 저장 못 해도 계속 */ }
}

function CheckFlow({ data, edit, onSaved }: { data: Overview; edit?: SelCheck; onSaved: (c: SelCheck, all: SelCheck[]) => void }) {
  const [school, setSchool] = useLocal("mb_sel_school");
  const [rater, setRater] = useLocal("mb_sel_rater");
  const fresh: Draft = edit
    ? { date: edit.date, school: edit.school, group: edit.group, rater: edit.rater, answers: [...edit.answers], step: -1 }
    : { date: data.today, school, group: data.settings.className, rater: rater || "담임", answers: [], step: -1 };
  const [d, setD] = useState<Draft>(() => (!edit && readDraft()) || fresh);
  const [resumed] = useState(() => !edit && !!readDraft()?.answers.length);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const put = (next: Draft) => { setD(next); if (!edit) writeDraft(next); };
  const q = d.step;
  const done = d.answers.filter(Boolean).length === SEL_ITEMS.length;

  async function save(answers = d.answers) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ check: SelCheck; items: SelCheck[] }>("teacher", "selSave", {
        check: { id: edit?.id, date: d.date, school: d.school, group: d.group, rater: d.rater, answers, memo: edit?.memo ?? "" },
      });
      if (!edit) { writeDraft(null); setSchool(d.school); setRater(d.rater); }
      onSaved(r.check, r.items);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  function answer(v: number) {
    const answers = [...d.answers];
    answers[q] = v;
    const next = { ...d, answers };
    put(next);
    if (q < SEL_ITEMS.length - 1) setTimeout(() => put({ ...next, step: q + 1 }), 220); // 고른 것이 잠깐 보이고 넘어감
  }

  // 키보드: 1~5로 고르기, ←·Backspace로 이전
  useEffect(() => {
    if (q < 0) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (/^[1-5]$/.test(e.key)) answer(Number(e.key));
      else if ((e.key === "ArrowLeft" || e.key === "Backspace") && q > 0) put({ ...d, step: q - 1 });
      else if (e.key === "ArrowRight" && d.answers[q] && q < SEL_ITEMS.length - 1) put({ ...d, step: q + 1 });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (q < 0)
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <span className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-[#ece9fb] text-3xl" aria-hidden><Doodle name="compass" /></span>
          <h2 className="font-display text-3xl">{edit ? "진단 답 고치기" : "학급 사회·정서역량 진단"}</h2>
          <p className="mt-1 text-soft">우리 반 학생들 전체를 떠올리며<br />20문항에 답해 주세요. 3~4분이면 끝나요.</p>
        </div>
        {resumed && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
            <span>하다 만 체크가 있어요({d.answers.filter(Boolean).length}/20).</span>
            <span className="flex gap-2">
              <button className="btn-sub min-h-9 px-3 text-sm" onClick={() => put({ ...fresh, school: d.school, rater: d.rater })}>새로 하기</button>
              <button className="btn-main min-h-9 px-3 text-sm" onClick={() => put({ ...d, step: Math.min(SEL_ITEMS.length - 1, d.answers.filter(Boolean).length) })}>이어서 하기</button>
            </span>
          </div>
        )}
        <div className="card space-y-3">
          <p className="text-sm font-bold text-soft">기본 정보</p>
          <label className="block text-sm">학교명 <span className="text-soft">(요약에 들어가요)</span>
            <input className="field mt-1" value={d.school} maxLength={30} placeholder="예: 홍북초" onChange={(e) => put({ ...d, school: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">학년·반
              <input className="field mt-1" value={d.group} maxLength={20} placeholder="예: 3학년 2반" onChange={(e) => put({ ...d, group: e.target.value })} />
            </label>
            <label className="block text-sm">작성자
              <input className="field mt-1" value={d.rater} maxLength={20} placeholder="예: 담임, 영어 전담" onChange={(e) => put({ ...d, rater: e.target.value })} />
            </label>
          </div>
          <label className="block text-sm">체크한 날
            <input type="date" className="field mt-1" value={d.date} max={data.today} onChange={(e) => e.target.value && put({ ...d, date: e.target.value })} />
          </label>
          <p className="text-xs text-soft">학생 이름·번호는 묻지 않아요. 결과는 이 학급 저장 공간에 쌓여 다음 체크와 비교돼요.</p>
        </div>
        <button className="btn-main w-full text-lg" disabled={!d.group.trim() || !d.rater.trim()} onClick={() => put({ ...d, step: edit ? 0 : Math.min(SEL_ITEMS.length - 1, d.answers.filter(Boolean).length) })}>
          {edit ? "답 고치러 가기 →" : "시작하기 →"}
        </button>
      </section>
    );

  const last = q === SEL_ITEMS.length - 1;
  return (
    <section className="mx-auto max-w-xl space-y-4" aria-live="polite">
      <div className="flex items-center gap-3 text-sm">
        <span className="tabular-nums text-soft">{q + 1} / {SEL_ITEMS.length}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ecebf3]">
          <div className="h-full rounded-full bg-[#7b6fd8] transition-all duration-300" style={{ width: `${((q + 1) / SEL_ITEMS.length) * 100}%` }} />
        </div>
        <span className="tabular-nums font-bold text-[#6b5fd0]">{Math.round(((q + 1) / SEL_ITEMS.length) * 100)}%</span>
      </div>
      <div className="card min-h-40 space-y-2">
        <p className="text-xs font-bold text-soft">Q {String(q + 1).padStart(2, "0")}</p>
        <p className="text-xl leading-relaxed">우리 반 학생들은 {SEL_ITEMS[q]}</p>
      </div>
      <div role="radiogroup" aria-label="얼마나 그런가요" className="grid grid-cols-5 gap-2">
        {SEL_SCALE.map((name, i) => {
          const v = i + 1;
          const on = d.answers[q] === v;
          return (
            <button key={v} role="radio" aria-checked={on} onClick={() => answer(v)}
              className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 transition active:scale-[0.97] ${on ? "border-[#7b6fd8] bg-[#efedfc] text-[#4f43b8]" : "border-line bg-card hover:bg-paper"}`}>
              <span className="font-display text-2xl">{v}</span>
              <span className="text-[11px] leading-tight text-soft sm:text-xs">{name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button className="btn-sub px-4" onClick={() => put({ ...d, step: q - 1 })} aria-label={q ? "이전 문항" : "기본 정보로"}>←</button>
        {last ? (
          <button className="btn-main flex-1" disabled={!done || busy} onClick={() => save()}>{busy ? "저장하는 중…" : edit ? "고친 답 저장 →" : "결과 보기 →"}</button>
        ) : (
          <button className="btn-main flex-1" disabled={!d.answers[q]} onClick={() => put({ ...d, step: q + 1 })}>다음 →</button>
        )}
      </div>
      {last && !done && <p className="text-center text-sm text-alert">답하지 않은 문항이 있어요: {SEL_ITEMS.map((_, i) => (d.answers[i] ? null : i + 1)).filter(Boolean).join(", ")}번</p>}
      {err && <p className="text-center text-sm text-alert">{err}</p>}
      <p className="text-center text-xs text-soft">숫자 키 1~5로도 고를 수 있어요.</p>
    </section>
  );
}

// ── 결과 한 회차 ──
function Result({ check, items, onItems, onEdit, onBack, onOpen }: {
  check: SelCheck; items: SelCheck[]; onItems: (x: SelCheck[]) => void; onEdit: () => void; onBack: () => void; onOpen: (id: string) => void;
}) {
  const idx = items.findIndex((c) => c.id === check.id);
  const prev = idx > 0 ? items[idx - 1] : undefined;
  const scores = compScores(check.answers);
  const before = prev ? compScores(prev.answers) : null;
  const avg = overall(check.answers);
  const { strong, weak } = strongWeak(scores);
  const [memo, setMemo] = useState(check.memo);
  const [memoBusy, setMemoBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const text = summaryText(check);

  async function saveMemo() {
    setMemoBusy(true);
    setErr("");
    try {
      const r = await api<{ items: SelCheck[] }>("teacher", "selSave", { check: { ...check, memo } });
      onItems(r.items);
    } catch (e) { setErr((e as Error).message); }
    setMemoBusy(false);
  }
  async function remove() {
    if (!confirm(`${label(check.date)} 진단을 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      const r = await api<{ items: SelCheck[] }>("teacher", "selDelete", { id: check.id });
      onItems(r.items);
      onBack();
    } catch (e) { setErr((e as Error).message); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.append(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const names = (xs: number[]) => xs.map((i) => SEL_COMPS[i].name).join(" · ");

  return (
    <article className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <button className="btn-sub min-h-10 px-3 text-sm" onClick={onBack}>← 누적 기록</button>
        <div className="flex flex-wrap gap-2">
          {prev && <button className="btn-sub min-h-10 px-3 text-sm" onClick={() => onOpen(prev.id)}>‹ 이전 회차</button>}
          {items[idx + 1] && <button className="btn-sub min-h-10 px-3 text-sm" onClick={() => onOpen(items[idx + 1].id)}>다음 회차 ›</button>}
          <button className="btn-sub min-h-10 px-3 text-sm" onClick={() => window.print()}><Doodle name="printer" /> 인쇄</button>
        </div>
      </div>

      <header className="text-center">
        <span className="mx-auto mb-2 grid size-14 place-items-center rounded-3xl bg-[#e4f5ee] text-2xl" aria-hidden><Doodle name="bars" /></span>
        <h2 className="font-display text-3xl">진단 결과 <span className="text-soft">· {idx + 1}회차</span></h2>
        <p className="text-sm text-soft">{[check.school, check.group, check.rater, label(check.date)].filter(Boolean).join(" · ")}{check.demo ? " · 연습" : ""}</p>
      </header>

      <section className="grid gap-2 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-soft">전체 평균</p>
          <p className="font-display text-4xl tabular-nums">{avg.toFixed(2)}<span className="text-base text-soft"> /5</span></p>
          {prev && <Delta v={avg - overall(prev.answers)} />}
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-soft">강점 역량</p>
          <p className="mt-1 font-display text-xl text-[#1d7144]">{names(strong)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-soft">보완 역량</p>
          <p className="mt-1 font-display text-xl text-[#b8352d]">{weak.length ? names(weak) : "고르게 나타남"}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3" aria-label="역량별 점수">
          {SEL_COMPS.map((c, i) => (
            <div key={c.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="font-bold leading-tight">{c.name}</span>
              <span className="relative h-3 rounded-full bg-paper">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(scores[i] / 5) * 100}%`, background: c.color }} />
                {before && <span className="absolute -top-1 h-5 w-0.5 rounded bg-ink/50" style={{ left: `calc(${(before[i] / 5) * 100}% - 1px)` }} title={`지난 회차 ${fmt(before[i])}`} />}
              </span>
              <span className="flex items-center gap-1.5">
                <b className="w-9 text-right tabular-nums">{fmt(scores[i])}</b>
                <i className={`rounded-md px-1.5 py-0.5 text-xs font-bold not-italic ${LEVEL[levelOf(scores[i])]}`}>{levelOf(scores[i])}</i>
                {before && <Delta v={scores[i] - before[i]} small />}
              </span>
            </div>
          ))}
          <p className="flex flex-wrap justify-end gap-1.5 pt-1 text-xs">
            <i className={`rounded-md px-2 py-0.5 not-italic ${LEVEL.상}`}>상 4.0↑</i>
            <i className={`rounded-md px-2 py-0.5 not-italic ${LEVEL.중}`}>중 3.0~3.9</i>
            <i className={`rounded-md px-2 py-0.5 not-italic ${LEVEL.하}`}>하 3.0↓</i>
            {before && <span className="text-soft">· 세로 눈금 = 지난 회차({short(prev!.date)})</span>}
          </p>
        </section>
        <section className="card grid place-items-center">
          <Radar series={[...(before ? [{ v: before, name: `지난 회차 ${short(prev!.date)}`, dash: true }] : []), { v: scores, name: `이번 ${short(check.date)}` }]} />
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-3xl border border-[#bfe5cc] bg-[#f0faf3] p-5">
          <p className="mb-1 inline-block rounded-lg bg-[#d7f0df] px-2 py-0.5 text-xs font-bold text-[#1d7144]">★ 강점</p>
          <h3 className="font-display text-xl text-[#1d7144]">{names(strong)}</h3>
          <p className="mt-1 text-sm text-soft">가장 높게 나타난 역량이에요. 우리 반이 잘하는 이 모습을 출발점으로 다른 역량 활동을 이어 가 보세요.</p>
        </section>
        <section className="rounded-3xl border border-[#f3c7c2] bg-[#fdf1ef] p-5">
          <p className="mb-1 inline-block rounded-lg bg-[#f9dcd8] px-2 py-0.5 text-xs font-bold text-[#b8352d]">▲ 보완</p>
          {weak.length ? weak.map((i) => (
            <div key={i} className="space-y-1">
              <h3 className="font-display text-xl text-[#b8352d]">{SEL_COMPS[i].name}</h3>
              <p className="text-sm text-soft">{SEL_COMPS[i].tip}</p>
              <p className="text-sm"><b className="text-leaf">마음빛 길잡이에서</b> <DoodleText text={SEL_COMPS[i].app} /></p>
            </div>
          )) : <p className="text-sm text-soft">다섯 역량이 같은 점수로 고르게 나타났어요. 문항별 응답에서 낮은 문항을 살펴보세요.</p>}
        </section>
      </div>

      <details className="card group">
        <summary className="cursor-pointer list-none font-bold">문항별 응답 <span className="text-sm font-normal text-soft">(누르면 펼쳐짐)</span></summary>
        <ol className="mt-3 space-y-3">
          {SEL_COMPS.map((c, ci) => (
            <li key={c.key}>
              <p className="mb-1 text-sm font-bold" style={{ color: c.color }}>{c.name}</p>
              <ul className="space-y-1">
                {SEL_ITEMS.slice(ci * 4, ci * 4 + 4).map((t, k) => {
                  const i = ci * 4 + k;
                  const a = check.answers[i];
                  const b = prev?.answers[i];
                  return (
                    <li key={i} className="grid grid-cols-[2rem_1fr_auto] items-start gap-2 text-sm">
                      <span className="text-soft tabular-nums">{i + 1}</span>
                      <span>{t}</span>
                      <span className="flex items-center gap-1">
                        <Dots v={a} color={c.color} />
                        {b !== undefined && b !== a && <Delta v={a - b} small />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </details>

      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-bold"><span aria-hidden><Doodle name="clipboard" /></span> 결과 요약 <span className="text-sm font-normal text-soft">(담당 선생님께 전달용)</span></h3>
        <p className="rounded-2xl bg-[#eef1fb] px-4 py-2 text-sm text-[#4b55a3]">아래 글을 복사해 학년·전체 결과를 모으는 선생님께 메신저로 보내 주세요.</p>
        <pre className="whitespace-pre-wrap rounded-2xl bg-paper px-4 py-3 font-mono text-sm leading-relaxed">{text}</pre>
        <button className="btn-main no-print w-full bg-ink" onClick={copy}>{copied ? "✓ 복사했어요" : "결과 복사하기"}</button>
      </section>

      <section className="card space-y-2">
        <h3 className="flex items-center gap-2 font-bold"><span aria-hidden><Doodle name="memo" /></span> 메모</h3>
        <textarea className="field min-h-28 print:hidden" maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이 사항, 다음 프로그램 계획 등을 자유롭게 적어 주세요." />
        {/* 인쇄할 때는 칸 높이에 잘리지 않게 글 전체를 */}
        <p className="hidden min-h-[3em] whitespace-pre-wrap text-sm leading-relaxed print:block">{memo}</p>
        <div className="no-print flex justify-end">
          <button className="btn-sub min-h-10 px-4 text-sm" disabled={memo === check.memo || memoBusy} onClick={saveMemo}>{memoBusy ? "저장하는 중…" : memo === check.memo ? "저장됨" : "메모 저장"}</button>
        </div>
      </section>

      {err && <p className="text-center text-sm text-alert">{err}</p>}
      <div className="no-print grid grid-cols-2 gap-2">
        <button className="btn-sub" onClick={onEdit}><Doodle name="pencil" /> 답 고치기</button>
        <button className="btn-sub text-alert" onClick={remove}>이 회차 지우기</button>
      </div>
    </article>
  );
}

function Delta({ v, small }: { v: number; small?: boolean }) {
  const r = Math.round(v * 100) / 100;
  if (!r) return <span className={`text-soft ${small ? "text-xs" : "text-sm"}`}>–</span>;
  return <span className={`font-bold tabular-nums ${small ? "text-xs" : "text-sm"} ${r > 0 ? "text-[#1d7144]" : "text-[#b8352d]"}`}>{r > 0 ? "▲" : "▼"}{small ? fmt(Math.abs(r)) : Math.abs(r).toFixed(2)}</span>;
}

function Dots({ v, color }: { v: number; color: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${v}점 ${SEL_SCALE[v - 1]}`} title={SEL_SCALE[v - 1]}>
      {[1, 2, 3, 4, 5].map((k) => <i key={k} className="inline-block size-2.5 rounded-full" style={{ background: k <= v ? color : "#e5e2da" }} />)}
    </span>
  );
}

// 5각 레이더: 여러 회차를 겹쳐 그린다(앞 회차는 점선)
function Radar({ series }: { series: { v: number[]; name: string; dash?: boolean }[] }) {
  const W = 440, cx = 220, cy = 168, R = 108;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + Math.cos(a) * (R * v) / 5, cy + Math.sin(a) * (R * v) / 5] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <figure className="w-full max-w-[440px]">
      <svg viewBox={`0 0 ${W} 330`} className="w-full" role="img" aria-label={series.map((s) => `${s.name}: ${s.v.map((x, i) => `${SEL_COMPS[i].name} ${fmt(x)}`).join(", ")}`).join(" / ")}>
        {[1, 2, 3, 4, 5].map((k) => <polygon key={k} points={poly([k, k, k, k, k])} fill={k === 3 ? "#f6f4ee" : "none"} stroke="#e3ded2" strokeWidth={k === 5 ? 1.4 : 1} />)}
        {SEL_COMPS.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e3ded2" />; })}
        {[1, 3, 5].map((k) => <text key={k} x={cx + 3} y={cy - (R * k) / 5 + 3} fontSize="9" fill="#a39f95">{k}</text>)}
        {series.map((s, si) => (
          <g key={si}>
            <polygon points={poly(s.v)} fill={s.dash ? "none" : "#7b6fd833"} stroke={s.dash ? "#9a968c" : "#6b5fd0"} strokeWidth={s.dash ? 1.6 : 2.2} strokeDasharray={s.dash ? "5 4" : undefined} strokeLinejoin="round" />
            {!s.dash && s.v.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r="4.5" fill={SEL_COMPS[i].color} stroke="#fff" strokeWidth="1.5" />; })}
          </g>
        ))}
        {SEL_COMPS.map((c, i) => {
          const [x, y] = pt(i, 6.15);
          return <text key={c.key} x={x} y={y + 4} fontSize="12" textAnchor={x < cx - 10 ? "end" : x > cx + 10 ? "start" : "middle"} fill="#3b4740">{c.name}</text>;
        })}
      </svg>
      {series.length > 1 && (
        <figcaption className="flex justify-center gap-4 text-xs text-soft">
          {series.map((s) => <span key={s.name} className="flex items-center gap-1"><i className={`inline-block w-5 border-t-2 ${s.dash ? "border-dashed border-[#9a968c]" : "border-[#6b5fd0]"}`} />{s.name}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

// ── 누적 기록: 회차별 변화 ──
function History({ items, onOpen, onNew }: { items: SelCheck[]; onOpen: (id: string) => void; onNew: () => void }) {
  const raters = useMemo(() => [...new Set(items.map((c) => c.rater || "-"))], [items]);
  const [who, setWho] = useState("");
  const [hide, setHide] = useState<number[]>([]);
  const list = who ? items.filter((c) => (c.rater || "-") === who) : items;
  if (!items.length)
    return (
      <div className="card space-y-3 text-center">
        <p className="text-4xl" aria-hidden><Doodle name="sprout" /></p>
        <p className="font-display text-xl">아직 진단 기록이 없어요</p>
        <p className="text-sm text-soft">학기 초·중간·끝처럼 몇 번 체크해 두면 우리 반 역량이 어떻게 자랐는지 한눈에 보여요.</p>
        <button className="btn-main mx-auto" onClick={onNew}>첫 진단 시작하기 →</button>
      </div>
    );
  const first = list[0], last = list.at(-1)!;
  const s0 = compScores(first.answers), s1 = compScores(last.answers);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        {raters.length > 1 ? (
          <div role="group" aria-label="작성자" className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-0.5 text-sm">
            {["", ...raters].map((r) => (
              <button key={r || "all"} aria-pressed={who === r} onClick={() => setWho(r)} className={`rounded-lg px-3 py-1 ${who === r ? "bg-leaf text-white" : "text-soft"}`}>{r || "모두"}</button>
            ))}
          </div>
        ) : <span />}
        <button className="btn-sub min-h-10 px-3 text-sm" onClick={() => window.print()}><Doodle name="printer" /> 누적 기록 인쇄</button>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="card p-3"><p className="text-xs text-soft">진단 횟수</p><p className="font-display text-3xl">{list.length}회</p></div>
        <div className="card p-3"><p className="text-xs text-soft">기간</p><p className="font-display text-xl">{short(first.date)} ~ {short(last.date)}</p></div>
        <div className="card p-3"><p className="text-xs text-soft">최근 전체 평균</p><p className="font-display text-3xl tabular-nums">{overall(last.answers).toFixed(2)}</p></div>
        <div className="card p-3"><p className="text-xs text-soft">처음보다</p><p className="font-display text-3xl">{list.length > 1 ? <Delta v={overall(last.answers) - overall(first.answers)} /> : "–"}</p></div>
      </section>

      {list.length > 1 && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl">역량별 변화</h3>
            <p className="flex flex-wrap gap-1.5 text-xs">
              {SEL_COMPS.map((c, i) => {
                const off = hide.includes(i);
                return (
                  <button key={c.key} aria-pressed={!off} onClick={() => setHide(off ? hide.filter((x) => x !== i) : [...hide, i])}
                    className={`flex items-center gap-1 rounded-full border px-2 py-1 ${off ? "border-line text-soft opacity-60" : "border-transparent bg-paper"}`}>
                    <i className="inline-block size-2.5 rounded-full" style={{ background: c.color }} />{c.name}
                  </button>
                );
              })}
              <span className="flex items-center gap-1 px-1 text-soft"><i className="inline-block w-4 border-t-2 border-dashed border-ink" />전체 평균</span>
            </p>
          </div>
          <Lines list={list} hide={hide} onOpen={onOpen} />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <section className="card overflow-x-auto">
          <h3 className="mb-2 font-display text-xl">회차별 결과</h3>
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-soft">
                <th className="whitespace-nowrap py-2 pr-2 font-normal">회차</th>
                <th className="pr-2 font-normal">날짜 · 작성자</th>
                <th className="pr-2 text-right font-normal">평균</th>
                {SEL_COMPS.map((c) => <th key={c.key} className="px-1 text-center font-normal" title={c.name}>{c.name.slice(0, 2)}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...list].reverse().map((c) => {
                const s = compScores(c.answers);
                return (
                  <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer border-b border-line/60 hover:bg-paper">
                    <td className="py-2 pr-2 tabular-nums text-soft">{items.indexOf(c) + 1}</td>
                    <td className="pr-2"><b>{label(c.date)}</b> <span className="text-soft">· {c.rater || "-"}{c.demo ? " · 연습" : ""}</span>{c.memo && <span className="block max-w-[16rem] truncate text-xs text-soft"><Doodle name="memo" /> {c.memo}</span>}</td>
                    <td className="pr-2 text-right font-bold tabular-nums">{overall(c.answers).toFixed(2)}</td>
                    {s.map((v, i) => <td key={i} className="px-1 text-center"><span className={`inline-block min-w-9 rounded-md px-1 py-0.5 text-xs font-bold tabular-nums ${LEVEL[levelOf(v)]}`}>{fmt(v)}</span></td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="no-print mt-2 text-xs text-soft">줄을 누르면 그 회차 결과·메모를 열어요.</p>
        </section>
        {list.length > 1 && (
          <section className="card grid place-items-center lg:w-[400px]">
            <h3 className="font-display text-xl">처음과 최근</h3>
            <Radar series={[{ v: s0, name: `처음 ${short(first.date)}`, dash: true }, { v: s1, name: `최근 ${short(last.date)}` }]} />
          </section>
        )}
      </div>
    </div>
  );
}

// 회차별 꺾은선(1~5점, 상·중·하 띠). 점을 누르면 그 회차를 연다.
function Lines({ list, hide, onOpen }: { list: SelCheck[]; hide: number[]; onOpen: (id: string) => void }) {
  const W = 720, H = 280, L = 34, Rm = 30, T = 14, B = 40;
  const x = (i: number) => L + (list.length === 1 ? (W - L - Rm) / 2 : (i * (W - L - Rm)) / (list.length - 1));
  const y = (v: number) => T + ((5 - v) / 4) * (H - T - B);
  const scores = list.map((c) => compScores(c.answers));
  const avgs = list.map((c) => overall(c.answers));
  const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="회차별 역량 점수 꺾은선">
      <rect x={L} y={y(5)} width={W - L - Rm} height={y(4) - y(5)} fill="#eaf6ee" />
      <rect x={L} y={y(4)} width={W - L - Rm} height={y(3) - y(4)} fill="#f6f5f1" />
      <rect x={L} y={y(3)} width={W - L - Rm} height={y(1) - y(3)} fill="#fdf2f0" />
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - Rm} y1={y(v)} y2={y(v)} stroke="#e3ded2" strokeDasharray={v === 3 || v === 4 ? undefined : "2 4"} />
          <text x={L - 8} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#8a877e">{v}</text>
        </g>
      ))}
      <text x={W - 6} y={y(4.5) + 4} fontSize="12" textAnchor="end" fill="#1d7144">상</text>
      <text x={W - 6} y={y(3.5) + 4} fontSize="12" textAnchor="end" fill="#6b7a71">중</text>
      <text x={W - 6} y={y(2) + 4} fontSize="12" textAnchor="end" fill="#b8352d">하</text>
      {list.map((c, i) => <text key={c.id} x={x(i)} y={H - 16} fontSize="11" textAnchor="middle" fill="#3b4740">{short(c.date)}</text>)}
      <path d={path(avgs)} fill="none" stroke="#2d3a33" strokeWidth="2" strokeDasharray="6 5" />
      {SEL_COMPS.map((c, ci) => hide.includes(ci) ? null : (
        <g key={c.key}>
          <path d={path(scores.map((s) => s[ci]))} fill="none" stroke={c.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
          {scores.map((s, i) => (
            <circle key={i} cx={x(i)} cy={y(s[ci])} r="5" fill={c.color} stroke="#fff" strokeWidth="1.5" className="cursor-pointer" onClick={() => onOpen(list[i].id)}>
              <title>{`${short(list[i].date)} · ${c.name} ${fmt(s[ci])}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}
