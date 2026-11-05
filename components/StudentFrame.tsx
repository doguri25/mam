"use client";
// 학생 화면의 작은 페이지들(돌아보기·놀이·사전·쪽지)이 함께 쓰는 틀: 로그인 확인, 고른 언어, 큰 「돌아가기」 단추.
// 태블릿에서 손가락으로 누르기 쉽게 단추를 크게, 가로·세로 모두 한 손에 들어오게 둔다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { backToMe } from "@/lib/back";
import { isLang, t, type Lang, type UIKey } from "@/lib/i18n";
import { useLocal } from "@/lib/local";
import { flushQueue, onQueueSent, pendingCount } from "@/lib/queue";
import type { BuddyLook } from "@/lib/shared";

export type StudentMe = {
  no: number; alias: string; className: string; vocab: string[]; today: string; look: BuddyLook;
  words: string[]; unread: number; reflected: boolean; demo: boolean; space?: string;
};

// 학생이 고른 화면 언어: 학급(공간)과 번호마다 이 기기에 둔다 → 같은 태블릿을 여러 반이 돌려 써도 3번 학생끼리 섞이지 않게.
// 서버가 학급을 알려 주기 전(예전 서버)에는 번호만 쓴 예전 열쇠를 쓴다.
// 학급 열쇠가 비어 있으면 예전 열쇠 값을 읽고 학급 열쇠로 옮겨 둔다(예전 값이 다른 반 같은 번호에게 계속 보이지 않게 한 번만).
export function useStudentLang(who: { no: number; space?: string } | null): [Lang, (l: Lang) => void] {
  const oldKey = `mb_lang_${who?.no ?? 0}`;
  const newKey = who && typeof who.space === "string" ? `mb_lang_${who.space}_${who.no}` : "";
  const [oldRaw, setOld] = useLocal(oldKey);
  const [newRaw, setNew] = useLocal(newKey || oldKey);
  const moving = !!newKey && !isLang(newRaw) && isLang(oldRaw);
  useEffect(() => {
    if (!moving) return;
    setNew(oldRaw);
    setOld("");
  }, [moving, oldRaw, setNew, setOld]);
  const raw = isLang(newRaw) ? newRaw : moving ? oldRaw : "";
  const lang: Lang = isLang(raw) ? raw : "ko";
  const set = (l: Lang) => {
    setNew(l === "ko" ? "" : l);
    if (newKey) setOld("");
  };
  return [lang, set];
}

// 서버에서 읽어 오기: 로그인이 풀렸을 때(401)만 첫 화면으로. 와이파이가 잠깐 끊긴 것이면 머문 채 2초·4초·8초·10초… 뒤 다시 묻는다.
// key가 바뀌면(달력의 달 등) 새로 읽는다. 늦게 온 앞 답은 버린다. 화면이 숨겨지면 멈추고, 다시 보이면 새로 읽는다.
export function useRetry<T>(load: (() => Promise<T>) | null, done: (v: T) => void, key: unknown = 0) {
  const router = useRouter();
  const loadRef = useRef(load);
  const doneRef = useRef(done);
  useEffect(() => {
    loadRef.current = load;
    doneRef.current = done;
  });
  const ready = !!load;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = (wait: number) => {
      const f = loadRef.current;
      if (!f) return;
      f().then(
        (v) => alive && doneRef.current(v),
        (e) => {
          if (!alive) return;
          if ((e as { status?: number }).status === 401) return router.replace("/");
          timer = setTimeout(() => go(Math.min(wait * 2, 10_000)), wait);
        },
      );
    };
    go(2000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [router, key, ready]);
}

// 작은 화면들: 이 기기에 담아 둔 기록(와이파이가 끊겼을 때 남긴 마음)이 있으면 보이는 동안 보낸다
// — 들어올 때(숨겨졌다 다시 보일 때도)·연결이 돌아올 때·10초마다(와이파이는 붙어 있는데 인터넷만 안 되던 때는 연결 알림이 오지 않는다).
// 마음 화면은 숨겨져 있어 듣지 못하니, 달력 등에 와 있는 사이에도 기록이 서버에 가게.
// 돌려주는 수는 담아 둔 기록이 서버에 갔을 때마다(어느 화면이 보냈든) 하나씩 는다 → 기록을 보여 주는 화면이 다시 읽는 열쇠로.
export function useQueueFlush() {
  const [sent, setSent] = useState(0);
  useEffect(() => {
    const off = onQueueSent(() => setSent((n) => n + 1));
    const go = () => {
      if (document.visibilityState === "visible" && pendingCount()) flushQueue().catch(() => {});
    };
    go();
    const id = setInterval(go, 10_000);
    window.addEventListener("online", go);
    return () => {
      off();
      clearInterval(id);
      window.removeEventListener("online", go);
    };
  }, []);
  return sent;
}

export function useStudent() {
  const [me, setMe] = useState<StudentMe | null>(null);
  const [lang] = useStudentLang(me);
  useRetry(() => api<StudentMe>("student", "me"), setMe);
  const sent = useQueueFlush();
  const tt = (k: UIKey, vars?: Record<string, string | number>) => t(lang, k, vars);
  return { me, lang, tt, sent };
}

// 큰 「← 돌아가기」: 마음 화면에서 왔으면 실제로 뒤로(그 화면의 단계까지 건너), 아니면 /me로
export const BackLink = ({ lang, className = "" }: { lang: Lang; className?: string }) => (
  <Link href="/me" onClick={backToMe} className={`btn-sub min-h-12 shrink-0 whitespace-nowrap px-4 text-base ${className}`}>← {t(lang, "buddyBack")}</Link>
);

// root: 브라우저 뒤로 가기를 화면 안 단계와 잇는 화면이면 그 이름(lib/back.ts)
export default function StudentFrame({ title, lang, children, wide, root }: { title: string; lang: Lang; children: React.ReactNode; wide?: boolean; root?: string }) {
  return (
    <main data-back-root={root} className={`mx-auto px-4 py-4 sm:px-6 sm:py-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`} lang={lang}>
      <header className="mb-4 flex items-center gap-3">
        <BackLink lang={lang} />
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      </header>
      {children}
    </main>
  );
}

// 학생 정보를 아직 못 받아 고른 언어를 모를 때: 기기 언어로 짐작(브라우저에서만)
export const guessLang = (): Lang => {
  const l = typeof navigator === "undefined" ? "" : navigator.language.slice(0, 2);
  return isLang(l) ? l : "ko";
};

// 불러오는 중: 와이파이가 끊겨 오래 걸리면(1.5초 넘게) 연결 안내와 「돌아가기」를 함께 보여 준다(다시 묻기는 useRetry가 알아서).
// lang: 학생이 고른 언어(학생 정보를 아직 못 받았으면 비움)
export function Loading({ lang }: { lang?: Lang }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(id);
  }, []);
  const l = lang ?? (slow ? guessLang() : "ko");
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center text-soft" lang={l}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-xl" aria-live="polite">{slow ? t(l, "waitNet") : "…"}</p>
        {slow && <BackLink lang={l} />}
      </div>
    </main>
  );
}
