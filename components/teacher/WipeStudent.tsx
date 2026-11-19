"use client";
// 학생 한 명 자료 지우기(보호자가 지워 달라고 할 때): 학생 고르기 → 지울 자료 보기 → 확인하고 지우기. 지운 자료는 되살릴 수 없다.
// 한 번호를 여러 학생이 차례로 썼으면 학생마다 따로 고른다(지금 학생 · 그 번호의 앞 학생 · 명단에서 뺀 학생). 그 학생이 그 번호를 쓴 때의 것만 지운다.
import { useState } from "react";
import Doodle from "../Doodle";
import { api } from "@/lib/api";
import type { WipeCounts } from "@/lib/data";
import type { Overview, Reload } from "./types";

type Peek = { counts: WipeCounts; held: number; onRoster: boolean; skipped?: number };
type Target = { no: number; who: string; label: string };
const KO: [keyof WipeCounts, string, string][] = [
  ["records", "마음 기록", "개"], ["drafts", "마치지 않은 기록", "개"], ["reflects", "한 주 돌아보기", "개"], ["letters", "공감 쪽지", "통"],
  ["cheers", "응원 한마디", "개"], ["notes", "면담 메모", "개"], ["self", "역량 진단 답·관찰", "개"], ["sheets", "활동지 피드백", "회"],
  ["actions", "조치 기록 속 학생 글", "개"], ["look", "마음 친구 모습", ""], ["left", "명단 기록(가명·코드·동의 날짜)", ""],
];

export default function WipeStudent({ data, reload, name }: { data: Overview; reload: Reload; name: (no: number, alias: string) => string }) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [key, setKey] = useState(""); // 고른 학생(번호|누구)
  const [peek, setPeek] = useState<Peek | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const chosen = targets?.find((t) => `${t.no}|${t.who}` === key) ?? null;
  const loadTargets = () =>
    api<{ targets: Target[] }>("teacher", "wipeTargets").then((r) => setTargets(r.targets)).catch((e) => { setTargets([]); setMsg({ ok: false, text: (e as Error).message }); });
  const toggle = () => {
    setOpen(!open);
    if (!open) loadTargets();
  };
  // 고를 때마다 지울 자료를 다시 본다(다른 학생 것을 보고 지우지 않게)
  const pick = async (k: string) => {
    setKey(k);
    setPeek(null);
    setSure(false);
    setMsg(null);
    const t = targets?.find((x) => `${x.no}|${x.who}` === k);
    if (!t) return;
    setBusy(true);
    try {
      setPeek(await api<Peek>("teacher", "wipeStudent", { no: t.no, who: t.who, dry: true }));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  };
  const wipe = async () => {
    if (!chosen || !peek) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<Peek>("teacher", "wipeStudent", { no: chosen.no, who: chosen.who, dry: false, seen: peek.counts });
      // 지우는 사이 새로 온 살펴보지 않은 위험 표현은 남긴다
      setMsg({ ok: true, text: `${chosen.label} 자료를 지웠어요.${r.skipped ? ` 지우는 사이 새로 온 위험 표현 ${r.skipped}건은 남겨 두었어요. 마음 지도 알림에서 살펴봐 주세요.` : ""}` });
      setPeek(null);
      setSure(false);
      setKey("");
      loadTargets();
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
  // 지금 학생은 이 기기의 실명으로(실명을 켰을 때)
  const labelOf = (t: Target) => (t.who === "now" ? `${t.no}번 ${name(t.no, data.students.find((s) => s.no === t.no)?.alias ?? "")}` : t.label);

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
            <select value={key} onChange={(e) => pick(e.target.value)} disabled={busy || !targets} className="field mt-1 min-h-11 py-2">
              <option value="">{targets ? "고르세요" : "불러오는 중…"}</option>
              {targets && (
                <>
                  <optgroup label="지금 명단">
                    {targets.filter((t) => t.who === "now").map((t) => <option key={`${t.no}|${t.who}`} value={`${t.no}|${t.who}`}>{labelOf(t)}</option>)}
                  </optgroup>
                  {targets.some((t) => t.who !== "now") && (
                    <optgroup label="앞 학생 · 명단에서 뺀 학생">
                      {targets.filter((t) => t.who !== "now").map((t) => <option key={`${t.no}|${t.who}`} value={`${t.no}|${t.who}`}>{t.label}</option>)}
                    </optgroup>
                  )}
                </>
              )}
            </select>
          </label>
          {busy && !peek && <p className="text-sm text-soft">지울 자료를 세는 중…</p>}
          {peek && (
            <div className="space-y-2 rounded-2xl border border-alert/40 bg-alert-soft p-4">
              <p className="font-bold">{chosen ? labelOf(chosen) : ""} 학생 자료 <span className="text-sm font-normal text-soft">(그 학생이 이 번호를 쓴 때의 것만 — 같은 번호를 쓴 다른 학생 것은 남아요)</span></p>
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
                걱정되는 말이 있는 쪽지(보낸 학생의 기록), 위험 표현에 한 조치 기록(한 일·날짜·선생님 메모 — 학생 글은 지워요, 보관 기한 정리 때 지워져요),
                학급 전체 숫자로 만든 주간 리포트. AI 도우미의 할 일과 대화는 따로 지워 주세요(대화는 마지막으로 쓴 날부터 30일 뒤 저절로 지워져요).
                선생님 컴퓨터에 넣은 실명 명렬표는 각 컴퓨터에서 지워 주세요.
              </p>
              {total > 0 && !peek.held && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="size-4 accent-[var(--color-alert)]" />
                    되살릴 수 없다는 것을 알고 지울게요
                  </label>
                  <button onClick={wipe} disabled={!sure || busy} className="btn-sub border-alert font-bold text-alert disabled:opacity-50">
                    {busy ? "지우는 중…" : `${chosen ? labelOf(chosen) : ""} 자료 지우기`}
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
