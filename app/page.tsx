"use client";
// 학생 첫 화면: 내 코드 넣기 (QR을 찍으면 /join으로 바로 들어온다)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BuddyLazy from "@/components/BuddyLazy";
import { api } from "@/lib/api";
import { rememberToken } from "@/lib/queue";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("student", "me").then(() => router.replace("/me"), () => {});
  }, [router]);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ no: number; qtoken: string }>("student", "login", { code });
      rememberToken(r.no, r.qtoken); // 와이파이가 끊겨도 이 학생 기록을 나중에 보낼 수 있게
      router.replace("/me");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <BuddyLazy size={180} />
      <div>
        <h1 className="font-display text-4xl text-leaf">마음빛 길잡이</h1>
        <p className="mt-2 text-soft">오늘 마음은 어때요? 내 코드를 넣거나 QR을 찍어 들어와요.</p>
      </div>
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
    </main>
  );
}
