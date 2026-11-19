"use client";
// 학생 한 명 자료 지우기(보호자가 지워 달라고 할 때): 학생 고르기 → 지울 자료 보기 → 확인하고 지우기. 지운 자료는 되살릴 수 없다.
// 명단에 있는 학생이면 그 학생 것만(번호를 새 학생에게 주기 전 앞 학생 것은 남는다), 명단에서 뺀 번호면 그 번호로 남은 것 모두.
import { useState } from "react";
import Doodle from "../Doodle";
import { api } from "@/lib/api";
import type { WipeCounts } from "@/lib/data";
import type { Overview, Reload } from "./types";

type Peek = { counts: WipeCounts; held: number; onRoster: boolean };
const KO: [keyof WipeCounts, string, string][] = [
  ["records", "마음 기록", "개"], ["drafts", "마치지 않은 기록", "개"], ["reflects", "한 주 돌아보기", "개"], ["letters", "공감 쪽지", "통"],
  ["cheers", "응원 한마디", "개"], ["notes", "면담 메모", "개"], ["self", "역량 진단 답·관찰", "개"], ["sheets", "활동지 피드백", "회"],
  ["actions", "위험 표현 조치 기록", "개"], ["look", "마음 친구 모습", ""],
];

export default function WipeStudent({ data, reload, name }: { data: Overview; reload: Reload; name: (no: number, alias: string) => string }) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<{ no: number; alias: string }[]>([]);
  const [no, setNo] = useState<number | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = new Set(data.students.map((s) => s.no));
  const gone = left.filter((x) => !current.has(x.no));

  const loadLeft = () =>
    api<{ left: { no: number; alias: string }[] }>("teacher", "wipeTargets").then((r) => setLeft(r.left)).catch(() => setLeft([]));
  const toggle = () => {
    setOpen(!open);
    if (!open) loadLeft();
  };
  // 고를 때마다 지울 자료를 다시 본다(다른 학생 것을 보고 지우지 않게)
  const pick = async (n: number | null) => {
    setNo(n);
    setPeek(null);
    setSure(false);
    setMsg(null);
    if (n == null) return;
    setBusy(true);
    try {
      setPeek(await api<Peek>("teacher", "wipeStudent", { no: n, dry: true }));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  };
  const wipe = async () => {
    if (no == null || !peek) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("teacher", "wipeStudent", { no, dry: false, seen: peek.counts });
      setMsg({ ok: true, text: `${no}번 학생 자료를 지웠어요.` });
      setPeek(null);
      setSure(false);
      setNo(null);
      loadLeft();
      await reload();
    } catch (e) {
      // 그사이 자료가 바뀌었으면 서버가 새로 센 것을 보여 주고 다시 확인하게
      const body = (e as { body?: Partial<Peek> }).body;
      if (body?.counts) setPeek({ counts: body.counts, held: body.held ?? 0, onRoster: !!body.onRoster });
      setSure(false);
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  };
  const total = peek ? Object.values(peek.counts).reduce((a, b) => a + b, 0) : 0;
  const who = no == null ? "" : current.has(no) ? `${no}번 ${name(no, data.students.find((s) => s.no === no)?.alias ?? "")}` : `${no}번`;

  return (
    <section className="no-print card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">학생 자료 지우기</h2>
        <button onClick={toggle} aria-expanded={open} className="btn-sub min-h-10 text-sm"><Doodle name="warning" /> {open ? "닫기" : "열기"}</button>
      </div>
      <p className="text-sm text-soft">보호자가 아이 기록을 지워 달라고 하면 여기서 그 학생 자료만 지워요. 지운 자료는 되살릴 수 없어요.</p>
      {open && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold">학생</span>
            <select value={no ?? ""} onChange={(e) => pick(e.target.value ? Number(e.target.value) : null)} disabled={busy} className="field mt-1 min-h-11 py-2">
              <option value="">고르세요</option>
              <optgroup label="지금 명단">
                {data.students.map((s) => <option key={s.no} value={s.no}>{s.no}번 {name(s.no, s.alias)}</option>)}
              </optgroup>
              {gone.length > 0 && (
                <optgroup label="명단에서 뺀 번호">
                  {gone.map((x) => <option key={x.no} value={x.no}>{x.no}번 {x.alias} (명단에서 뺌)</option>)}
                </optgroup>
              )}
            </select>
          </label>
          {busy && !peek && <p className="text-sm text-soft">지울 자료를 세는 중…</p>}
          {peek && (
            <div className="space-y-2 rounded-2xl border border-alert/40 bg-alert-soft p-4">
              <p className="font-bold">{peek.onRoster ? `${who} 학생 자료` : `${who}으로 남은 자료(명단에서 뺀 번호 — 앞서 이 번호를 쓴 학생 것 모두)`}</p>
              {total > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {KO.filter(([k]) => peek.counts[k]).map(([k, label, unit]) => <li key={k}>{label}{unit ? ` ${peek.counts[k]}${unit}` : ""}</li>)}
                </ul>
              ) : (
                <p className="text-sm">지울 자료가 없어요.</p>
              )}
              {peek.held > 0 && (
                <p role="alert" className="text-sm font-bold text-alert">
                  이 학생의 위험 표현 알림 {peek.held}건을 아직 살펴보지 않았어요. 마음 지도 알림에서 먼저 「살펴봤어요」를 눌러 주세요.
                </p>
              )}
              <p className="text-xs text-soft">
                남는 것: 명단의 번호·가명·학생 코드(빼려면 위 명단에서 지워 주세요), 친구가 이 학생에게 보낸 쪽지 가운데 아직 전하지 않았거나
                걱정되는 말이 있는 쪽지(보낸 학생의 기록), 학급 전체 숫자로 만든 주간 리포트. AI 도우미 대화는 마지막으로 쓴 날부터 30일 뒤 저절로 지워져요.
              </p>
              {total > 0 && !peek.held && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="size-4 accent-[var(--color-alert)]" />
                    되살릴 수 없다는 것을 알고 지울게요
                  </label>
                  <button onClick={wipe} disabled={!sure || busy} className="btn-sub border-alert font-bold text-alert disabled:opacity-50">
                    {busy ? "지우는 중…" : `${who} 자료 지우기`}
                  </button>
                </div>
              )}
            </div>
          )}
          {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-leaf" : "text-alert"}`}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
