"use client";
// 교사 화면: 비밀번호 → 왼쪽 세로 메뉴(넓은 화면) / ☰ 서랍 메뉴(세로 태블릿·휴대폰)
// 마음 지도 · 응원 한마디 · 공감 쪽지 · 상담 의견서 · 학생별 누적 기록 · 주간 리포트 · 가정 소식지 · 교과서 연결 · 활동지 피드백 · 학생 코드 · 설정 · 사용 설명서
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CheerTab from "@/components/teacher/CheerTab";
import GuideTab from "@/components/teacher/GuideTab";
import LessonTab from "@/components/teacher/LessonTab";
import LettersTab from "@/components/teacher/LettersTab";
import NewsletterTab from "@/components/teacher/NewsletterTab";
import ReferralTab from "@/components/teacher/ReferralTab";
import MapTab from "@/components/teacher/MapTab";
import ReportTab from "@/components/teacher/ReportTab";
import SheetTab from "@/components/teacher/SheetTab";
import StudentTab from "@/components/teacher/StudentTab";
import RosterTab from "@/components/teacher/RosterTab";
import SettingsTab from "@/components/teacher/SettingsTab";
import type { Overview, OverviewRaw, Stamp } from "@/components/teacher/types";
import { api } from "@/lib/api";
import { addDays } from "@/lib/date";
import { useLocal, useNames } from "@/lib/local";
import { absentStudents, watchFlags } from "@/lib/rules";
import type { MoodRecord } from "@/lib/shared";

// 메뉴 묶음: [탭, 그림, 이름]
const NAV: { title: string; items: [Tab, string, string][] }[] = [
  { title: "오늘", items: [["map", "🗺️", "마음 지도"]] },
  { title: "아이 돌보기", items: [["cheer", "💌", "응원 한마디"], ["letters", "✉️", "공감 쪽지"], ["referral", "📝", "상담 의견서"]] },
  { title: "기록·소통", items: [["student", "📒", "학생별 누적 기록"], ["report", "📄", "주간 리포트"], ["home", "🏠", "가정 소식지"]] },
  { title: "수업", items: [["lesson", "📚", "교과서 연결"], ["sheet", "🖍️", "활동지 피드백"]] },
  { title: "관리", items: [["roster", "🔑", "학생 코드·QR"], ["settings", "⚙️", "설정"], ["guide", "📘", "사용 설명서"]] },
];
const TAB_IDS = ["map", "cheer", "letters", "referral", "student", "report", "home", "lesson", "sheet", "roster", "settings", "guide"] as const;
type Tab = (typeof TAB_IDS)[number];

// 교사 기기에 최근 기록을 저장해 두고, 다음에 열 때는 그 뒤에 바뀐 기록만 받는다(Firestore 읽기 줄이기). 잠그면 지운다.
const CACHE = "mb_teacher_cache";
interface Cache { prefix: string; wipe: number; at: number; records: MoodRecord[] }
function readCache(): Cache | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? "null");
  } catch {
    return null;
  }
}
function writeCache(c: Cache | null) {
  try {
    if (c) localStorage.setItem(CACHE, JSON.stringify(c));
    else localStorage.removeItem(CACHE);
  } catch {
    // 저장 공간이 없거나 막혀도 화면은 그대로 쓴다
  }
}
// 저장소 앞이름에서 학급 공간(「공간_」)을 뺀 것: maeumbit_가 아니면 이 컴퓨터 연습 공간(DATA_PREFIX)
const basePrefix = (o: { dataPrefix: string; space: string }) => (o.space ? o.dataPrefix.slice(0, -(o.space.length + 1)) : o.dataPrefix);
const keep = (records: MoodRecord[], stamp: Stamp, prefix: string) =>
  writeCache({ prefix, wipe: stamp.wipe ?? 0, at: stamp.records, records });

