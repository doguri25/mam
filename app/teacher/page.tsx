"use client";
// 교사 화면: 비밀번호 → 왼쪽 세로 메뉴(넓은 화면) / ☰ 서랍 메뉴(세로 태블릿·휴대폰)
// 마음 지도 · 응원 한마디 · 공감 쪽지 · 상담 의견서 · 학생별 누적 기록 · 학급 역량 진단 · 주간 리포트 · 가정 소식지 · 교과서 연결 · 활동지 피드백 · 학생 코드 · 설정 · 사용 설명서
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Doodle, { type DoodleName } from "@/components/Doodle";
import CheerTab from "@/components/teacher/CheerTab";
import GuideTab from "@/components/teacher/GuideTab";
import LessonTab from "@/components/teacher/LessonTab";
import LettersTab from "@/components/teacher/LettersTab";
import NewsletterTab from "@/components/teacher/NewsletterTab";
import ReferralTab from "@/components/teacher/ReferralTab";
import MapTab from "@/components/teacher/MapTab";
import ReportTab from "@/components/teacher/ReportTab";
import SelCheckTab from "@/components/teacher/SelCheckTab";
import SelfCheckTab from "@/components/teacher/SelfCheckTab";
import SheetTab from "@/components/teacher/SheetTab";
import StudentTab from "@/components/teacher/StudentTab";
import RosterTab from "@/components/teacher/RosterTab";
import SettingsTab from "@/components/teacher/SettingsTab";
import type { Overview, OverviewRaw, Stamp } from "@/components/teacher/types";
import { riskAlertCount } from "@/components/teacher/alerts";
import { api } from "@/lib/api";
import { addDays, today as kToday } from "@/lib/date";
import { useLocal, useNames } from "@/lib/local";
import { absentStudents, watchFlags } from "@/lib/rules";
import type { MoodRecord } from "@/lib/shared";

