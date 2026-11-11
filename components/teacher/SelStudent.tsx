"use client";
// 학급 역량 진단 · 한 학생 자세히(선생님만): 스스로 답한 점수와 선생님 관찰을 나란히, 영역별 지도 가이드, 학생이 고른 답,
// 선생님 관찰(간이 16 · 심층 32), 종이 검사 점수, 선생님만 보는 메모, 학생에게 보낼 말(AI 초안 → 고쳐서 보내기 · 거두기).
// 학생 화면에는 보낸 말만 간다(메모·관찰·점수는 가지 않는다). AI에는 영역별 수준과 학생이 고른 문장만 보낸다.
import { useState } from "react";
import Doodle, { DoodleText } from "../Doodle";
import StyleNote from "./StyleNote";
import { useAct } from "./useAct";
import { api } from "@/lib/api";
import { label, today } from "@/lib/date";
import { DOMAINS, PER, SELF_ITEMS, SELF_SCALE, levelOf, obsMax, obsScores, unread, type SelNote, type SelObs, type SelfAnswer, type SelfRound } from "@/lib/selfcheck";
import type { Student } from "@/lib/shared";
import { DOMAIN_GUIDE, OBS16, OBS32, OBS_SCALE } from "@/lib/selguide";

export interface SelRow {
  st: Student;
  answer: SelfAnswer | null;
  note: SelNote | null;
  scores: number[] | null; // 학생 답(없으면 종이 검사 점수)
  before: number[] | null; // 견줄 회차의 같은 학생 점수
  watch: string[];
}
export function Delta({ v, small }: { v: number; small?: boolean }) {
  const r = Math.round(v * 10) / 10;
  if (!r) return <span className={`ml-1 text-soft ${small ? "text-[10px]" : "text-xs"}`}>–</span>;
  return <span className={`ml-1 font-bold ${small ? "text-[10px]" : "text-xs"} ${r > 0 ? "text-[#1d7144]" : "text-[#b8352d]"}`}>{r > 0 ? "▲" : "▼"}{Math.abs(r)}</span>;
}

const LEAK = /아주 ?잘함|자라나는 ?중|도움 ?필요|점수|진단|검사|\d+ ?점/g;
const when = (iso: string) => {
  const d = today(new Date(iso));
  return `${label(d)} ${new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" })}`;
};

export default function SelStudent({ round, base, row, who, onSaved, onClose, onMove, first, last, aiLabel }: {
  round: SelfRound; base: SelfRound | null; row: SelRow; who: string; onSaved: (n: SelNote) => void;
  onClose: () => void; onMove: (dir: -1 | 1) => void; first: boolean; last: boolean; aiLabel: string;
}) {
  const { st, answer, note, scores, before, watch } = row;
  const obs = note?.obs ?? null;
  const o = obs ? obsScores(obs) : null;

  return (
    <section className="card space-y-5 border-2 border-leaf/40" aria-labelledby="sel-who">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="sel-who" className="font-display text-2xl">{who} · 「{round.title}」</h3>
          <p className="text-sm text-soft">
            {answer ? `학생 화면에서 답함 · ${when(answer.at)}` : scores ? "종이 검사 점수(선생님이 넣음)" : "아직 답하지 않았어요 · 관찰이나 종이 검사 점수를 먼저 넣을 수 있어요"}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={() => onMove(-1)} disabled={first} className="btn-sub min-h-10 px-3 text-sm" aria-label="앞 학생">←</button>
          <button onClick={() => onMove(1)} disabled={last} className="btn-sub min-h-10 px-3 text-sm" aria-label="다음 학생">→</button>
          <button onClick={onClose} className="btn-sub min-h-10 px-3 text-sm">닫기</button>
        </div>
      </header>

      {/* 스스로 답한 점수 ↔ 선생님 관찰 */}
      <div className="space-y-3">
        {DOMAINS.map((dom, i) => (
          <div key={dom.key} className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr]">
            <p className="flex items-center gap-1.5 font-bold" style={{ color: dom.color }}><Doodle name={dom.icon} size={20} /> {dom.name}</p>
            <div className="space-y-1 text-sm">
              <Bar tag="학생" score={scores?.[i] ?? null} max={40} color={dom.color} extra={before && scores ? <><span className="text-xs text-soft"> {base?.title} {before[i]}</span><Delta v={scores[i] - before[i]} small /></> : null} />
              <Bar tag="관찰" score={o?.[i] ?? null} max={obs ? obsMax(obs) : 20} color={dom.color} faint />
            </div>
          </div>
        ))}
        {watch.length > 0 && <p className="rounded-2xl bg-[#fff8e1] p-3 text-sm"><Doodle name="dotYellow" /> {watch.join(" / ")}</p>}
      </div>

      {scores && <Guides scores={scores} obs={obs} />}
      {answer && <Answers answers={answer.answers} />}
      <ObsBox round={round} no={st.no} obs={obs} onSaved={onSaved} />
      {!answer && <PaperBox round={round} no={st.no} paper={note?.paper ?? null} onSaved={onSaved} />}
      <MemoBox round={round} no={st.no} memo={note?.memo ?? ""} onSaved={onSaved} />
      <FeedbackBox round={round} no={st.no} note={note} canDraft={!!scores} aiLabel={aiLabel} onSaved={onSaved} />
    </section>
  );
}

