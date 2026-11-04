"use client";
// 학생 자기진단(학생 화면 이름 「마음 점검」): 회차를 열면 학생 화면 맨 앞에 「마음 점검」이 생기고, 닫으면 사라진다.
// 학생은 10문장(5개 역량 × 2)에 「그래요 · 가끔 그래요 · 아니에요」로 답한다. 결과는 반 평균·문항별 응답·학생별 점수를
// 지난 회차(학기 초 ↔ 학기 말)와 견주고, 선생님 「학급 역량 진단」과 같은 눈금(0~100)으로 나란히 보여 준다. 선생님만 본다.
import { useEffect, useState } from "react";
import Doodle from "../Doodle";
import type { NameOf, Overview } from "./types";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { SEL_COMPS, compScores, type SelCheck } from "@/lib/selcheck";
import { SELF_ITEMS, classComps, itemCounts, pctOf, selfComps, selfWatch, type SelfAnswer, type SelfRound } from "@/lib/selfcheck";

type Data = { rounds: SelfRound[]; answers: SelfAnswer[]; sel: SelCheck[] };
const TITLES = ["학기 초", "학기 말"];
const f2 = (v: number | null) => (v == null ? "–" : v.toFixed(2));
const ANS = [
  { v: 3, name: "그래요", color: "#5FB672" },
  { v: 2, name: "가끔 그래요", color: "#F2C14E" },
  { v: 1, name: "아니에요", color: "#C9C3B8" },
] as const;

