"use client";
// 위험 표현 조치 기록: 「살펴봤어요」 때 한 일(여럿 고름)·한 날·짧은 메모를 남기고, 그 뒤에 더 한 일도 같은 기록에 이어 적는다.
// 선생님만 보고 AI에는 보내지 않는다. 학생별 누적 기록·상담 의견서·주간 리포트에 함께 보인다.
// 살펴보는 것: 마음 기록 · 마치지 않은 기록(draft:) · 한 주 돌아보기(reflect:) · 공감 쪽지(letter:)
import { useState } from "react";
import Doodle from "../Doodle";
import PrevList from "./PrevList";
import { KIND_KO, draftText, everRisk, kindOfId, recordSeen, reflectEverRisk, reflectSource, riskySource, type RiskKind } from "./alerts";
import type { NameOf } from "./types";
import { kday } from "./when";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { RISK_ACTIONS, RISK_ACTION_KO, type Letter, type MoodRecord, type Reflect, type RiskAction, type RiskActionKind, type RiskDraft } from "@/lib/shared";

export const kindsText = (kinds: RiskActionKind[]) => kinds.map((k) => RISK_ACTION_KO[k]).join(" · ");
export const STALE_MSG = "학생이 그사이 새로 남겼어요. 바뀐 글을 읽고 다시 눌러 주세요.";

