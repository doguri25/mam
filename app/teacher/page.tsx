"use client";
// 교사 화면: 비밀번호(기본 1324) → 마음 지도 · 응원 한마디 · 주간 리포트 · 학생 코드/QR · 설정 · 사용 설명서
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CheerTab from "@/components/teacher/CheerTab";
import GuideTab from "@/components/teacher/GuideTab";
import MapTab from "@/components/teacher/MapTab";
import ReportTab from "@/components/teacher/ReportTab";
import RosterTab from "@/components/teacher/RosterTab";
import SettingsTab from "@/components/teacher/SettingsTab";
import type { Overview, OverviewRaw, Stamp } from "@/components/teacher/types";
import { api } from "@/lib/api";
import { addDays } from "@/lib/date";
import { useNames } from "@/lib/local";
import { absentStudents, watchFlags } from "@/lib/rules";
import type { MoodRecord } from "@/lib/shared";

const TABS = [
  ["map", "🗺️ 마음 지도"],
  ["cheer", "💌 응원 한마디"],
  ["report", "📄 주간 리포트"],
  ["roster", "🔑 학생 코드·QR"],
  ["settings", "⚙️ 설정"],
  ["guide", "📘 사용 설명서"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function TeacherPage() {
  const [raw, setRaw] = useState<OverviewRaw | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const [cheerNo, setCheerNo] = useState<number | null>(null);
  const names = useNames();
  const stamp = useRef<Stamp | null>(null);

  // 처음·설정이 바뀌었을 때: 전부(최근 34일 기록)
  const load = useCallback(async () => {
    try {
      const o = await api<OverviewRaw>("teacher", "overview");
      stamp.current = o.stamp;
      setRaw(o);
      setNeedLogin(false);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setNeedLogin(true);
    }
  }, []);

  // 20초마다 변경 표시(문서 1개)만 읽고, 기록만 바뀌었으면 바뀐 기록만 받아 합친다 → Firestore 읽기를 크게 줄임
  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || !stamp.current) return;
    try {
      const s = await api<Stamp>("teacher", "stamp");
      const prev = stamp.current;
      if (s.other !== prev.other) return load();
      if (s.records === prev.records) return;
      const { records, stamp: next } = await api<{ records: MoodRecord[]; stamp: Stamp }>("teacher", "changes", { since: prev.records - 5000 });
      stamp.current = next;
      setRaw((o) => {
        if (!o) return o;
        const byId = new Map(o.records.map((r) => [r.id, r]));
        for (const r of records) byId.set(r.id, r);
        const from = addDays(o.today, -34);
        return { ...o, records: [...byId.values()].filter((r) => r.date >= from) };
      });
    } catch (e) {
      if ((e as { status?: number }).status === 401) setNeedLogin(true);
    }
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load는 fetch가 끝난 뒤에만 setState한다
    load();
    const t = setInterval(poll, 20_000); // 학생 기록이 들어오면 20초 안에 보임
    return () => clearInterval(t);
  }, [load, poll]);

  if (needLogin) return <Login onDone={load} />;
  if (!raw) return <main className="grid min-h-dvh place-items-center text-soft">불러오는 중…</main>;
  const data: Overview = {
    ...raw,
    flags: watchFlags(raw.records, raw.today, raw.settings.rules),
    absent: absentStudents(raw.records, raw.students.map((s) => s.no), raw.today, raw.settings.rules.absentDays),
  };
  const nameOf = (no: number) => names.name(no, data.students.find((s) => s.no === no)?.alias ?? `${no}번`);

  async function clearDemo() {
    if (!confirm("연습용(시연) 기록을 지울까요? 연습용 명단이면 명단·응원·메모도 함께 지워져요. 실제로 남긴 기록은 그대로예요.")) return;
    await api("teacher", "demo", { mode: "clearDemo" });
    await load();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <header className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-soft">
            수업 후 · 선생님 화면
            {data.dataPrefix && data.dataPrefix !== "maeumbit_" && <span className="ml-2 rounded-full bg-sun/30 px-2 py-0.5 text-xs text-ink">이 컴퓨터 연습 공간</span>}
          </p>
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
      {data.demo && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
          <span>🧪 <b>연습용(시연) 데이터</b>가 들어 있어요. 가짜 학생·기록이라 실제 반 기록과 섞이지 않게, 실제로 시작할 때 지워 주세요.</span>
          <button onClick={clearDemo} className="btn-sub min-h-9 px-3 text-sm">연습 데이터 지우기</button>
        </div>
      )}
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
      {tab === "guide" && <GuideTab />}
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