export default function SelfCheckTab({ data, nameOf }: { data: Overview; nameOf: NameOf }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<string | null>(null); // 보고 있는 회차
  const [base, setBase] = useState<string | null>(null); // 견줄 회차
  const [title, setTitle] = useState(TITLES[0]);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<string | null>(null); // 지우기 한 번 더 묻기
  const [hide, setHide] = useState(false);

  useEffect(() => {
    api<Data>("teacher", "selfChecks").then((r) => {
      setD(r);
      const withAns = r.rounds.filter((x) => r.answers.some((a) => a.round === x.id));
      const last = withAns.at(-1) ?? r.rounds.at(-1);
      setView(last?.id ?? null);
      setBase(withAns.filter((x) => x.id !== last?.id).at(-1)?.id ?? null);
      // 열린 회차가 없으면 다음 회차 이름을 짐작(학기 초가 있으면 학기 말)
      if (r.rounds.some((x) => x.title === TITLES[0])) setTitle(TITLES[1]);
    }, (e) => setErr((e as Error).message));
  }, []);

  async function act(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ rounds: SelfRound[]; answers: SelfAnswer[] }>("teacher", action, body);
      setD({ ...d!, ...r });
      if (action === "selfOpen") setView(r.rounds.at(-1)?.id ?? null);
      if (action === "selfDelete") { setView(r.rounds.at(-1)?.id ?? null); setBase(null); }
    } catch (e) {
      setErr((e as Error).message);
    }
    setSure(null);
    setBusy(false);
  }

  if (!d) return <div className="card text-soft">{err || "불러오는 중…"}</div>;
  const open = d.rounds.find((r) => !r.closedAt);
  const of = (id: string | null) => d.answers.filter((a) => a.round === id);
  const round = d.rounds.find((r) => r.id === view);
  const now = of(view), before = of(base);
  const who = (no: number) => (hide ? `${no}번` : `${no} ${nameOf(no)}`);

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="text-sm text-soft">
          학생이 스스로 10문장(역량마다 2문장)에 「그래요 · 가끔 그래요 · 아니에요」로 답해요. 학기 초와 학기 말에 한 번씩 열어 견주어 보세요.
          학생 화면에는 점수가 보이지 않고, 결과는 선생님만 봐요.
        </p>
        {open ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-soft p-4">
            <div>
              <p className="font-bold"><Doodle name="clipboard" /> 학생 화면에 열려 있어요 · 「{open.title}」 ({label(open.openedAt)}부터)</p>
              <p className="text-sm">
                답한 학생 {of(open.id).length}/{data.students.length}
                {data.students.length > of(open.id).length && (
                  <span className="text-soft"> · 아직: {data.students.filter((s) => !of(open.id).some((a) => a.no === s.no)).map((s) => s.no).join(", ")}번</span>
                )}
              </p>
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
            <p className="w-full text-xs text-soft">열면 학생 화면 「더 해 보기」 맨 앞에 「마음 점검」이 생겨요. 다 모이면 닫아 주세요.</p>
          </div>
        )}
        {err && <p role="alert" className="text-alert">{err}</p>}
      </section>

      {d.rounds.length > 0 && (
        <section className="no-print flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-soft">볼 회차</span>
            <select value={view ?? ""} onChange={(e) => setView(e.target.value)} className="field mt-1 min-h-11 py-2">
              {d.rounds.map((r) => <option key={r.id} value={r.id}>{r.title} · {label(r.openedAt)} ({of(r.id).length}명)</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-soft">견줄 회차</span>
            <select value={base ?? ""} onChange={(e) => setBase(e.target.value || null)} className="field mt-1 min-h-11 py-2">
              <option value="">견주지 않기</option>
              {d.rounds.filter((r) => r.id !== view).map((r) => <option key={r.id} value={r.id}>{r.title} · {label(r.openedAt)}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-5 accent-leaf" /> 학생은 번호로만</label>
          <div className="ml-auto flex gap-2">
            {round?.closedAt && !open && <button onClick={() => act("selfReopen", { id: round.id })} disabled={busy} className="btn-sub min-h-11 text-sm">다시 열기</button>}
            {round && (sure === round.id
              ? <button onClick={() => act("selfDelete", { id: round.id })} disabled={busy} className="btn-sub min-h-11 border-alert text-sm text-alert">정말 지우기(답 {now.length}개)</button>
              : <button onClick={() => setSure(round.id)} className="btn-sub min-h-11 text-sm">회차 지우기</button>)}
            <button onClick={() => window.print()} className="btn-sub min-h-11 text-sm"><Doodle name="printer" /> 인쇄</button>
          </div>
        </section>
      )}

      {!round ? (
        <div className="card text-soft">아직 회차가 없어요. 위에서 「학기 초」 회차를 열어 보세요.</div>
      ) : !now.length ? (
        <div className="card text-soft">「{round.title}」에 아직 답한 학생이 없어요.</div>
      ) : (
        <Results data={data} d={d} round={round} base={d.rounds.find((r) => r.id === base) ?? null} now={now} before={before} who={who} />
      )}
    </div>
  );
}

function Results({ data, d, round, base, now, before, who }: {
  data: Overview; d: Data; round: SelfRound; base: SelfRound | null; now: SelfAnswer[]; before: SelfAnswer[]; who: (no: number) => string;
}) {
  const c = classComps(now.map((a) => a.answers));
  const b = base ? classComps(before.map((a) => a.answers)) : null;
  // 선생님 관찰: 이 회차에 가장 가까운 날 한 「학급 역량 진단」
  const near = [...d.sel].sort((x, y) => Math.abs(Date.parse(x.date) - Date.parse(round.openedAt)) - Math.abs(Date.parse(y.date) - Date.parse(round.openedAt)))[0];
  const t = near ? compScores(near.answers) : null;
  const counts = itemCounts(now.map((a) => a.answers));
  const watch = selfWatch(now, base ? before : []);
  const rows = [...now].sort((x, y) => x.no - y.no);

  return (
    <>
      <section className="card space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">「{round.title}」 반 전체 · {now.length}/{data.students.length}명</h2>
          <p className="text-sm text-soft">{base ? `견줌: 「${base.title}」 ${before.length}명` : "견줄 회차 없음"}</p>
        </header>
        <div className="space-y-3">
          {SEL_COMPS.map((comp, i) => (
            <div key={comp.key} className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr_9rem]">
              <p className="font-bold" style={{ color: comp.color }}>{comp.name}</p>
              <div className="relative h-5 rounded-full bg-[#f1eee7]" aria-hidden>
                {c[i] != null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(4, pctOf(c[i]!, 3))}%`, background: comp.color }} />}
                {b?.[i] != null && <span className="absolute -inset-y-1 w-0.5 rounded bg-ink/70" style={{ left: `${pctOf(b[i]!, 3)}%` }} title={`지난 회차 ${f2(b[i])}`} />}
                {t && <span className="absolute -bottom-1.5 size-2.5 -translate-x-1/2 rotate-45 border border-white bg-ink" style={{ left: `${pctOf(t[i], 5)}%` }} title={`선생님 관찰 ${t[i]}`} />}
              </div>
              <p className="text-sm tabular-nums">
                <b>{f2(c[i])}</b><span className="text-soft"> / 3</span>
                {b?.[i] != null && c[i] != null && <Delta v={c[i]! - b[i]!} />}
                {t && <span className="block text-xs text-soft">선생님 관찰 {t[i].toFixed(2)} / 5</span>}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-soft">
          막대는 학생 스스로 답한 반 평균(3점 만점)이에요.{b && " 검은 세로선은 견준 회차,"}{t && ` ◆는 선생님 학급 역량 진단(${label(near!.date)}, 5점 만점)을 같은 눈금으로 옮긴 자리예요.`}
          {" "}학생 응답과 선생님 관찰이 크게 다르면 그 역량을 학생과 함께 이야기해 볼 만해요.
        </p>
      </section>

      <section className="card space-y-3">
        <h3 className="font-display text-xl">문장별 응답</h3>
        <div className="flex flex-wrap gap-3 text-xs">{ANS.map((a) => <span key={a.v} className="flex items-center gap-1"><i className="inline-block size-3 rounded-sm" style={{ background: a.color }} />{a.name}</span>)}</div>
        <ol className="space-y-2">
          {SELF_ITEMS.map((it, i) => {
            const [y, s, n] = counts[i];
            const total = y + s + n || 1;
            const comp = SEL_COMPS.find((x) => x.key === it.comp)!;
            return (
              <li key={i} className="grid gap-1 sm:grid-cols-[1fr_14rem] sm:items-center sm:gap-3">
                <p className="text-sm"><span className="text-soft">{i + 1}.</span> {it.text.ko} <span className="text-xs" style={{ color: comp.color }}>{comp.name}</span></p>
                <div>
                  <div className="flex h-4 overflow-hidden rounded-full" aria-label={`그래요 ${y}, 가끔 ${s}, 아니에요 ${n}`}>
                    {[y, s, n].map((k, j) => k > 0 && <span key={j} style={{ flex: k, background: ANS[j].color }} />)}
                  </div>
                  <p className="text-xs tabular-nums text-soft">그래요 {y} · 가끔 {s} · 아니에요 <b className={n / total >= 0.3 ? "text-alert" : ""}>{n}</b></p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card space-y-3">
        <h3 className="font-display text-xl">학생별 점수 <span className="text-sm text-soft">(3점 만점 · 선생님만)</span></h3>
        {watch.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-[#fff8e1] p-3 text-sm">
            <p className="font-bold"><Doodle name="dotYellow" /> 먼저 이야기 나눠 볼 학생 (진단이 아닌 살펴보기 신호)</p>
            {watch.map((w) => <p key={w.no}>· {who(w.no)}: {w.why.join(", ")}</p>)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-xs text-soft">
                <th className="py-1.5 pr-2 font-normal">학생</th>
                {SEL_COMPS.map((x) => <th key={x.key} className="px-1 font-normal" style={{ color: x.color }}>{x.name}</th>)}
                <th className="px-1 font-normal">평균</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const s = selfComps(a.answers);
                const p = before.find((x) => x.no === a.no);
                const ps = p ? selfComps(p.answers) : null;
                const avg = s.reduce((x, y) => x + y, 0) / s.length, pavg = ps ? ps.reduce((x, y) => x + y, 0) / ps.length : null;
                return (
                  <tr key={a.no} className={`border-b border-line/60 ${watch.some((w) => w.no === a.no) ? "bg-[#fff8e1]" : ""}`}>
                    <td className="whitespace-nowrap py-1.5 pr-2">{who(a.no)}</td>
                    {s.map((v, i) => (
                      <td key={i} className="px-1">
                        <span className={v === 1 ? "font-bold text-alert" : ""}>{v.toFixed(1)}</span>
                        {ps && <Delta v={v - ps[i]} small />}
                      </td>
                    ))}
                    <td className="px-1 font-bold">{avg.toFixed(2)}{pavg != null && <Delta v={avg - pavg} small />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-soft">학생이 스스로 고른 답이라 그날 기분에 따라 달라질 수 있어요. 점수로 비교하지 말고 대화를 시작하는 데 써 주세요.</p>
      </section>
    </>
  );
}

function Delta({ v, small }: { v: number; small?: boolean }) {
  const r = Math.round(v * 100) / 100;
  if (!r) return <span className={`ml-1 text-soft ${small ? "text-[10px]" : "text-xs"}`}>–</span>;
  return <span className={`ml-1 font-bold ${small ? "text-[10px]" : "text-xs"} ${r > 0 ? "text-[#1d7144]" : "text-[#b8352d]"}`}>{r > 0 ? "▲" : "▼"}{Math.abs(r).toFixed(small ? 1 : 2)}</span>;
}
