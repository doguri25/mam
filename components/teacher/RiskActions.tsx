"use client";
// 위험 표현 조치 기록: 「살펴봤어요」 때 한 일(여럿 고름)·한 날·짧은 메모를 남기고, 그 뒤에 더 한 일도 같은 기록에 이어 적는다.
// 선생님만 보고 AI에는 보내지 않는다. 학생별 누적 기록·상담 의견서·주간 리포트에 함께 보인다.
// 살펴보는 것: 마음 기록 · 마치지 않은 기록(draft:) · 한 주 돌아보기(reflect:) · 공감 쪽지(letter:)
import { useState } from "react";
import Doodle from "../Doodle";
import PrevList from "./PrevList";
import { KIND_KO, PART_SEP, draftText, everRisk, kindOfId, partLabel, partsText, recordSeen, reflectEverRisk, reflectSource, riskyParts, riskySource, splitParts, type RiskKind, type RiskPart } from "./alerts";
import type { NameOf } from "./types";
import { kday, ktime } from "./when";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { RISK_ACTIONS, RISK_ACTION_KO, type Letter, type MoodRecord, type Reflect, type RiskAction, type RiskActionKind, type RiskDraft } from "@/lib/shared";

export const kindsText = (kinds: RiskActionKind[]) => kinds.map((k) => RISK_ACTION_KO[k]).join(" · ");
export const STALE_MSG = "학생이 그사이 새로 남겼어요. 바뀐 글을 읽고 다시 눌러 주세요.";
export const MOVED_MSG = "학생이 그 글로 기록을 마쳤어요. 고른 일과 메모를 이 마음 기록 알림으로 옮겨 왔어요. 기록을 읽고 다시 눌러 주세요.";

const hitsText = (hits: string[]) => (hits.length ? `걸린 말: ${hits.join(", ")}` : "AI가 위험 내용으로 판단");
// 위험 표현이 있던 글. 한 글이면 예전처럼 글 한 줄(고치기 전 글이면 그렇게)과 걸린 말.
// 두 글 이상이면 「먼저 쓴 글 · 09:00」「다시 쓴 글 · 09:05」로 한 줄씩 나누고 걸린 말도 그 글의 것만(「 / 」로 이으면 한 줄과 답 사이와 헷갈림).
// fresh: 아직 살펴보지 않은 판(누적 기록에서 그날 다른 위험한 글과 함께 보일 때 알림이 가리키는 판에 「새 글」)
// hits: 글이 없을 때(판이 정리되어 남지 않음) 보일 걸린 말
export function RiskTexts({ parts, hits = [], fresh = [] }: { parts: RiskPart[]; hits?: string[]; fresh?: string[] }) {
  if (!parts.length) return <span className="block text-xs text-soft">{hitsText(hits)}</span>;
  if (parts.length === 1) {
    const p = parts[0];
    return (
      <>
        <span className="block text-sm">{!p.now && <span className="font-bold text-alert">고치기 전 글에 위험 표현 </span>}“{p.text}”</span>
        <span className="block text-xs text-soft">{hitsText(p.hits)}</span>
      </>
    );
  }
  return (
    <span className="mt-1 block space-y-1">
      {!parts.some((p) => p.now) && <span className="block text-xs font-bold text-alert">고치기 전 글에 위험 표현</span>}
      {parts.map((p, i) => (
        <span key={`${p.at}-${i}`} className="block border-l-2 border-alert/50 pl-2 text-sm">
          <span className="block text-xs font-bold text-alert">
            {partLabel(i, parts.length, p.now)}{ktime(p.at) && <span className="tabular-nums"> · {ktime(p.at)}</span>}
            {fresh.includes(p.at) && <span className="ml-1 rounded bg-alert px-1 font-normal text-white">새 글</span>}
          </span>
          “{p.text}”
          <span className="block text-xs text-soft">{hitsText(p.hits)}</span>
        </span>
      ))}
    </span>
  );
}
// 조치 기록에 남은 글(살펴본 그때의 글). 여러 글이면(「 ‖ 」로 이어 남김) 한 줄씩
function SawText({ text }: { text: string }) {
  if (!text.includes(PART_SEP)) return <span className="block text-xs text-soft">살펴본 글: “{text}”</span>;
  return (
    <span className="block text-xs text-soft">
      살펴본 글:
      {splitParts(text).map((t, i) => <span key={i} className="block pl-2">{t}</span>)}
    </span>
  );
}

