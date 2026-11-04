"use client";
// QR 카드가 가리키는 주소: /join?c=코드 → 바로 로그인
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rememberToken } from "@/lib/queue";

export default function Join() {
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("c") ?? "";
    api<{ no: number; qtoken: string }>("student", "login", { code }).then(
      (r) => {
        rememberToken(r.no, r.qtoken);
        window.location.replace("/me"); // 화면을 새로 불러 앞 친구 화면 상태가 남지 않게
      },
      (e) => setError((e as Error).message),
    );
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      {error ? (
        <div className="card max-w-sm space-y-4">
          <p className="text-lg">QR 코드가 맞지 않아요. {error}</p>
          <Link href="/" className="btn-main w-full">코드로 들어가기</Link>
        </div>
      ) : (
        <p className="font-display text-2xl text-leaf">마음 친구에게 가는 중…</p>
      )}
    </main>
  );
}
