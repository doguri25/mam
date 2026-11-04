"use client";
// 위험 표현 조치 기록: 「살펴봤어요」 때 한 일(여럿 고름)·한 날·짧은 메모를 남기고, 그 뒤에 더 한 일도 같은 기록에 이어 적는다.
// 선생님만 보고 AI에는 보내지 않는다. 학생별 누적 기록·상담 의견서·주간 리포트에 함께 보인다.
import { useState } from "react";
import Doodle from "../Doodle";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { RISK_ACTIONS, RISK_ACTION_KO, type MoodRecord, type RiskAction, type RiskActionKind } from "@/lib/shared";

export const kindsText = (kinds: RiskActionKind[]) => kinds.map((k) => RISK_ACTION_KO[k]).join(" · ");

// 한 일 고르기 + 한 날 + 메모. action: 처음 살펴볼 때 checkAlert(알림이 닫힘), 그 뒤에 더 적을 때 riskAction
export function RiskActionForm({ recordId, today, first, onDone, onCancel }: {
  recordId: string; today: string; first: boolean; onDone: (items: RiskAction[]) => void | Promise<void>; onCancel: () => void;
}) {
  const [kinds, setKinds] = useState<RiskActionKind[]>([]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // 「걱정할 내용이 아니었음」은 다른 일과 함께 고르지 않는다
  const toggle = (k: RiskActionKind) =>
    setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : k === "none" ? ["none"] : [...ks.filter((x) => x !== "none"), k]));

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ riskActions: RiskAction[] }>("teacher", first ? "checkAlert" : "riskAction", first ? { id: recordId, kinds, date, note } : { recordId, kinds, date, note });
      await onDone(r.riskActions);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
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
      {err && <p role="alert" className="text-sm text-alert">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-sub min-h-10 text-sm">취소</button>
        <button type="button" onClick={save} disabled={!kinds.length || busy} className="btn-main min-h-10 text-sm">
          {busy ? "남기는 중…" : first ? "기록하고 알림 닫기" : "더 적기"}
        </button>
      </div>
    </div>
  );
}

// 한 학생의 위험 표현과 조치: 기록마다 한 일을 날짜순으로, 「조치 더 적기」로 이어 적는다
export function RiskHistory({ records, actions, today, onChange, print }: {
  records: MoodRecord[]; actions: RiskAction[]; today: string; onChange: (items: RiskAction[]) => void | Promise<void>; print?: boolean;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // 기록은 보관 기한이 지나 지웠어도 조치 기록은 남아 있을 수 있다
  const ids = [...new Set([...records.filter((r) => r.risk).map((r) => r.id), ...actions.map((a) => a.recordId)])];
  const items = ids
    .map((id) => ({ id, rec: records.find((r) => r.id === id), acts: actions.filter((a) => a.recordId === id) }))
    .sort((a, b) => (b.rec?.date ?? b.acts[0]?.recordDate ?? "").localeCompare(a.rec?.date ?? a.acts[0]?.recordDate ?? ""));
  if (!items.length) return <p className="text-sm text-soft">위험 표현이 들어온 적이 없어요.</p>;

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
      {items.map(({ id, rec, acts }) => (
        <li key={id} className="rounded-2xl border border-alert/40 bg-alert-soft/50 p-3">
          <p className="text-sm">
            <b>{label(rec?.date ?? acts[0].recordDate)}</b>
            {rec && <> {rec.slot === "am" ? "아침" : "하교 전"} · {rec.emotion}</>}
            {rec && (rec.summaryKo || rec.summary || rec.answer) && <span className="block">“{[rec.summaryKo || rec.summary, rec.answer].filter(Boolean).join(" / ")}”</span>}
            {rec && <span className="block text-xs text-soft">{rec.riskHits.length ? `걸린 말: ${rec.riskHits.join(", ")}` : "AI가 위험 내용으로 판단"}</span>}
          </p>
          {acts.length ? (
            <ol className="mt-2 space-y-1.5 border-l-2 border-leaf/40 pl-3">
              {acts.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-bold text-leaf">{label(a.date)}</span> {kindsText(a.kinds)}
                  {a.note && <span className="block text-soft">{a.note}</span>}
                  {!print && <button onClick={() => remove(a)} className="no-print ml-1 text-xs text-soft underline underline-offset-2">지우기</button>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm font-bold text-alert">{rec?.riskChecked ? "살펴봄(한 일은 적지 않음)" : "아직 살펴보지 않았어요"}</p>
          )}
          {!print && (adding === id ? (
            <div className="no-print mt-2">
              <RiskActionForm recordId={id} today={today} first={!rec?.riskChecked && !acts.length && !!rec} onCancel={() => setAdding(null)} onDone={async (x) => { setAdding(null); await onChange(x); }} />
            </div>
          ) : (
            <button onClick={() => setAdding(id)} className="no-print btn-sub mt-2 min-h-9 px-3 text-sm"><Doodle name="memo" /> {acts.length || rec?.riskChecked ? "조치 더 적기" : "살펴보고 적기"}</button>
          ))}
        </li>
      ))}
    </ul>
  );
}