function Bar({ tag, score, max, color, faint, extra }: { tag: string; score: number | null; max: number; color: string; faint?: boolean; extra?: React.ReactNode }) {
  const l = score == null ? null : levelOf(score, max);
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
      <span className="text-xs text-soft">{tag}</span>
      <span className="h-3.5 rounded-full bg-[#f1eee7]" aria-hidden>
        {score != null && <span className="block h-full rounded-full" style={{ width: `${(score / max) * 100}%`, background: color, opacity: faint ? 0.55 : 1 }} />}
      </span>
      <span className="min-w-[8.5rem] text-xs tabular-nums">
        {l ? <><span className="rounded-full px-2 py-0.5 font-bold" style={{ color: l.color, background: l.bg }}>{l.name}</span> {score}/{max}{extra}</> : <span className="text-soft">{tag === "관찰" ? "관찰 전" : "–"}</span>}
      </span>
    </div>
  );
}

// 영역별 지도 가이드: 스스로 답한 수준의 현재 모습·지도 방향(도움 필요 영역은 펼쳐 둠). 관찰 수준이 다르면 그 수준의 가이드도 함께.
function Guides({ scores, obs }: { scores: number[]; obs: SelObs | null }) {
  const o = obs ? obsScores(obs) : null;
  return (
    <div className="space-y-2">
      <h4 className="font-display text-lg"><Doodle name="compass" /> 영역별 지도 가이드</h4>
      {DOMAINS.map((dom, i) => {
        const l = levelOf(scores[i]);
        const ol = o && obs ? levelOf(o[i], obsMax(obs)) : null;
        const g = DOMAIN_GUIDE[i];
        return (
          <details key={dom.key} open={l.tier === "low" || ol?.tier === "low"} className="group rounded-2xl border border-line p-3 [&_summary]:cursor-pointer">
            <summary className="flex min-h-10 flex-wrap items-center gap-2 font-bold" style={{ color: dom.color }}>
              {dom.name}
              <span className="rounded-full px-2 py-0.5 text-xs" style={{ color: l.color, background: l.bg }}>스스로 {l.name}</span>
              {ol && <span className="rounded-full px-2 py-0.5 text-xs" style={{ color: ol.color, background: ol.bg }}>관찰 {ol.name}</span>}
              <span className="ml-auto text-sm font-normal text-soft" aria-hidden><span className="group-open:hidden">펼치기 ▾</span><span className="hidden group-open:inline">접기 ▴</span></span>
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              <GuideBody title={`${l.name} 수준 · 현재 모습`} desc={g[l.tier].desc} tips={g[l.tier].tips} />
              {ol && ol.tier !== l.tier && <GuideBody title={`선생님 관찰(${ol.name}) 기준`} desc={g[ol.tier].desc} tips={g[ol.tier].tips} />}
              <p className="rounded-xl bg-leaf-soft p-2 text-xs"><b>마음빛 길잡이에서 함께:</b> <DoodleText text={g.app} /></p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
function GuideBody({ title, desc, tips }: { title: string; desc: string; tips: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-soft">{title}</p>
      <p className="leading-relaxed">{desc}</p>
      <p className="mt-1 text-xs font-bold text-soft">지도 방향 · 지원 활동</p>
      <ul className="list-disc pl-5">{tips.map((t, k) => <li key={k}>{t}</li>)}</ul>
    </div>
  );
}

// 학생이 고른 답(문장마다 1~5). 「그렇지 않아요」 이하는 빨갛게, 「매우 그래요」는 초록으로
function Answers({ answers }: { answers: number[] }) {
  return (
    <details className="rounded-2xl border border-line p-3">
      <summary className="min-h-10 cursor-pointer font-display text-lg"><Doodle name="clipboard" /> 학생이 고른 답 32문장</summary>
      <div className="mt-2 space-y-3">
        {DOMAINS.map((dom, d) => (
          <div key={dom.key}>
            <p className="text-sm font-bold" style={{ color: dom.color }}>{dom.name}</p>
            <ol className="space-y-1" start={d * PER + 1}>
              {SELF_ITEMS.slice(d * PER, d * PER + PER).map((it, k) => {
                const v = answers[d * PER + k];
                return (
                  <li key={k} className="grid gap-x-3 text-sm sm:grid-cols-[1fr_11rem]">
                    <span><span className="text-soft">{d * PER + k + 1}.</span> {it.ko}</span>
                    <span className={`font-bold ${v <= 2 ? "text-alert" : v === 5 ? "text-[#1d7144]" : ""}`}>{"●".repeat(v)}<span className="text-line">{"●".repeat(5 - v)}</span> {SELF_SCALE[v - 1].ko}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </details>
  );
}

function useSave(round: SelfRound, no: number, onSaved: (n: SelNote) => void) {
  const act = useAct();
  const [msg, setMsg] = useState("");
  const save = (fail: string, patch: Record<string, unknown>, ok: string) =>
    act.run(fail, async () => {
      setMsg("");
      const r = await api<{ note: SelNote }>("teacher", "selNote", { round: round.id, no, ...patch });
      onSaved(r.note);
      setMsg(ok);
    });
  return { ...act, msg, save };
}

// 선생님 관찰: 간이(영역마다 4문항) · 심층(영역마다 8문항). 다 골라야 저장된다.
function ObsBox({ round, no, obs, onSaved }: { round: SelfRound; no: number; obs: SelObs | null; onSaved: (n: SelNote) => void }) {
  const [mode, setMode] = useState<16 | 32>(obs?.mode ?? 16);
  const [ans, setAns] = useState<Record<number, number[]>>(() => ({ 16: obs?.mode === 16 ? obs.answers : [], 32: obs?.mode === 32 ? obs.answers : [] }));
  const s = useSave(round, no, onSaved);
  const items = mode === 16 ? OBS16 : OBS32;
  const cur = ans[mode];
  const filled = items.filter((_, i) => cur[i]).length;
  const per = mode / DOMAINS.length;
  const set = (i: number, v: number) => setAns((a) => { const next = [...a[mode]]; next[i] = v; return { ...a, [mode]: next }; });
  return (
    <details className="rounded-2xl border border-line p-3" open={!obs}>
      <summary className="min-h-10 cursor-pointer font-display text-lg"><Doodle name="eyes" /> 선생님 관찰 {obs && <span className="text-sm text-soft">({obs.mode === 32 ? "심층 32" : "간이 16"} 저장됨)</span>}</summary>
      <div className="mt-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="관찰 방식">
          {([16, 32] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`chip min-h-10 px-3 text-sm font-bold ${mode === m ? "chip-on" : ""}`}>{m === 16 ? "간이 16문항" : "심층 32문항"}</button>
          ))}
          <span className="text-xs text-soft">평소 모습을 떠올리며 골라 주세요. 학생 화면에는 보이지 않아요.</span>
        </div>
        {DOMAINS.map((dom, d) => (
          <fieldset key={dom.key} className="space-y-2">
            <legend className="text-sm font-bold" style={{ color: dom.color }}>{dom.name}</legend>
            {items.slice(d * per, d * per + per).map((t, k) => {
              const i = d * per + k;
              return (
                <div key={i} className="grid gap-1.5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <p className="text-sm">{t}</p>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t}>
                    {OBS_SCALE.map((lbl, v) => (
                      <button key={v} role="radio" aria-checked={cur[i] === v + 1} onClick={() => set(i, v + 1)}
                        className={`min-h-10 rounded-xl border px-2.5 text-xs font-bold ${cur[i] === v + 1 ? "border-transparent text-white" : "border-line bg-card"}`}
                        style={cur[i] === v + 1 ? { background: dom.color } : undefined}>{v + 1} {lbl}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-soft">{filled}/{mode} 골랐어요</span>
          {obs && <button onClick={() => s.save("관찰을 지우지 못했어요", { obs: null }, "관찰을 지웠어요.")} disabled={s.busy} className="btn-sub min-h-10 text-sm">관찰 지우기</button>}
          <button onClick={() => s.save("관찰을 저장하지 못했어요", { obs: { mode, answers: items.map((_, i) => cur[i]) } }, "관찰을 저장했어요.")} disabled={s.busy || filled < mode} className="btn-main min-h-10 text-sm">관찰 저장</button>
        </div>
        {s.msg && <p role="status" className="text-right text-sm text-[#1d7144]">{s.msg}</p>}
        {s.err && <p role="alert" className="text-right text-sm text-alert">{s.err}</p>}
      </div>
    </details>
  );
}

// 종이 검사지로 한 학생: 영역별 점수(8~40)를 넣으면 학생 화면에도 그 점수에 맞는 이야기가 보인다
function PaperBox({ round, no, paper, onSaved }: { round: SelfRound; no: number; paper: number[] | null; onSaved: (n: SelNote) => void }) {
  const [vals, setVals] = useState<string[]>(() => DOMAINS.map((_, i) => (paper ? String(paper[i]) : "")));
  const s = useSave(round, no, onSaved);
  const nums = vals.map((v) => Number(v));
  const ok = nums.every((v) => Number.isInteger(v) && v >= 8 && v <= 40);
  return (
    <details className="rounded-2xl border border-line p-3" open={!!paper}>
      <summary className="min-h-10 cursor-pointer font-display text-lg"><Doodle name="page" /> 종이로 한 점수 넣기</summary>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {DOMAINS.map((dom, i) => (
          <label key={dom.key} className="text-sm">
            <span className="block font-bold" style={{ color: dom.color }}>{dom.name}</span>
            <input inputMode="numeric" value={vals[i]} onChange={(e) => setVals((v) => v.map((x, k) => (k === i ? e.target.value.replace(/\D/g, "").slice(0, 2) : x)))} className="field mt-1 min-h-11 w-24 py-2" placeholder="8~40" />
          </label>
        ))}
        {paper && <button onClick={() => s.save("점수를 지우지 못했어요", { paper: null }, "종이 검사 점수를 지웠어요.")} disabled={s.busy} className="btn-sub min-h-11 text-sm">지우기</button>}
        <button onClick={() => s.save("점수를 저장하지 못했어요", { paper: nums }, "종이 검사 점수를 저장했어요.")} disabled={s.busy || !ok} className="btn-main min-h-11 text-sm">저장</button>
      </div>
      <p className="mt-1 text-xs text-soft">영역마다 8문장 점수(1~5)를 더한 값이에요. 학생이 화면에서 답하면 그 답을 먼저 써요.</p>
      {s.msg && <p role="status" className="text-sm text-[#1d7144]">{s.msg}</p>}
      {s.err && <p role="alert" className="text-sm text-alert">{s.err}</p>}
    </details>
  );
}

function MemoBox({ round, no, memo, onSaved }: { round: SelfRound; no: number; memo: string; onSaved: (n: SelNote) => void }) {
  const [text, setText] = useState(memo);
  const s = useSave(round, no, onSaved);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="flex items-center gap-1 font-display text-lg"><Doodle name="lock" /> 선생님만 보는 메모</span>
        <span className="block text-xs text-soft">학생 화면과 AI로 보내지 않아요. 상담 계획, 함께 본 모습 등을 적어 두세요.</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} className="field mt-1" />
      </label>
      <div className="flex items-center justify-end gap-2">
        {s.msg && <span role="status" className="text-sm text-[#1d7144]">{s.msg}</span>}
        {s.err && <span role="alert" className="text-sm text-alert">{s.err}</span>}
        <button onClick={() => s.save("메모를 저장하지 못했어요", { memo: text }, "메모를 저장했어요.")} disabled={s.busy || text === memo} className="btn-sub min-h-10 text-sm">메모 저장</button>
      </div>
    </div>
  );
}

// 학생에게 보낼 말: AI 초안(영역별 수준과 학생이 고른 문장만 보냄) → 고쳐서 보내기. 보내면 학생 「마음 점검」에 보이고, 읽으면 「읽었어요」.
function FeedbackBox({ round, no, note, canDraft, aiLabel, onSaved }: { round: SelfRound; no: number; note: SelNote | null; canDraft: boolean; aiLabel: string; onSaved: (n: SelNote) => void }) {
  const sent = note?.feedback ?? null;
  const [text, setText] = useState(sent?.text ?? "");
  const [drafts, setDrafts] = useState<{ drafts: string[]; warns: string[]; styles: string[][] } | null>(null);
  const drafting = useAct();
  const s = useSave(round, no, onSaved);
  const leaks = [...new Set(text.match(LEAK) ?? [])];
  const draft = () => drafting.run("초안을 만들지 못했어요", async () => {
    const r = await api<{ drafts: string[]; warns: string[]; styles?: string[][] }>("teacher", "selDraft", { round: round.id, no });
    setDrafts({ drafts: r.drafts, warns: r.warns ?? [], styles: r.styles ?? [] });
    if (!text.trim() && r.drafts[0]) setText(r.drafts[0]);
  });
  return (
    <div className="space-y-2 rounded-2xl bg-[#fffaf0] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1 font-display text-lg"><Doodle name="letter" /> 학생에게 보낼 말</h4>
        <button onClick={draft} disabled={!canDraft || drafting.busy} className="btn-sub min-h-10 text-sm">
          {drafting.busy ? "초안 만드는 중…" : drafts ? "다시 만들기" : <><Doodle name="sparkle" /> {aiLabel} 초안</>}
        </button>
      </div>
      <p className="text-xs text-soft">
        보내면 학생 화면 「마음 점검」 맨 위에 「선생님이 보낸 말」로 보여요. 점수·수준 이름은 쓰지 말아 주세요.
        {canDraft ? " AI 초안에는 영역별 수준과 학생이 고른 문장만 보내요(이름·번호·메모는 보내지 않음)." : " 학생 답이 있어야 AI 초안을 만들 수 있어요."}
      </p>
      {drafting.err && <p role="alert" className="text-sm text-alert">{drafting.err}</p>}
      {drafts && drafts.drafts.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {drafts.drafts.map((t, i) => (
            <button key={i} onClick={() => setText(t)} className={`chip p-3 text-left text-sm ${text === t ? "chip-on" : ""}`}>
              <b className="text-xs text-soft">{["잘하는 점 알아주기", "함께 해 볼 일"][i] ?? `초안 ${i + 1}`}</b>
              <span className="mt-1 block">{t}</span>
              {drafts.warns[i] && <span className="mt-1 block text-xs text-alert"><Doodle name="warning" /> 아이에게 맞지 않을 수 있는 말: {drafts.warns[i]}</span>}
              <StyleNote hits={drafts.styles[i]} className="mt-1" />
            </button>
          ))}
        </div>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 600))} rows={4} className="field" placeholder="초안을 고르거나 직접 써 주세요." />
      {leaks.length > 0 && <p className="text-xs text-alert"><Doodle name="warning" /> 「{leaks.join("」, 「")}」 — 학생 화면에는 점수·수준이 보이지 않아요. 보내기 전에 고쳐 주세요.</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {sent && <span className="mr-auto text-xs text-soft">{when(sent.at)}에 보냄 · {unread(note) ? "아직 안 읽었어요" : <b className="text-[#1d7144]">학생이 읽었어요{note?.seenAt ? ` (${when(note.seenAt)})` : ""}</b>}</span>}
        {s.msg && <span role="status" className="text-sm text-[#1d7144]">{s.msg}</span>}
        {s.err && <span role="alert" className="text-sm text-alert">{s.err}</span>}
        {sent && <button onClick={() => s.save("거두지 못했어요", { feedback: null }, "보낸 말을 거뒀어요.")} disabled={s.busy} className="btn-sub min-h-10 text-sm">거두기</button>}
        <button onClick={() => s.save("보내지 못했어요", { feedback: text }, "학생에게 보냈어요.")} disabled={s.busy || !text.trim() || text.trim() === sent?.text} className="btn-main min-h-10 text-sm">
          {sent ? "고쳐서 다시 보내기" : "학생에게 보내기"}
        </button>
      </div>
    </div>
  );
}