// 폼에 고른 것(그사이 바뀌어 다시 불러올 때 잃지 않게 밖으로 넘긴다). msg: 새 폼에 처음 띄울 말
export interface FormState { kinds: RiskActionKind[]; date: string; note: string; msg?: string }
// 폼마다 하나: 같은 폼에서 다시 눌러도 서버가 같은 조치 기록을 고쳐 쓴다(두 번 남지 않음)
const newOp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// 마치지 않은 글(draft:칸)을 살펴보는 사이 학생이 그 글로 기록을 마치면 그 알림은 없어지고 같은 칸(번호·날·때)의 마음 기록 알림이 생긴다.
// 정리하는 사이 정오를 넘겼으면 기록은 같은 날 다른 때(아침 ↔ 하교 전)에 저장되므로 그 칸도 찾는다.
// 열어 둔 폼을 그 마음 기록으로 옮길 id(옮길 것이 없으면 그대로)
export function movedTo(open: string | null, ids: string[]): string | null {
  if (!open?.startsWith("draft:") || ids.includes(open)) return open;
  const same = open.slice(6);
  const other = same.replace(/_(am|pm)$/, (_, s: string) => (s === "am" ? "_pm" : "_am"));
  return ids.includes(same) ? same : ids.includes(other) ? other : open;
}