// 메뉴 묶음: [탭, 그림, 이름]. 세로 화면에서도 한눈에 다 보이게 모두 펼쳐 둔다.
const NAV: { title: string; items: [Tab, DoodleName, string][] }[] = [
  { title: "오늘", items: [["map", "map", "마음 지도"]] },
  { title: "아이 돌보기", items: [["cheer", "letter", "응원 한마디"], ["letters", "envelope", "공감 쪽지"], ["referral", "memo", "상담 의견서"]] },
  { title: "기록·소통", items: [["student", "notebook", "학생별 누적 기록"], ["sel", "compass", "학급 역량 진단"], ["self", "clipboard", "학생 자기진단"], ["report", "page", "주간 리포트"], ["home", "house", "가정 소식지"]] },
  { title: "수업", items: [["lesson", "books", "교과서 연결"], ["sheet", "crayon", "활동지 피드백"]] },
  { title: "관리", items: [["roster", "key", "학생 코드·QR"], ["settings", "gear", "설정"], ["guide", "book", "사용 설명서"]] },
];
const TAB_IDS = ["map", "cheer", "letters", "referral", "student", "sel", "self", "report", "home", "lesson", "sheet", "roster", "settings", "guide"] as const;
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
  // 다시 불러오거나 바뀐 기록을 합칠 때마다 1씩 늘어난다 → 따로 불러오는 탭(자기진단·누적 기록)도 다시 불러온다
  const [version, setVersion] = useState(0);
  const names = useNames(raw?.space ?? "");
  const stamp = useRef<Stamp | null>(null);
  const day = useRef(""); // 불러온 「오늘」(한국 날짜)
  const dayTried = useRef(""); // 날짜가 바뀌어 다시 불러온 날(기기 시계가 틀려도 한 번만)
  // 응답 순서 지키기: 다시 읽기(load)·변경 확인(poll)은 시작할 때 번호표(seq)를 받고, 지금 화면보다 나중에 시작한 것의 응답만 쓴다.
  // 느린 앞 응답이 늦게 와서 방금 닫은 알림을 되살리거나(stamp도 뒤로 감) 잠근 화면을 다시 열지 않게.
  // epoch: 잠근 때의 번호 — 그 전에 떠난 요청의 응답(401 포함)은 잠금을 푼 뒤에도 쓰지 않는다(다른 학급으로 들어와도 섞이지 않게).
  const seq = useRef(0);
  const applied = useRef(0);
  const epoch = useRef(0);
  const locked = useRef(false);
  const rawRef = useRef<OverviewRaw | null>(null); // 마지막으로 화면에 쓴 것(바뀐 기록을 합칠 때 그 자리에서 바로 쓰려고)
  const fresh = useCallback((my: number) => !locked.current && my > epoch.current && my > applied.current, []);

  // 잠그기·「학생 화면」을 누른 그때: 늦게 오는 응답을 모두 버리고, 이 기기에 저장해 둔 기록을 지우고 변경 확인도 멈춘다
  const freeze = useCallback(() => {
    locked.current = true;
    epoch.current = seq.current;
    stamp.current = null;
    writeCache(null);
  }, []);
  // 잠그기·비밀번호가 풀렸을 때: 위 + 위험 표현 글이 든 화면 데이터도 버리고 비밀번호 화면으로
  const lockOut = useCallback(() => {
    freeze();
    rawRef.current = null;
    setRaw(null);
    setNeedLogin(true);
  }, [freeze]);
  const show = useCallback((o: OverviewRaw) => {
    rawRef.current = o;
    setRaw(o);
    setVersion((v) => v + 1);
  }, []);

  // 처음·설정이 바뀌었을 때: 전부(최근 34일 기록)
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const c = readCache();
      const o = await api<OverviewRaw>("teacher", "overview", c ? { since: c.at - 5000, prefix: c.prefix, wipe: c.wipe } : {});
      if (!fresh(my)) return; // 그사이 잠갔거나 더 나중에 시작한 응답을 이미 썼다
      // 체험 표로는 정식 선생님 화면을 열지 않는다. 체험은 /try의 「선생님으로 둘러보기」(/teacher?try)로만 들어온다.
      if (o.trial && !new URLSearchParams(location.search).has("try")) {
        freeze();
        await api("try", "end").catch(() => {}); // 끝내기가 실패해도 체험 화면은 열지 않는다
        lockOut();
        return;
      }
      if (o.partial && c) {
        const byId = new Map(c.records.map((r) => [r.id, r]));
        for (const r of o.records) byId.set(r.id, r);
        const from = addDays(o.today, -34);
        o.records = [...byId.values()].filter((r) => r.date >= from);
        o.demo ||= o.records.some((r) => r.demo);
      }
      applied.current = my;
      keep(o.records, o.stamp, o.dataPrefix);
      stamp.current = o.stamp;
      day.current = o.today;
      show(o);
      setNeedLogin(false);
    } catch (e) {
      if (locked.current || my <= epoch.current) return; // 잠근 뒤에 온 실패는 볼 것 없음
      if ((e as { status?: number }).status === 401) lockOut();
      else dayTried.current = ""; // 날짜가 바뀌어 불렀는데 실패했으면 다음 확인 때 다시
    }
  }, [fresh, show, freeze, lockOut]);
  // 비밀번호로 다시 들어왔을 때만 잠금을 푼다(잠금 전에 떠난 응답은 epoch로 계속 버림)
  const unlock = useCallback(() => {
    locked.current = false;
    return load();
  }, [load]);

  // 20초마다 변경 표시(문서 1개)만 읽고, 기록만 바뀌었으면 바뀐 기록만 받아 합친다 → Firestore 읽기를 크게 줄임.
  // other(쪽지·돌아보기·명단 등)나 wipe(지움·연습 데이터)가 바뀌었으면 통째로 다시 읽는다. 바뀐 기록을 받는 사이에
  // other·wipe가 바뀌었어도(받은 stamp에 담겨 옴) 통째로 다시 읽는다 — 그 값을 그대로 적어 두면 다음 확인이 바뀐 것을 못 본다.
  // 기록만 합칠 때는 records 칸만 앞으로 옮기고 other·wipe는 이 기기가 실제로 읽은 판 그대로 둔다(저장해 둔 기록도 그 판으로).
  // 번호표: 변경 확인도 시작할 때 받는다 → 그 뒤에 시작한 다시 읽기를 이미 썼으면 이 결과를 버리고, 이 결과를 쓴 뒤 늦게 온 앞 다시 읽기도 버린다.
  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || !stamp.current || locked.current) return;
    // 자정이 지나 한국 날짜가 바뀌었으면 「오늘」·이번 주를 새로 받는다
    const now = kToday();
    if (now !== day.current && now !== dayTried.current) {
      dayTried.current = now;
      return load();
    }
    const my = ++seq.current;
    try {
      const s = await api<Stamp>("teacher", "stamp");
      const prev = stamp.current;
      if (!prev || !fresh(my)) return;
      const moved = (x: Stamp) => x.other !== prev.other || (x.wipe ?? 0) !== (prev.wipe ?? 0);
      if (moved(s)) return load();
      if (s.records === prev.records) return;
      const { records, stamp: next } = await api<{ records: MoodRecord[]; stamp: Stamp }>("teacher", "changes", { since: prev.records - 5000 });
      // 그사이 통째로 다시 읽었거나(더 나중 번호표) 잠갔으면 이 결과는 버린다
      const o = rawRef.current;
      if (stamp.current !== prev || !fresh(my) || !o) return;
      if (moved(next)) return load();
      const safe: Stamp = { ...prev, records: next.records };
      const byId = new Map(o.records.map((r) => [r.id, r]));
      for (const r of records) byId.set(r.id, r);
      const from = addDays(o.today, -34);
      const merged = [...byId.values()].filter((r) => r.date >= from);
      // 저장·화면 바꾸기는 여기서 한 번에(setState 갱신 함수 안에서 저장하면, 그 함수가 도는 때엔 이미 잠갔을 수 있다)
      applied.current = my;
      stamp.current = safe;
      keep(merged, safe, o.dataPrefix);
      show({ ...o, records: merged });
    } catch (e) {
      if (locked.current || my <= epoch.current) return;
      if ((e as { status?: number }).status === 401) lockOut();
    }
  }, [fresh, show, load, lockOut]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load는 fetch가 끝난 뒤에만 setState한다
    load();
    const t = setInterval(poll, 20_000); // 학생 기록이 들어오면 20초 안에 보임
    return () => clearInterval(t);
  }, [load, poll]);

  if (needLogin) return <Login onDone={unlock} />;
  if (!raw) return <main className="grid min-h-dvh place-items-center text-soft">불러오는 중…</main>;
  const data: Overview = {
    ...raw,
    flags: watchFlags(raw.records, raw.today, raw.settings.rules),
    absent: absentStudents(raw.records, raw.students.map((s) => s.no), raw.today, raw.settings.rules.absentDays),
  };
  // 명단에서 빠진 번호(지운 학생·연습 학생에게 간 쪽지 등)는 「14번 14번」이 되지 않게 따로 알린다
  const nameOf = (no: number) => names.name(no, data.students.find((s) => s.no === no)?.alias ?? "(명단에 없음)");

  async function clearDemo() {
    if (!confirm("연습용(시연) 기록을 지울까요? 연습용 명단이면 명단·응원·메모도 함께 지워져요. 실제로 남긴 기록은 그대로예요.")) return;
    await api("teacher", "demo", { mode: "clearDemo" });
    await load();
  }

  // 잠그기·「학생 화면」: 이 기기가 휴대폰 알림을 받고 있으면 끌지 먼저 묻는다(말없이 끄면 위험 알림을 놓친다).
  // 「취소」= 알림은 계속 받기(선생님 휴대폰·교무실 컴퓨터), 「확인」= 이 기기 알림도 끄기(함께 쓰는 기기)
  const signOut = async (then: string, why = "") => {
    const sub = await navigator.serviceWorker?.getRegistration().then((r) => r?.pushManager.getSubscription()).catch(() => null);
    const off = !!sub && confirm(`이 기기의 위험 표현 휴대폰 알림도 끌까요?${why}\n\n확인: 알림도 끄고 ${then}(여럿이 함께 쓰는 기기)\n취소: 알림은 계속 받고 ${then}(선생님 휴대폰·개인 컴퓨터)`);
    await api("teacher", "logout", off ? { endpoint: sub.endpoint } : {}).catch(() => {});
    if (off) await sub.unsubscribe().catch(() => false);
  };
  // 누른 그때 먼저 굳힌다(freeze): 알림을 끌지 묻거나 로그아웃을 기다리는 사이 도착한 다시 읽기 응답이 화면·기기 저장을 되살리지 않게
  const lock = async () => {
    freeze();
    await signOut("잠가요");
    lockOut();
  };
  // 「학생 화면」: 실제 학급이면 선생님 화면을 잠그고 넘어간다(학생이 그 기기로 선생님 화면에 들어오지 않게).
  // 학생과 함께 쓰는 태블릿이면 「N번 학생…」 위험 표현 알림이 학생 눈에 띌 수 있어 잠그기처럼 알림을 끌지 묻는다.
  const toStudent = async () => {
    if (!data.trial) {
      freeze(); // 넘어가는 사이 늦게 온 응답이 기기에 기록을 다시 저장하지 않게
      await signOut("학생 화면으로 가요", "\n학생들이 함께 쓰는 기기라면 「⚠️ ○번 학생…」 위험 표현 알림이 학생 화면 위에 뜰 수 있어요.");
      writeCache(null);
    }
    window.location.replace("/"); // 화면을 통째로 새로 불러 숨겨 둔 선생님 화면(위험 표현 글)이 남지 않게
  };
  const badge: Partial<Record<Tab, number>> = {
    map: riskAlertCount(data),
    letters: data.letters.filter((l) => l.status === "wait").length,
  };
  const current = NAV.flatMap((g) => g.items).find(([id]) => id === tab)!;

  const menu = (
    <nav aria-label="선생님 메뉴" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="font-display text-xl text-leaf">마음빛 길잡이</p>
        <p className="text-sm text-soft">{data.settings.className} · {data.account}</p>
        {data.trial && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sun/30 px-2 py-0.5 text-xs"><Doodle name="flask" /> 심사용 체험</p>}
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
                  <Doodle name={icon} size={24} />
                  <span className="flex-1">{name}</span>
                  {!!badge[id] && <span className={`rounded-full px-2 text-xs ${tab === id ? "bg-white text-leaf" : "bg-alert text-white"}`}>{badge[id]}</span>}
                </button>
              </li>
            ))}
            {g.title === "오늘" && (
              <li>
                <a href="/teacher/tv" target="_blank" rel="noopener" className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold hover:bg-paper">
                  <Doodle name="tv" size={24} /><span className="flex-1">교실 화면</span><span aria-hidden className="text-xs text-soft">↗</span>
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
          <button onClick={toStudent} className="btn-sub min-h-10 px-2 text-sm" title={data.trial ? undefined : "선생님 화면을 잠그고 학생 화면으로 가요"}>학생 화면</button>
          <button onClick={lock} className="btn-sub min-h-10 px-2 text-sm"><Doodle name="lock" size={18} /> 잠그기</button>
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
          <p className="flex min-w-0 flex-1 items-center gap-2 font-display text-xl"><Doodle name={current[1]} size={26} /><span className="truncate">{current[2]}</span></p>
          <a href="/teacher/tv" target="_blank" rel="noopener" className="btn-sub min-h-11 px-3 text-sm" aria-label="교실 화면"><Doodle name="tv" size={24} /></a>
        </header>
        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
          <h1 className="no-print mb-4 hidden items-center gap-3 font-display text-3xl lg:flex"><Doodle name={current[1]} size={38} />{current[2]}</h1>
          {data.trial ? (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
              <span>
                <Doodle name="flask" /> <b>심사용 체험 반</b>이에요. 가짜 학생 25명·최근 7일 기록이고 실제 반과는 따로예요.{" "}
                {data.trial.aiSource === "none" ? "AI 키가 없어 기본 질문으로 움직여요." : `AI(${{ upstage: "업스테이지 Solar", trial: "체험 전용 키", class: "실제 반 키를 빌려 씀" }[data.trial.aiSource ?? "class"]})는 오늘 ${data.trial.aiUsed}/${data.trial.aiCap}번 썼어요.`}
              </span>
              <Link href="/try" className="btn-sub min-h-9 px-3 text-sm">체험 안내 · 끝내기</Link>
            </div>
          ) : data.demo && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sun bg-[#fff8e1] px-4 py-3 text-sm">
              <span><Doodle name="flask" /> <b>연습용(시연) 데이터</b>가 들어 있어요. 가짜 학생·기록이라 실제 반 기록과 섞이지 않게, 실제로 시작할 때 지워 주세요.</span>
              <button onClick={clearDemo} className="btn-sub min-h-9 px-3 text-sm">연습 데이터 지우기</button>
            </div>
          )}
          {tab === "map" && data.expired > 0 && (
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <span><Doodle name="clipboard" /> 보관 기한이 지난 마음 기록이 <b>{data.expired}건</b> 있어요. 필요하면 내려받은 뒤 지워 주세요.</span>
              <button onClick={() => setTab("settings")} className="btn-sub min-h-9 px-3 text-sm">기록 보관·정리 열기</button>
            </div>
          )}
          {tab === "map" && <MapTab data={data} reload={load} nameOf={nameOf} onCheer={(no) => { setCheerNo(no); setTab("cheer"); }} onLetters={() => setTab("letters")} />}
          {tab === "cheer" && <CheerTab data={data} reload={load} no={cheerNo} setNo={setCheerNo} nameOf={nameOf} />}
          {tab === "letters" && <LettersTab data={data} reload={load} nameOf={nameOf} />}
          {tab === "referral" && <ReferralTab data={data} nameOf={nameOf} />}
          {tab === "student" && <StudentTab data={data} reload={load} nameOf={nameOf} no={cheerNo} setNo={setCheerNo} version={version} />}
          {tab === "sel" && <SelCheckTab data={data} />}
          {tab === "self" && <SelfCheckTab data={data} nameOf={nameOf} version={version} />}
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
        <Doodle name={signup ? "school" : "lock"} size={56} className="mx-auto block" />
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
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-soft">
          <Link href="/" className="underline underline-offset-4">학생 화면으로</Link>
          <Link href="/try" className="underline underline-offset-4">비밀번호 없이 체험하기</Link>
          <Link href="/privacy" className="underline underline-offset-4">개인정보 처리 안내</Link>
        </p>
      </form>
    </main>
  );
}
