"use client";
// 학생 첫 화면: 내 코드 넣기 (QR을 찍으면 /join으로 바로 들어온다)
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import BuddyParade from "@/components/BuddyParade";
import { useStudentLang } from "@/components/StudentFrame";
import { OTHER_KEY, OTHER_STUDENT, api } from "@/lib/api";
import { errText } from "@/lib/i18n";
import { rememberToken } from "@/lib/queue";

// 다른 탭에서 다른 친구가 들어와 학생 화면이 이리로 왔으면(lib/api) 이 탭에 앞 화면의 학생이 남아 있다. 이 탭에서 다시 들어오면 지운다.
const readOther = () => {
  try {
    return sessionStorage.getItem(OTHER_KEY);
  } catch {
    return null;
  }
};
const noSub = () => () => {};
function parseOther(raw: string | null) {
  try {
    const v = JSON.parse(raw ?? "null") as { no?: unknown; space?: unknown } | null;
    return v && typeof v === "object" ? { no: Number(v.no) || 0, space: typeof v.space === "string" ? v.space : undefined } : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 다른 친구가 들어와 이리로 왔다: 그 학생 언어로 알려 주고, 지금 로그인된 친구 화면으로 넘기지 않는다
  const otherRaw = useSyncExternalStore(noSub, readOther, () => null);
  const other = useMemo(() => parseOther(otherRaw), [otherRaw]);
  const [otherLang] = useStudentLang(other);

  // 들어갈 때는 화면을 통째로 새로 불러온다. Next.js가 숨겨 둔 앞 친구의 학생 화면(쓰던 글·고른 카드)이 다시 보이지 않게.
  // 다른 친구가 들어와 이리로 온 탭이면 넘기지 않는다: 이 탭의 학생은 코드를 다시 넣어 들어온다(넘기면 다른 탭의 친구 화면이 열린다)
  useEffect(() => {
    if (parseOther(readOther())) return;
    api("student", "me").then(() => window.location.replace("/me"), () => {});
  }, []);
  // 들어간 뒤 이 화면은 숨겨진 채 상태가 남는다(Next.js Activity). 숨겨질 때 비워 두어
  // 다시 돌아왔을 때 「들어가는 중…」에 멈춰 있거나 앞 친구 코드가 남아 있지 않게 한다.
  useLayoutEffect(() => () => {
    setCode("");
    setError("");
    setBusy(false);
  }, []);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ no: number; qtoken: string }>("student", "login", { code });
      rememberToken(r.no, r.qtoken); // 와이파이가 끊겨도 이 학생 기록을 나중에 보낼 수 있게
      window.location.replace("/me");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <BuddyParade />
      <div>
        <h1 className="font-display text-4xl text-leaf">마음빛 길잡이</h1>
        <p className="mt-2 text-soft">오늘 마음은 어때요? 내 코드를 넣거나 QR을 찍어 들어와요.</p>
      </div>
      {other && <p role="alert" lang={otherLang} className="w-full rounded-2xl bg-[#fff8e1] px-4 py-3 text-lg">{errText(otherLang, OTHER_STUDENT)}</p>}
      <form onSubmit={enter} className="card w-full space-y-3">
        <label htmlFor="code" className="block text-left font-bold">내 코드</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6))}
          className="field text-center font-mono text-3xl tracking-[0.4em]"
          placeholder="ABC234"
          autoComplete="off"
          autoCapitalize="characters"
        />
        {error && <p role="alert" className="text-alert">{error}</p>}
        <button className="btn-main w-full text-lg" disabled={code.length < 6 || busy}>
          {busy ? "들어가는 중…" : "들어가기"}
        </button>
      </form>
      <p className="text-sm text-soft">코드를 잊어버렸다면 선생님께 물어봐요.</p>
      <div className="flex gap-4 text-sm text-soft">
        <Link href="/teacher" className="underline underline-offset-4">선생님 화면</Link>
        <Link href="/try" className="underline underline-offset-4">처음이세요? 체험해 보기</Link>
      </div>
      <Link href="/privacy" className="text-xs text-soft underline underline-offset-4">개인정보 처리 안내</Link>
    </main>
  );
}
