"use client";
// 숨 고르기: 마음 친구가 부풀었다(들이쉼) 줄어드는(내쉼) 대로 3번 함께 숨쉬기. 언제든 그만둘 수 있다.
import { useEffect, useState } from "react";
import BuddyLazy from "./BuddyLazy";
import { t, type Lang } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { BREATH_MS, type BuddyLook } from "@/lib/shared";

const ROUNDS = 3;

export default function Breathe({ look, emotion, lang, onDone }: { look: BuddyLook; emotion?: string; lang: Lang; onDone: () => void }) {
  const [ms, setMs] = useState(0);
  const finished = ms >= BREATH_MS * ROUNDS;
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setMs((m) => m + 100), 100);
    return () => clearInterval(id);
  }, [finished]);
  const inhale = ms % BREATH_MS < BREATH_MS / 2;
  const line = finished ? t(lang, "breatheDone") : t(lang, inhale ? "breatheIn" : "breatheOut");
  useEffect(() => speak(line, false, lang), [line, lang]); // 「읽어 주기」를 켠 학생에게만 소리로

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <BuddyLazy emotion={emotion} look={look} breath={finished ? undefined : ms} size={260} className="size-56 sm:size-[260px]" />
      <p className="font-display text-3xl text-leaf" aria-live="polite">{line}</p>
      {!finished && <p className="text-soft">{t(lang, "breatheCount", { n: Math.floor(ms / BREATH_MS) + 1 })}</p>}
      <button onClick={onDone} className={finished ? "btn-main" : "btn-sub"}>{finished ? t(lang, "buddyBack") : t(lang, "breatheNo")}</button>
    </div>
  );
}
