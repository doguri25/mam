"use client";
// 교사 화면: 비밀번호(기본 1324) → 마음 지도 · 응원 한마디 · 주간 리포트 · 학생 코드/QR · 설정
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CheerTab from "@/components/teacher/CheerTab";
import MapTab from "@/components/teacher/MapTab";
import ReportTab from "@/components/teacher/ReportTab";
import RosterTab from "@/components/teacher/RosterTab";
import SettingsTab from "@/components/teacher/SettingsTab";
import type { Overview } from "@/components/teacher/types";
import { api } from "@/lib/api";
import { useNames } from "@/lib/local";

const TABS = [
  ["map", "🗺️ 마음 지도"],
  ["cheer", "💌 응원 한마디"],
  ["report", "📄 주간 리포트"],
  ["roster", "🔑 학생 코드·QR"],
  ["settings", "⚙️ 설정"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function TeacherPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const [cheerNo, setCheerNo] = useState<number | null>(null);
  const names = useNames();

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("teacher", "overview"));
      setNeedLogin(false);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setNeedLogin(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load는 fetch가 끝난 뒤에만 setState한다
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20_000); // 학생 기록이 들어오면 20초 안에 보임
    return () => clearInterval(t);
  }, [load]);

  if (needLogin) return <Login onDone={load} />;
  if (!data) return <main className="grid min-h-dvh place-items-center text-soft">불러오는 중…</main>;
  const nameOf = (no: number) => names.name(no, data.students.find((s) => s.no === no)?.alias ?? `${no}번`);

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <header className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-soft">수업 후 · 선생님 화면</p>
          <h1 className="font-display text-3xl">{data.settings.className} 마음빛 길잡이</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {names.raw.trim() && (
            <button onClick={() => names.setOn(!names.on)} aria-pressed={names.on} className={`btn-sub min-h-10 px-3 text-sm ${names.on ? "border-leaf bg-leaf-soft" : ""}`}>
              {names.on ? "실명으로 보는 중" : "가명으로 보는 중"}
            </button>
          )}
          <Link href="/" className="btn-sub min-h-10 px-3 text-sm">학생 화면</Link>
          <button onClick={async () => { await api("teacher", "logout"); setNeedLogin(true); }} className="btn-sub min-h-10 px-3 text-sm">잠그기</button>
        </div>
      </header>
      <nav className="no-print mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([id, name]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-2xl px-4 py-2.5 font-bold ${tab === id ? "bg-leaf text-white" : "bg-card text-soft border border-line"}`}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "map" && <MapTab data={data} reload={load} nameOf={nameOf} onCheer={(no) => { setCheerNo(no); setTab("cheer"); }} />}
      {tab === "cheer" && <CheerTab data={data} reload={load} no={cheerNo} setNo={setCheerNo} nameOf={nameOf} />}
      {tab === "report" && <ReportTab data={data} nameOf={nameOf} />}
      {tab === "roster" && <RosterTab data={data} reload={load} />}
      {tab === "settings" && <SettingsTab data={data} reload={load} />}
    </main>
  );
}

function Login({ onDone }: { onDone: () => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("teacher", "login", { password: pw });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setPw("");
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="font-display text-2xl">선생님 관리 화면</h1>
        <label htmlFor="pw" className="sr-only">비밀번호</label>
        <input
          id="pw"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="field text-center text-2xl tracking-[0.5em]"
          placeholder="비밀번호"
          autoFocus
        />
        {error && <p role="alert" className="text-alert">{error}</p>}
        <button className="btn-main w-full" disabled={!pw}>열기</button>
        <Link href="/" className="block text-sm text-soft underline underline-offset-4">학생 화면으로</Link>
      </form>
    </main>
  );
}