export default function TeacherPage() {
  const [raw, setRaw] = useState<OverviewRaw | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tabRaw, setTabRaw] = useLocal("mb_tab"); // 다시 열어도 보던 메뉴 그대로
  const tab: Tab = (TAB_IDS as readonly string[]).includes(tabRaw) ? (tabRaw as Tab) : "map";
  const [drawer, setDrawer] = useState(false);
  const setTab = (t: Tab) => {
    setTabRaw(t === "map" ? "" : t);
    setDrawer(false);
    window.scrollTo(0, 0);
  };
  const [cheerNo, setCheerNo] = useState<number | null>(null);
  const names = useNames(raw?.space ?? "");
  const stamp = useRef<Stamp | null>(null);

  // 처음·설정이 바뀌었을 때: 전부(최근 34일 기록)
  const load = useCallback(async () => {
    try {
      const c = readCache();
      const o = await api<OverviewRaw>("teacher", "overview", c ? { since: c.at - 5000, prefix: c.prefix, wipe: c.wipe } : {});
      // 체험 표로는 정식 선생님 화면을 열지 않는다. 체험은 /try의 「선생님으로 둘러보기」(/teacher?try)로만 들어온다.
      if (o.trial && !new URLSearchParams(location.search).has("try")) {
        await api("try", "end");
        writeCache(null);
        setNeedLogin(true);
        return;
      }
      if (o.partial && c) {
        const byId = new Map(c.records.map((r) => [r.id, r]));
        for (const r of o.records) byId.set(r.id, r);
        const from = addDays(o.today, -34);
        o.records = [...byId.values()].filter((r) => r.date >= from);
        o.demo ||= o.records.some((r) => r.demo);
      }
      keep(o.records, o.stamp, o.dataPrefix);
      stamp.current = o.stamp;
      setRaw(o);
      setNeedLogin(false);
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        writeCache(null);
        setNeedLogin(true);
      }
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
        const merged = [...byId.values()].filter((r) => r.date >= from);
        keep(merged, next, o.dataPrefix);
        return { ...o, records: merged };
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

  const lock = async () => {
    await api("teacher", "logout");
    writeCache(null);
    setNeedLogin(true);
  };
  const badge: Partial<Record<Tab, number>> = {
    map: data.records.filter((r) => r.risk && !r.riskChecked).length,
    letters: data.letters.filter((l) => l.status === "wait").length,
  };
  const current = NAV.flatMap((g) => g.items).find(([id]) => id === tab)!;

  const menu = (
    <nav aria-label="선생님 메뉴" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="font-display text-xl text-leaf">마음빛 길잡이</p>
        <p className="text-sm text-soft">{data.settings.className} · {data.account}</p>
        {data.trial && <p className="mt-1 inline-block rounded-full bg-sun/30 px-2 py-0.5 text-xs">🧪 심사용 체험</p>}
        {!data.trial && basePrefix(data) && basePrefix(data) !== "maeumbit_" && <p className="mt-1 inline-block rounded-full bg-sun/30 px-2 py-0.5 text-xs">이 컴퓨터 연습 공간</p>}
      </div>
      {NAV.map((g) => (
        <div key={g.title}>
          <p className="mb-1 px-2 text-xs font-bold text-soft">{g.title}</p>
          <ul className="space-y-1">
            {g.items.map(([id, icon, name]) => (
              <li key={id}>
                <button
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-bold ${tab === id ? "bg-leaf text-white" : "text-ink hover:bg-paper"}`}
                >
                  <span aria-hidden>{icon}</span>
                  <span className="flex-1">{name}</span>
                  {!!badge[id] && <span className={`rounded-full px-2 text-xs ${tab === id ? "bg-white text-leaf" : "bg-alert text-white"}`}>{badge[id]}</span>}
                </button>
              </li>
            ))}
            {g.title === "오늘" && (
              <li>
                <a href="/teacher/tv" target="_blank" rel="noopener" className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold hover:bg-paper">
                  <span aria-hidden>📺</span><span className="flex-1">교실 화면</span><span aria-hidden className="text-xs text-soft">↗</span>
                </a>
              </li>
            )}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-2 border-t border-line pt-3">
        {names.raw.trim() && (
          <button onClick={() => names.setOn(!names.on)} aria-pressed={names.on} className={`btn-sub min-h-10 w-full text-sm ${names.on ? "border-leaf bg-leaf-soft" : ""}`}>
            {names.on ? "실명으로 보는 중" : "가명으로 보는 중"}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/" className="btn-sub min-h-10 px-2 text-sm">학생 화면</Link>
          <button onClick={lock} className="btn-sub min-h-10 px-2 text-sm">🔒 잠그기</button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr] print:block">
      {/* 넓은 화면: 늘 보이는 왼쪽 세로 메뉴 */}
      <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-card lg:block">{menu}</aside>
      {/* 좁은 화면: ☰로 여는 서랍 */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="선생님 메뉴">
          <button className="absolute inset-0 bg-black/30" aria-label="메뉴 닫기" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-card shadow-xl">{menu}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur lg:hidden">
          <button onClick={() => setDrawer(true)} className="btn-sub relative min-h-11 px-3 text-lg" aria-label="메뉴 열기">
            ☰{(badge.map || badge.letters) ? <span className="absolute -right-1 -top-1 size-3 rounded-full bg-alert" /> : null}
          </button>
          <p className="min-w-0 flex-1 truncate font-display text-xl">{current[1]} {current[2]}</p>
          <a href="/teacher/tv" target="_blank" rel="noopener" className="btn-sub min-h-11 px-3 text-sm" aria-label="교실 화면">📺</a>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
          <h1 className="no-print mb-4 hidden font-display text-3xl lg:block">{current[1]} {current[2]}</h1>
          {data.trial ? (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
              <span>
                🧪 <b>심사용 체험 반</b>이에요. 가짜 학생 25명·최근 7일 기록이고 실제 반과는 따로예요.{" "}
                {data.trial.aiSource === "none" ? "AI 키가 없어 기본 질문으로 움직여요." : `AI(${data.trial.aiSource === "trial" ? "체험 전용 키" : "실제 반 키를 빌려 씀"})는 오늘 ${data.trial.aiUsed}/${data.trial.aiCap}번 썼어요.`}
              </span>
              <Link href="/try" className="btn-sub min-h-9 px-3 text-sm">체험 안내 · 끝내기</Link>
            </div>
          ) : data.demo && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
              <span>🧪 <b>연습용(시연) 데이터</b>가 들어 있어요. 가짜 학생·기록이라 실제 반 기록과 섞이지 않게, 실제로 시작할 때 지워 주세요.</span>
              <button onClick={clearDemo} className="btn-sub min-h-9 px-3 text-sm">연습 데이터 지우기</button>
            </div>
          )}
          {tab === "map" && <MapTab data={data} reload={load} nameOf={nameOf} onCheer={(no) => { setCheerNo(no); setTab("cheer"); }} />}
          {tab === "cheer" && <CheerTab data={data} reload={load} no={cheerNo} setNo={setCheerNo} nameOf={nameOf} />}
          {tab === "letters" && <LettersTab data={data} reload={load} nameOf={nameOf} />}
          {tab === "referral" && <ReferralTab data={data} nameOf={nameOf} />}
          {tab === "student" && <StudentTab data={data} nameOf={nameOf} no={cheerNo} setNo={setCheerNo} />}
          {tab === "report" && <ReportTab data={data} nameOf={nameOf} reload={load} />}
          {tab === "home" && <NewsletterTab data={data} />}
          {tab === "lesson" && <LessonTab data={data} reload={load} />}
          {tab === "sheet" && <SheetTab data={data} nameOf={nameOf} />}
          {tab === "roster" && <RosterTab data={data} reload={load} />}
          {tab === "settings" && <SettingsTab data={data} reload={load} />}
          {tab === "guide" && <GuideTab />}
        </main>
      </div>
    </div>
  );
}

// 로그인: 이름(학급마다 하나) + 비밀번호. 처음 온 선생님은 「새 학급 만들기」로 바로 가입한다.
function Login({ onDone }: { onDone: () => Promise<void> }) {
  const [savedName, setSavedName] = useLocal("mb_tname"); // 이 기기에서 마지막으로 들어온 이름
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState(savedName);
  const [className, setClassName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signup && pw !== pw2) return setError("비밀번호 두 칸이 서로 달라요.");
    setBusy(true);
    setError("");
    try {
      await api("teacher", signup ? "signup" : "login", { name, password: pw, className });
      setSavedName(name.trim());
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setPw("");
      setPw2("");
    }
    setBusy(false);
  }
  const pwField = (id: string, value: string, set: (v: string) => void, label: string, auto: string) => (
    <label htmlFor={id} className="block text-left">
      <span className="text-sm font-bold">{label}</span>
      <input id={id} type="password" inputMode="numeric" autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} className="field mt-1 text-center text-2xl tracking-[0.5em]" />
    </label>
  );
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-8">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 text-center">
        <p className="text-4xl">{signup ? "🏫" : "🔒"}</p>
        <h1 className="font-display text-2xl">{signup ? "새 학급 만들기" : "선생님 관리 화면"}</h1>
        <label htmlFor="tname" className="block text-left">
          <span className="text-sm font-bold">이름</span>
          <input
            id="tname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            className="field mt-1"
            placeholder={signup ? "예: 홍북초 3-2 김민지" : "가입할 때 쓴 이름"}
            maxLength={20}
            autoFocus={!name}
          />
          {signup && <span className="mt-1 block text-xs text-soft">다른 선생님과 겹치지 않게 학교·학년·반을 붙여 주세요. 들어올 때 이 이름을 써요.</span>}
        </label>
        {signup && (
          <label htmlFor="cname" className="block text-left">
            <span className="text-sm font-bold">학급 이름</span>
            <input id="cname" value={className} onChange={(e) => setClassName(e.target.value)} className="field mt-1" placeholder="예: 3학년 2반" maxLength={20} />
          </label>
        )}
        {pwField("pw", pw, setPw, signup ? "비밀번호 (숫자 4자리 이상)" : "비밀번호", signup ? "new-password" : "current-password")}
        {signup && pwField("pw2", pw2, setPw2, "비밀번호 한 번 더", "new-password")}
        {error && <p role="alert" className="text-alert">{error}</p>}
        <button className="btn-main w-full" disabled={busy || !name.trim() || !pw || (signup && !pw2)}>
          {busy ? "잠시만요…" : signup ? "학급 만들고 들어가기" : "열기"}
        </button>
        {signup && <p className="text-xs text-soft">학생 코드와 AI 키는 들어간 뒤 「학생 코드·QR」과 「설정」에서 넣어요. 학급마다 따로라 다른 반 기록은 보이지 않아요.</p>}
        <button type="button" onClick={() => { setMode(signup ? "login" : "signup"); setError(""); }} className="text-sm font-bold text-leaf underline underline-offset-4">
          {signup ? "이미 학급이 있어요 · 들어가기" : "처음이신가요? 새 학급 만들기"}
        </button>
        <p className="flex justify-center gap-4 text-sm text-soft">
          <Link href="/" className="underline underline-offset-4">학생 화면으로</Link>
          <Link href="/try" className="underline underline-offset-4">비밀번호 없이 체험하기</Link>
        </p>
      </form>
    </main>
  );
}
