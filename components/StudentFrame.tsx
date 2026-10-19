"use client";
// 학생 화면의 작은 페이지들(돌아보기·놀이·사전·쪽지)이 함께 쓰는 틀: 로그인 확인, 고른 언어, 큰 「돌아가기」 단추.
// 태블릿에서 손가락으로 누르기 쉽게 단추를 크게, 가로·세로 모두 한 손에 들어오게 둔다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLang, t, type Lang, type UIKey } from "@/lib/i18n";
import { useLocal } from "@/lib/local";
import type { BuddyLook } from "@/lib/shared";

export type StudentMe = {
  no: number; alias: string; className: string; vocab: string[]; today: string; look: BuddyLook;
  words: string[]; unread: number; reflected: boolean; demo: boolean;
};

export function useStudent() {
  const router = useRouter();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [langRaw] = useLocal(`mb_lang_${me?.no ?? 0}`);
  const lang: Lang = isLang(langRaw) ? langRaw : "ko";
  useEffect(() => {
    api<StudentMe>("student", "me").then(setMe, () => router.replace("/"));
  }, [router]);
  const tt = (k: UIKey, vars?: Record<string, string | number>) => t(lang, k, vars);
  return { me, lang, tt };
}

export default function StudentFrame({ title, lang, children, wide }: { title: string; lang: Lang; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto px-4 py-4 sm:px-6 sm:py-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`} lang={lang}>
      <header className="mb-4 flex items-center gap-3">
        <Link href="/me" className="btn-sub min-h-12 shrink-0 whitespace-nowrap px-4 text-base">← {t(lang, "buddyBack")}</Link>
        <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      </header>
      {children}
    </main>
  );
}

export const Loading = () => <main className="grid min-h-dvh place-items-center text-soft">…</main>;