// 한 일 고르기 + 한 날 + 메모. action: 처음 살펴볼 때 checkAlert(알림이 닫힘), 그 뒤에 더 적을 때 riskAction
// seen·text: 선생님이 보고 있는 글의 판과 그 글. 폼을 연 때 것으로 묶어 둔다(20초마다 새 기록이 들어와도 바꾸지 않음).
// 그사이 학생이 고쳐 썼으면 서버가 닫지 않고(409) → 고른 일·메모는 그대로 두고 알린 뒤 onStale로 새 글을 불러온다.
// 그다음 선생님이 다시 누를 때에만 그때 화면의 새 판으로 닫는다.
export function RiskActionForm({ recordId, today, first, seen, text, kind, onDone, onCancel, onStale }: {
  recordId: string; today: string; first: boolean; seen?: string; text?: string; kind?: RiskKind;
  onDone: (items: RiskAction[]) => void | Promise<void>; onCancel: () => void; onStale?: () => void | Promise<void>;
}) {
  const [kinds, setKinds] = useState<RiskActionKind[]>([]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [base, setBase] = useState({ seen, text }); // 폼을 연 때 본 판
  const [stale, setStale] = useState(false); // 서버가 「그사이 바뀜」이라고 돌려보낸 뒤
  // 「걱정할 내용이 아니었음」은 다른 일과 함께 고르지 않는다
  const toggle = (k: RiskActionKind) =>
    setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : k === "none" ? ["none"] : [...ks.filter((x) => x !== "none"), k]));

  async function save() {
    // 바뀐 글을 불러온 뒤 다시 누른 것이면 지금 화면의 판을 받아들인다
    const v = stale ? { seen, text } : base;
    if (stale) {
      setBase(v);
      setStale(false);
    }
    setBusy(true);
    setErr("");
    const what = { kinds, date, note, kind: kind ?? kindOfId(recordId), ...(v.text ? { text: v.text } : {}) };
    try {
      const r = first
        ? await api<{ riskActions: RiskAction[] }>("teacher", "checkAlert", { id: recordId, ...what, ...(v.seen ? { seen: v.seen } : {}) })
        : await api<{ riskActions: RiskAction[] }>("teacher", "riskAction", { recordId, ...what });
      await onDone(r.riskActions);
    } catch (e) {
      setBusy(false);
      if ((e as { status?: number }).status === 409) {
        setStale(true);
        setErr(STALE_MSG);
        await onStale?.(); // 새 글을 화면에 불러온다(고른 일·메모는 그대로)
      } else setErr((e as Error).message);
    }
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-line bg-card p-3">
      <p className="text-sm font-bold">{first ? "어떻게 살펴봤나요? (여럿 고를 수 있어요)" : "그 뒤에 더 한 일"}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="한 일">
        {RISK_ACTIONS.map((k) => (
          <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={kinds.includes(k)}
            className={`chip min-h-10 px-3 text-sm ${kinds.includes(k) ? "border-leaf bg-leaf-soft font-bold text-leaf" : ""}`}>
            {kinds.includes(k) && "✓ "}{RISK_ACTION_KO[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="text-sm">
          <span className="text-soft">한 날</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="field mt-1 min-h-10 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="text-soft">메모 (선생님만 봐요 · AI에는 보내지 않아요)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} className="field mt-1" placeholder="예: 쉬는 시간에 따로 이야기 나눔. 집에서도 지켜보기로 보호자와 약속" />
        </label>
      </div>
      {err && <p role="alert" className={`text-sm ${stale ? "rounded-xl bg-alert-soft px-3 py-2 font-bold" : ""} text-alert`}>{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-sub min-h-10 text-sm">취소</button>
        <button type="button" onClick={save} disabled={!kinds.length || busy} className="btn-main min-h-10 text-sm">
          {busy ? "남기는 중…" : !first ? "더 적기" : stale ? "바뀐 글을 읽었어요 · 기록하고 알림 닫기" : "기록하고 알림 닫기"}
        </button>
      </div>
    </div>
  );
}

// 한 학생의 위험 표현 하나(마음 기록·마치지 않은 기록·돌아보기·쪽지)와 그에 대한 조치들
export interface RiskItem {
  id: string; // 조치 기록의 recordId
  kind: RiskKind;
  no: number;
  date: string;
  at: string;
  rec?: MoodRecord; draft?: RiskDraft; ref?: Reflect; letter?: Letter;
  text: string; // 위험 표현이 있던 글(지워졌으면 조치 기록에 남은 글)
  nowText?: string; // 위험 표현이 고쳐 쓰기 전 글에 있었으면 지금 글(돌아보기)
  saw: string; // 조치 기록에 남길 「선생님이 본 글」(고치기 전 글이면 그렇다고 붙여서)
  first: boolean; // 아직 살펴보지 않음 → 「살펴보고 적기」가 알림을 닫는다
  checked: boolean;
  seen?: string;
  acts: RiskAction[];
}

export interface RiskSources {
  records: MoodRecord[]; actions: RiskAction[]; drafts?: RiskDraft[]; reflects?: Reflect[]; letters?: Letter[]; words?: string[];
}

// 기록은 보관 기한이 지나 지웠어도 조치 기록은 남아 있을 수 있다 → 조치 기록만 있는 것도 넣는다(글은 조치 기록에 남긴 것)
export function riskItems({ records, actions, drafts = [], reflects = [], letters = [], words = [] }: RiskSources): RiskItem[] {
  const acts = (id: string) => actions.filter((a) => a.recordId === id);
  const out: RiskItem[] = [];
  // 지금 글이 아니어도 고치기 전 글에 위험 표현이 있었으면 보인다
  for (const r of records.filter(everRisk)) {
    const src = riskySource(r);
    out.push({
      id: r.id, kind: "record", no: r.no, date: r.date, at: r.createdAt, rec: r, text: src.text, saw: src.prev ? `고치기 전 글: ${src.text}` : src.text,
      first: r.risk && !r.riskChecked, checked: !!r.riskChecked, seen: recordSeen(r), acts: acts(r.id),
    });
  }
  for (const d of drafts) {
    const id = `draft:${d.id}`;
    out.push({ id, kind: "draft", no: d.no, date: d.date, at: d.at, draft: d, text: draftText(d), saw: draftText(d), first: !d.checked, checked: !!d.checked, seen: d.at, acts: acts(id) });
  }
  for (const x of reflects.filter(reflectEverRisk)) {
    const id = `reflect:${x.id}`;
    const src = reflectSource(x, words);
    out.push({
      id, kind: "reflect", no: x.no, date: kday(x.createdAt), at: x.createdAt, ref: x, text: src.text,
      ...(src.prev ? { nowText: x.text, saw: `고쳐 쓰기 전 글: ${src.text}` } : { saw: src.text }),
      first: !!x.risk && !x.riskChecked, checked: !!x.riskChecked, seen: x.createdAt, acts: acts(id),
    });
  }
  for (const l of letters.filter((l) => l.risk)) {
    const id = `letter:${l.id}`;
    out.push({ id, kind: "letter", no: l.from, date: kday(l.createdAt), at: l.createdAt, letter: l, text: l.text, saw: l.text, first: !l.riskChecked, checked: !!l.riskChecked, seen: l.createdAt, acts: acts(id) });
  }
  const have = new Set(out.map((x) => x.id));
  for (const id of new Set(actions.map((a) => a.recordId))) {
    if (have.has(id)) continue;
    const as = acts(id);
    const text = [...as].reverse().find((a) => a.text)?.text ?? "";
    out.push({ id, kind: as.find((a) => a.kind)?.kind ?? kindOfId(id), no: as[0].no, date: as[0].recordDate, at: as[0].createdAt, text, saw: text, first: false, checked: true, acts: as });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}

const LETTER_STATUS: Record<Letter["status"], string> = { wait: "허락을 기다려요", ok: "전했어요", no: "돌려보냈어요" };

// 한 학생의 위험 표현과 조치: 위험 표현마다 한 일을 날짜순으로, 「조치 더 적기」로 이어 적는다
// onStale: 「살펴봤어요」 때 그사이 학생이 고쳐 썼다고 서버가 알리면 새 글을 다시 불러온다
export function RiskHistory({ today, onChange, onStale, print, nameOf, ...src }: RiskSources & {
  today: string; onChange: (items: RiskAction[]) => void | Promise<void>; onStale?: () => void | Promise<void>; print?: boolean; nameOf?: NameOf;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const items = riskItems(src);
  if (!items.length) return <p className="text-sm text-soft">위험 표현이 들어온 적이 없어요.</p>;
  const who = (no: number) => `${no}번${nameOf ? ` ${nameOf(no)}` : ""}`;

  async function remove(a: RiskAction) {
    if (!confirm(`${label(a.date)} 「${kindsText(a.kinds)}」 조치 기록을 지울까요? 되돌릴 수 없어요.`)) return;
    setErr("");
    try {
      const r = await api<{ riskActions: RiskAction[] }>("teacher", "riskActionDelete", { id: a.id });
      await onChange(r.riskActions);
    } catch (e) {
      setErr(`지우지 못했어요: ${(e as Error).message}`);
    }
  }

  return (
    <ul className="space-y-3">
      {err && <li role="alert" className="text-sm text-alert">{err}</li>}
      {items.map((it) => {
        const { id, rec, draft, ref, letter, acts } = it;
        const hits = rec ? riskySource(rec).hits : draft?.hits;
        return (
          <li key={id} className="rounded-2xl border border-alert/40 bg-alert-soft/50 p-3">
            <p className="text-sm">
              <b>{label(it.date)}</b>{" "}
              {rec ? <>{rec.slot === "am" ? "아침" : "하교 전"} · {rec.emotion}</>
                : draft ? <>{draft.slot === "am" ? "아침" : "하교 전"} · 마치지 않은 기록</>
                : letter ? <>공감 쪽지 → {who(letter.to)} <span className="text-xs text-soft">· {LETTER_STATUS[letter.status]}</span></>
                : KIND_KO[it.kind]}
              {rec && (() => {
                const s = riskySource(rec);
                return s.text && <span className="block">{s.prev && <span className="font-bold text-alert">고치기 전 글 </span>}“{s.text}”</span>;
              })()}
              {!rec && it.nowText !== undefined && (
                <>
                  <span className="block"><span className="font-bold text-alert">고쳐 쓰기 전 글 </span>“{it.text}”</span>
                  <span className="block text-xs text-soft">지금 글: “{it.nowText}”</span>
                </>
              )}
              {!rec && it.nowText === undefined && it.text && <span className="block">“{it.text}”</span>}
              {!rec && !draft && !ref && !letter && it.kind !== "record" && <span className="block text-xs text-soft">글은 지금 없고 살펴볼 때 남긴 글이에요.</span>}
              {(rec || draft) && <span className="block text-xs text-soft">{hits?.length ? `걸린 말: ${hits.join(", ")}` : "AI가 위험 내용으로 판단"}</span>}
            </p>
            {draft?.earlier?.length ? (
              <ul className="mt-1 space-y-0.5 text-xs">
                {draft.earlier.map((e) => <li key={e.at} className="text-alert">앞서 쓴 글: “{e.text}”{e.hits.length > 0 && <span className="text-soft"> · 걸린 말: {e.hits.join(", ")}</span>}</li>)}
              </ul>
            ) : null}
            {rec && !print && <PrevList prev={rec.prev} now={rec.createdAt} />}
            {it.first && acts.length > 0 && <p className="mt-2 text-sm font-bold text-alert">새 위험 표현 · 아직 살펴보지 않았어요</p>}
            {acts.length ? (
              <ol className="mt-2 space-y-1.5 border-l-2 border-leaf/40 pl-3">
                {acts.map((a) => (
                  <li key={a.id} className="text-sm">
                    <span className="font-bold text-leaf">{label(a.date)}</span> {kindsText(a.kinds)}
                    {a.note && <span className="block text-soft">{a.note}</span>}
                    {/* 살펴볼 때 본 글이 지금 글과 다르면(그 뒤에 고쳐 씀) 함께 보인다 */}
                    {a.text && a.text !== it.saw && a.text !== it.text && <span className="block text-xs text-soft">살펴본 글: “{a.text}”</span>}
                    {!print && <button onClick={() => remove(a)} className="no-print ml-1 text-xs text-soft underline underline-offset-2">지우기</button>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm font-bold text-alert">{it.checked ? "살펴봄(한 일은 적지 않음)" : "아직 살펴보지 않았어요"}</p>
            )}
            {!print && (adding === id ? (
              <div className="no-print mt-2">
                <RiskActionForm recordId={id} kind={it.kind} today={today} first={it.first} seen={it.seen} text={it.saw}
                  onCancel={() => setAdding(null)} onStale={onStale} onDone={async (x) => { setAdding(null); await onChange(x); }} />
              </div>
            ) : (
              <button onClick={() => setAdding(id)} className="no-print btn-sub mt-2 min-h-9 px-3 text-sm"><Doodle name="memo" /> {it.first ? "살펴보고 적기" : "조치 더 적기"}</button>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
