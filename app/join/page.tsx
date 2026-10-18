"use client";
// QR 카드가 가리키는 주소: /join?c=코드 → 바로 로그인
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Join() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("c") ?? "";
    api("student", "login", { code }).then(
      () => router.replace("/me"),
      (e) => setError((e as Error).message),
    );
  }, [router]);

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
