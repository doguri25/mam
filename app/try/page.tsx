"use client";
// 심사용 체험 입구: 비밀번호·학생 코드 없이 가짜 반으로 바로 들어가 선생님·학생·교실 TV를 모두 눌러 본다.
import Link from "next/link";
import { useState } from "react";
import BuddyLazy from "@/components/BuddyLazy";
import { api } from "@/lib/api";

type Kid = { no: number; alias: string; code: string };

export default function TryPage() {
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start(action: "start" | "reset" = "start") {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ students: Kid[] }>("try", action);
      setKids(r.students);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  async function end() {
    await api("try", "end").catch(() => {});
    setKids(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <BuddyLazy emotion="기뻐요" size={160} className="size-36 sm:size-40" />
        <p className="rounded-full bg-sun/30 px-4 py-1 text-sm font-bold">🧪 심사·둘러보기용 체험</p>
        <h1 className="font-display text-4xl sm:text-5xl">마음빛 길잡이 체험하기</h1>
        <p className="max-w-xl text-lg text-soft">
          비밀번호나 학생 코드 없이 <b className="text-ink">가짜 반(가명 25명, 최근 7일 기록)</b>으로 바로 들어가요.
          실제 반 기록과는 저장 공간부터 따로라 마음껏 눌러 봐도 괜찮아요.
        </p>
      </header>

      {!kids ? (
        <div className="card flex flex-col items-center gap-3 text-center">
          <button onClick={() => start()} disabled={busy} className="btn-main px-10 text-xl">{busy ? "체험 반을 준비하는 중… (처음엔 몇 초)" : "체험 시작하기"}</button>
          {err && <p className="text-alert">{err}</p>}
          <p className="text-sm text-soft">AI(되묻기·응원 초안·요약 등)는 체험 전체에서 하루 200번까지 써요. 다 쓰면 기본 질문으로 이어져요.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Link href="/teacher" className="card flex flex-col gap-2 hover:border-leaf">
              <span className="text-4xl" aria-hidden>👩‍🏫</span>
              <span className="font-display text-2xl">선생님으로 둘러보기</span>
              <span className="text-sm text-soft">마음 지도 · 응원 한마디 · 공감 쪽지 검토 · 상담 의견서 · 주간 리포트 · 가정 소식지</span>
            </Link>
            <a href="/teacher/tv" target="_blank" rel="noopener" className="card flex flex-col gap-2 hover:border-leaf">
              <span className="text-4xl" aria-hidden>📺</span>
              <span className="font-display text-2xl">교실 TV 화면</span>
              <span className="text-sm text-soft">아침 조회 때 띄우는 「우리 반 마음 날씨」(이름 없이 숫자만)</span>
            </a>
            <div className="card flex flex-col gap-2">
              <span className="text-4xl" aria-hidden>🧒</span>
              <span className="font-display text-2xl">학생으로 해 보기</span>
              <span className="text-sm text-soft">태블릿으로 열면 실제 교실과 같아요. 학생을 골라 들어가요.</span>
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3 font-display text-xl">어느 학생으로 들어가 볼까요?</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kids.map((k) => (
                <Link key={k.no} href={`/join?c=${k.code}`} className="chip flex flex-col items-center gap-1 p-4 text-lg font-bold hover:border-leaf">
                  <span className="text-sm text-soft">{k.no}번</span>
                  {k.alias}
                  {k.no === 3 && <span className="text-xs font-normal text-soft">살펴볼 신호가 있는 학생</span>}
                  {k.no === 2 && <span className="text-xs font-normal text-soft">꾸민 마음 친구</span>}
                </Link>
              ))}
            </div>
          </section>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => start("reset")} disabled={busy} className="btn-sub">체험 반을 처음 판으로</button>
            <button onClick={end} className="btn-sub">체험 끝내기</button>
          </div>
        </>
      )}
      <p className="text-center text-sm text-soft">
        실제 반 선생님은 <Link href="/teacher" className="underline">선생님 화면</Link>에서 비밀번호로 들어가요. 체험 중이면 먼저 「체험 끝내기」를 눌러 주세요.
      </p>
    </main>
  );
}
