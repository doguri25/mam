"use client";
// 기록 보관·정리: 보관 기한을 고르고, 기한이 지난 학생 기록 수를 보고, 먼저 CSV로 내려받은 뒤 선생님이 눌러 지운다.
// 자동으로 지우지 않는다. 언제 몇 건을 지웠는지는 내용 없이 수만 남긴다(학급 역량 진단은 학생 이름·번호가 없어 남겨 둠).
import { useEffect, useState } from "react";
import Doodle from "../Doodle";
import type { Overview, Reload } from "./types";
import { kday } from "./when";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import { PURGE_KO, RETENTIONS, RETENTION_KO, type PurgeLog, type Retention } from "@/lib/retention";

// held: 기한 앞의 아직 살펴보지 않은 위험 표현 알림 수(있으면 서버가 정리하지 않는다 — 마음 지도에서 먼저 살펴보게). 예전 서버는 보내지 않는다
type Info = { cutoff: string; counts: Record<string, number>; logs: PurgeLog[]; held?: number };
const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
const full = (d: string) => `${d.slice(0, 4)}년 ${label(d)}`; // 지난해 날짜도 헷갈리지 않게

export default function RetentionCard({ data, reload, onExport, exportMsg, onAlerts }: { data: Overview; reload: Reload; onExport: () => void; exportMsg: string; onAlerts?: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [ret, setRet] = useState<Retention>(data.settings.retention);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Info>("teacher", "retentionInfo").then(setInfo, (e) => setMsg((e as Error).message));
  }, [data.settings.retention]);

  async function choose(v: Retention) {
    setRet(v);
    setSure(false);
    setMsg("");
    try {
      await api("teacher", "settings", { retention: v });
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function purge() {
    if (!info) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<Info & { done: PurgeLog }>("teacher", "purgeOld", { cutoff: info.cutoff });
      setInfo(r);
      setMsg(`${sum(r.done.counts)}건을 지웠어요.`);
      setSure(false);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
      // 409(살펴보지 않은 위험 표현이 남음 · 기한이 바뀜): 지금 대상·알림 수를 다시 센다. 남은 알림이 있으면 카드가 그 까닭과 마음 지도로 가는 단추를 보인다
      if ((e as { status?: number }).status === 409) {
        setSure(false);
        const fresh = await api<Info>("teacher", "retentionInfo").catch(() => null);
        if (fresh) {
          setInfo(fresh);
          if (Number(fresh.held) > 0) setMsg("");
        }
      }
    }
    setBusy(false);
  }

  const total = info ? sum(info.counts) : 0;
  const held = Number(info?.held) || 0;
  const last = info?.logs.at(-1);
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-xl">기록 내보내기 · 보관 · 정리</h2>
      <p className="text-sm text-soft">모든 기록을 엑셀에서 열 수 있는 CSV로 받아요(가명 기준, 녹음·목소리 숫자는 빠짐).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onExport} className="btn-sub"><Doodle name="download" /> 기록 CSV 내보내기</button>
        <span className="text-sm">{exportMsg}</span>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <label className="block text-sm">
          <span className="block font-bold">학생 기록 보관 기한</span>
          <select value={ret} onChange={(e) => choose(e.target.value as Retention)} className="field mt-1 min-h-11 py-2 sm:w-80">
            {RETENTIONS.map((r) => <option key={r} value={r}>{RETENTION_KO[r]}</option>)}
          </select>
        </label>
        <p className="text-xs text-soft">기한이 지나도 저절로 지우지 않아요. 마음 지도에 알림이 뜨면 여기서 확인하고 지워 주세요. 보호자 안내문의 보관 기간도 이 값을 따라요.</p>
        {!info ? (
          <p className="text-sm text-soft">세는 중…</p>
        ) : (
          <div className={`space-y-2 rounded-2xl p-3 text-sm ${total ? "bg-[#fff8e1]" : "bg-leaf-soft"}`}>
            <p><b>{full(info.cutoff)}</b> 앞에 남긴 기록이 정리 대상이에요{total ? ` · 모두 ${total}건` : " · 지금은 없어요"}.</p>
            {total > 0 && (
              <>
                <p className="text-soft">{Object.entries(info.counts).filter(([, n]) => n).map(([k, n]) => `${PURGE_KO[k] ?? k} ${n}`).join(" · ")}</p>
                {held > 0 ? (
                  <div role="status" className="space-y-2 rounded-xl bg-alert-soft px-3 py-2">
                    <p>
                      <Doodle name="warning" /> 이 가운데 아직 살펴보지 않은 위험 표현 알림이 <b>{held}건</b> 있어 정리하지 않아요.
                      마음 지도 「바로 살펴봐 주세요」에서 먼저 「살펴봤어요」를 누른 뒤 정리해 주세요.
                    </p>
                    {onAlerts && <button onClick={onAlerts} className="btn-sub min-h-10 text-sm">마음 지도 알림 보기</button>}
                  </div>
                ) : sure ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-alert">지운 기록은 되살릴 수 없어요. CSV를 먼저 받으셨나요?</span>
                    <button onClick={purge} disabled={busy} className="btn-sub min-h-10 border-alert text-sm text-alert">{busy ? "지우는 중…" : `${total}건 지우기`}</button>
                    <button onClick={() => setSure(false)} className="btn-sub min-h-10 text-sm">그만두기</button>
                  </div>
                ) : (
                  <button onClick={() => setSure(true)} className="btn-sub min-h-10 text-sm">기한 지난 기록 지우기…</button>
                )}
              </>
            )}
            <p className="text-xs text-soft">학급 역량 진단(학생 이름·번호 없음)과 반 명단은 지우지 않아요.</p>
          </div>
        )}
        {last && <p className="text-xs text-soft">마지막 정리: {full(kday(last.at))} · {full(last.cutoff)} 앞 기록 {sum(last.counts)}건</p>}
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </div>
    </section>
  );
}