// 한 일 고르기 + 한 날 + 메모. action: 처음 살펴볼 때 checkAlert(알림이 닫힘), 그 뒤에 더 적을 때 riskAction
// seen·text: 선생님이 보고 있는 글의 판과 그 글. 폼을 연 때 것으로 묶어 둔다(20초마다 새 기록이 들어와도 바꾸지 않음).
// 그사이 학생이 고쳐 썼으면 서버가 닫지 않고(409) → 고른 일·메모는 그대로 두고 알린 뒤 onStale로 새 글을 불러온다.
// 그다음 선생님이 다시 누를 때에만 그때 화면의 새 판으로 닫는다.
// init: 앞 폼에서 옮겨 온 고른 일·한 날·메모(마치지 않은 글 → 마음 기록). onStale은 고른 것을 함께 받는다.
// 조치 기록에 남는 글은 서버가 그 위험 표현의 글에서 골라 남긴다(화면이 보내는 글을 믿지 않음).
export function RiskActionForm({ recordId, today, first, seen, text, kind, init, onDone, onCancel, onStale }: {
  recordId: string; today: string; first: boolean; seen?: string; text?: string; kind?: RiskKind; init?: FormState | null;
  onDone: (items: RiskAction[]) => void | Promise<void>; onCancel: () => void; onStale?: (st: FormState) => void | Promise<void>;
}) {
  const [kinds, setKinds] = useState<RiskActionKind[]>(init?.kinds ?? []);
  const [date, setDate] = useState(init?.date ?? today);
  const [note, setNote] = useState(init?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(init?.msg ?? "");
  const [base, setBase] = useState({ seen, text }); // 폼을 연 때 본 판
  const [stale, setStale] = useState(!!init?.msg); // 서버가 「그사이 바뀜」이라고 돌려보낸 뒤(옮겨 온 폼도 새 글을 읽고 누르는 것)
  const [op] = useState(newOp);
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
    const what = { kinds, date, note, kind: kind ?? kindOfId(recordId), opId: op };
    try {
      const r = first
        ? await api<{ riskActions: RiskAction[] }>("teacher", "checkAlert", { id: recordId, ...what, ...(v.seen ? { seen: v.seen } : {}) })
        : await api<{ riskActions: RiskAction[] }>("teacher", "riskAction", { recordId, ...what });
      await onDone(r.riskActions);
    } catch (e) {
      setBusy(false);
      // 409 = 그사이 바뀜(새로 씀 · 그 글로 기록을 마침), 404 = 그 글이 없어짐(지움·정리) → 까닭을 보이고 새로 읽는다
      const st = (e as { status?: number }).status;
      if (st === 409 || st === 404) {
        setStale(true);
        setErr((e as Error).message || STALE_MSG); // 서버가 알려 준 까닭 그대로
        await onStale?.({ kinds, date, note }); // 새 글을 화면에 불러온다(고른 일·메모는 그대로 · 폼이 옮겨 가면 함께)
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
  text: string; // 위험 표현이 있던 글(지워졌으면 조치 기록에 남은 글 · 쪽지는 학생이 처음 쓴 글)
  nowText?: string; // 위험 표현이 고쳐 쓰기 전 글에 있었으면 지금 글(돌아보기) · 선생님이 다듬어 전한 쪽지면 전한 글
  saw: string; // 조치 기록에 남길 「선생님이 본 글」(고치기 전 글이면 그렇다고 붙여서)
  parts?: RiskPart[]; // 마음 기록: 그 칸에 위험 표현이 있던 글 모두(만든 차례대로)
  fresh?: string[]; // 마음 기록: 그중 열린 알림이 가리키는 판(다른 위험한 글과 함께 보일 때 「새 글」)
  src?: string; // 마음 기록: 알림이 가리키는 글(조치 기록에 남는 글과 견주려고)
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
  // 누적 기록에는 그 칸에 위험 표현이 있던 글을 모두 보인다(살펴본 뒤 순한 글로 다시 남겨 알림이 가리키던 판이 지워져도 하나만 남지 않게).
  // 알림이 열려 있고 그 밖에 이미 살펴본 위험한 글도 있으면 알림이 가리키는 글에 「새 글」을 붙인다.
  for (const r of records.filter(everRisk)) {
    const src = riskySource(r);
    const all = riskyParts(r);
    const parts = all.length ? all : src.parts;
    const first = r.risk && !r.riskChecked;
    const fresh = first && parts.length > src.parts.length ? src.parts.map((p) => p.at) : [];
    out.push({
      id: r.id, kind: "record", no: r.no, date: r.date, at: r.createdAt, rec: r, text: partsText(parts), parts, fresh, src: src.text,
      saw: src.prev ? `고치기 전 글: ${src.text}` : src.text, first, checked: !!r.riskChecked, seen: recordSeen(r), acts: acts(r.id),
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
  // 쪽지는 학생이 처음 쓴 글(위험 표현이 있던 글)을 앞에 — 선생님이 다듬어 전했으면 전한 글은 따로
  for (const l of letters.filter((l) => l.risk)) {
    const id = `letter:${l.id}`;
    const src = l.original ?? l.text;
    out.push({
      id, kind: "letter", no: l.from, date: kday(l.createdAt), at: l.createdAt, letter: l, text: src, ...(l.original ? { nowText: l.text } : {}), saw: src,
      first: !l.riskChecked, checked: !!l.riskChecked, seen: l.createdAt, acts: acts(id),
    });
  }
  const have = new Set(out.map((x) => x.id));
  for (const id of new Set(actions.map((a) => a.recordId))) {
    if (have.has(id)) continue;
    const as = acts(id);
    const text = [...as].reverse().find((a) => a.text)?.text ?? "";
    // recordDate가 없던 예전 조치 기록은 한 날로(없으면 날짜 정렬이 깨진다)
    out.push({ id, kind: as.find((a) => a.kind)?.kind ?? kindOfId(id), no: as[0].no, date: as[0].recordDate || as[0].date, at: as[0].createdAt, text, saw: text, first: false, checked: true, acts: as });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}

const LETTER_STATUS: Record<Letter["status"], string> = { wait: "허락을 기다려요", ok: "전했어요", no: "돌려보냈어요" };
// 쪽지 조치 기록의 글 앞머리(「3번 → 4번: 」)는 빼고 견준다
const bare = (t: string) => t.replace(/^\d+번 → \d+번: /, "");

// 한 학생의 위험 표현과 조치: 위험 표현마다 한 일을 날짜순으로, 「조치 더 적기」로 이어 적는다
// onStale: 「살펴봤어요」 때 그사이 학생이 고쳐 썼다고 서버가 알리면 새 글을 다시 불러온다
export function RiskHistory({ today, onChange, onStale, print, nameOf, ...src }: RiskSources & {
  today: string; onChange: (items: RiskAction[]) => void | Promise<void>; onStale?: () => void | Promise<void>; print?: boolean; nameOf?: NameOf;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [carry, setCarry] = useState<FormState | null>(null); // 그사이 바뀌어 다시 불러올 때 고른 것(폼이 옮겨 가도 잃지 않게)
  const [err, setErr] = useState("");
  const items = riskItems(src);
  if (!items.length) return <p className="text-sm text-soft">위험 표현이 들어온 적이 없어요.</p>;
  const open = movedTo(adding, items.map((x) => x.id));
  const close = () => { setAdding(null); setCarry(null); };
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
        // 살펴볼 때 남긴 글이 지금 보이는 글과 같으면 다시 보이지 않는다
        const shown = [it.text, it.nowText, bare(it.saw), it.src];
        return (
          <li key={id} className="rounded-2xl border border-alert/40 bg-alert-soft/50 p-3">
            <p className="text-sm">
              <b>{label(it.date)}</b>{" "}
              {rec ? <>{rec.slot === "am" ? "아침" : "하교 전"} · {rec.emotion}</>
                : draft ? <>{draft.slot === "am" ? "아침" : "하교 전"} · 마치지 않은 기록</>
                : letter ? <>공감 쪽지 → {who(letter.to)} <span className="text-xs text-soft">· {LETTER_STATUS[letter.status]}</span></>
                : KIND_KO[it.kind]}
              {rec && <RiskTexts parts={it.parts ?? []} hits={riskySource(rec).hits} fresh={it.fresh} />}
              {!rec && it.nowText !== undefined && (
                <>
                  <span className="block"><span className="font-bold text-alert">{letter ? "처음 쓴 글 " : "고쳐 쓰기 전 글 "}</span>“{it.text}”</span>
                  <span className="block text-xs text-soft">{letter ? "선생님이 다듬어 전한 글" : "지금 글"}: “{it.nowText}”</span>
                </>
              )}
              {!rec && it.nowText === undefined && it.text && (it.text.includes(PART_SEP)
                ? splitParts(it.text).map((t, i) => <span key={i} className="block">{t}</span>)
                : <span className="block">“{it.text}”</span>)}
              {letter?.toPractice && <span className="block text-xs text-soft">받을 학생이 명단에서 빠져(연습용 학생) 전할 수 없어요.</span>}
              {!rec && !draft && !ref && !letter && (it.kind !== "record" || it.text) && <span className="block text-xs text-soft">글은 지금 없고 살펴볼 때 남긴 글이에요.</span>}
              {draft && <span className="block text-xs text-soft">{hitsText(draft.hits)}</span>}
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
                    {/* 살펴볼 때 남긴 글이 지금 보이는 글과 다르면(그 뒤에 고쳐 씀) 함께 보인다. 쪽지의 「3번 → 4번:」 앞머리는 빼고 견준다 */}
                    {a.text && !shown.includes(bare(a.text)) && <SawText text={bare(a.text)} />}
                    {!print && <button onClick={() => remove(a)} className="no-print ml-1 text-xs text-soft underline underline-offset-2">지우기</button>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm font-bold text-alert">{it.checked ? "살펴봄(한 일은 적지 않음)" : "아직 살펴보지 않았어요"}</p>
            )}
            {!print && (open === id ? (
              <div className="no-print mt-2">
                {/* 마치지 않은 글에서 옮겨 온 폼이면 고른 것을 그대로 가져온다 */}
                <RiskActionForm recordId={id} kind={it.kind} today={today} first={it.first} seen={it.seen} text={it.saw}
                  init={id !== adding && carry ? { ...carry, msg: MOVED_MSG } : null}
                  onCancel={close} onStale={async (st) => { setCarry(st); await onStale?.(); }} onDone={async (x) => { close(); await onChange(x); }} />
              </div>
            ) : (
              <button onClick={() => { setAdding(id); setCarry(null); }} className="no-print btn-sub mt-2 min-h-9 px-3 text-sm"><Doodle name="memo" /> {it.first ? "살펴보고 적기" : "조치 더 적기"}</button>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
