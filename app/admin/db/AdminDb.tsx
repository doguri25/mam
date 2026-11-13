"use client";
// 저장소 옮기기·속도 재기 화면(미리보기 전용). 실제 배포에서는 API가 404라 아무것도 하지 않는다.
import { useEffect, useState } from "react";

type T = { median: number; p90: number };
type Run = Record<string, unknown> & { kind: string; connectMs: number };
type Bench = { region: string; mongo: Run[]; turso: Run[] };
type Copy = { ok: boolean; collections: number; docs: number; ms: number; mongoDb: string; cols: { name: string; mongo: number; turso: number; same: boolean; odd: number }[]; tursoOnly: { name: string; turso: number }[] };
type Status = { ready: boolean; need?: string[]; error?: string; mongoDb?: string; mongo?: Record<string, number>; turso?: Record<string, number> };

const post = async <R,>(action: string): Promise<R> => {
  const r = await fetch("/api/admin/db", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
  const j = await r.json().catch(() => ({ error: `오류 ${r.status}` }));
  if (!r.ok) throw new Error(j.error ?? `오류 ${r.status}`);
  return j as R;
};
const avg = (runs: Run[], k: string) => {
  const xs = runs.map((r) => (r[k] as T | undefined)?.median).filter((x): x is number => typeof x === "number");
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;
};

export default function AdminDb() {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [copy, setCopy] = useState<Copy | null>(null);
  const [bench, setBench] = useState<Bench | null>(null);

  const load = () => fetch("/api/admin/db").then(async (r) => (r.status === 404 ? setSt({ ready: false, error: "실제 배포에서는 쓸 수 없어요." }) : setSt(await r.json()))).catch((e) => setSt({ ready: false, error: String(e) }));
  useEffect(() => { load(); }, []);

  const go = async (action: "copy" | "bench") => {
    if (action === "copy" && !confirm(`몽고DB(${st?.mongoDb})의 모든 모음을 Turso로 복사할까요? Turso 쪽 같은 모음은 지우고 새로 넣어요. 몽고는 그대로예요.`)) return;
    setBusy(action);
    setErr("");
    try {
      if (action === "copy") setCopy(await post<Copy>("copy"));
      else setBench(await post<Bench>("bench"));
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const keys = bench ? Object.keys(bench.mongo[0]).filter((k) => !["kind", "connectMs"].includes(k)) : [];
  const names = st?.mongo || st?.turso ? [...new Set([...Object.keys(st.mongo ?? {}), ...Object.keys(st.turso ?? {})])].sort() : [];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <h1 className="font-display text-2xl">저장소 옮기기 · 속도 재기</h1>
      <p className="text-soft">미리보기에서만 열리는 관리 화면이에요. 몽고DB는 읽기만 하고, 속도 재기는 연습 공간(bench)에만 썼다가 지워요.</p>

      <section className="card space-y-3">
        <h2 className="font-bold">지금 상태</h2>
        {!st && <p className="text-soft">불러오는 중…</p>}
        {st?.error && <p role="alert" className="text-alert">{st.error}</p>}
        {st?.need && <p role="alert" className="text-alert">Vercel 미리보기(Preview) 환경 변수가 없어요: {st.need.join(", ")}</p>}
        {st?.ready && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-soft"><th className="py-1">모음 ({st.mongoDb})</th><th className="text-right">몽고DB</th><th className="text-right">Turso</th></tr></thead>
              <tbody>
                {names.map((n) => (
                  <tr key={n} className="border-t border-line">
                    <td className="py-1 font-mono text-xs">{n}</td>
                    <td className="text-right">{st.mongo?.[n] ?? "-"}</td>
                    <td className={`text-right ${(st.turso?.[n] ?? -1) === (st.mongo?.[n] ?? -2) ? "text-leaf" : ""}`}>{st.turso?.[n] ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn-main" disabled={!st?.ready || !!busy} onClick={() => go("copy")}>{busy === "copy" ? "옮기는 중…" : "몽고DB → Turso 복사하기"}</button>
          <button className="btn-sub" disabled={!st?.ready || !!busy} onClick={() => go("bench")}>{busy === "bench" ? "재는 중… (30초쯤)" : "속도 재기"}</button>
        </div>
        {err && <p role="alert" className="text-alert">{err}</p>}
      </section>

      {copy && (
        <section className="card space-y-2">
          <h2 className="font-bold">{copy.ok ? "복사했어요 ✓" : "확인이 필요해요"}</h2>
          <p>모음 {copy.collections}개 · 문서 {copy.docs}개 · {(copy.ms / 1000).toFixed(1)}초</p>
          {copy.cols.filter((c) => !c.same || c.odd).map((c) => (
            <p key={c.name} className="text-sm text-alert">{c.name}: 몽고 {c.mongo} · Turso {c.turso}{c.odd ? ` · JSON으로 바뀌는 값 ${c.odd}개` : ""}</p>
          ))}
          {!!copy.tursoOnly.length && <p className="text-sm text-soft">Turso에만 있는 모음: {copy.tursoOnly.map((x) => `${x.name}(${x.turso})`).join(", ")}</p>}
        </section>
      )}

      {bench && (
        <section className="card space-y-2">
          <h2 className="font-bold">속도 (가운데 값, 밀리초 · 서버 {bench.region})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-soft"><th className="py-1">하는 일</th><th className="text-right">몽고DB</th><th className="text-right">Turso</th></tr></thead>
              <tbody>
                <tr className="border-t border-line"><td className="py-1">처음 연결</td><td className="text-right">{bench.mongo[0].connectMs}</td><td className="text-right">{bench.turso[0].connectMs}</td></tr>
                {keys.map((k) => {
                  const a = avg(bench.mongo, k);
                  const b = avg(bench.turso, k);
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-1">{k}</td>
                      <td className={`text-right ${a <= b ? "font-bold text-leaf" : ""}`}>{a}</td>
                      <td className={`text-right ${b < a ? "font-bold text-leaf" : ""}`}>{b}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-soft">두 저장소를 번갈아 두 번씩 재서 평균 냈어요. 빠른 쪽이 초록이에요.</p>
        </section>
      )}
    </main>
  );
}
