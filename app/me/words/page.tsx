"use client";
// 우리 반 감정 단어 사전: 12가지 감정마다 더 꼭 맞는 말 3개와 쉬운 뜻, 우리 반이 몇 번 썼는지(이름 없이), 내가 써 봤는지.
import { useEffect, useState } from "react";
import { EMOTION_COLOR, EmotionArt } from "@/components/Art";
import StudentFrame, { Loading, useStudent } from "@/components/StudentFrame";
import { api } from "@/lib/api";
import { MEANING } from "@/lib/game";
import { w } from "@/lib/i18n";
import { NUANCE } from "@/lib/shared";

type Dict = { counts: Record<string, number>; mine: string[]; vocab: string[] };

export default function WordsPage() {
  const { me, lang, tt } = useStudent();
  const [dict, setDict] = useState<Dict | null>(null);
  useEffect(() => {
    api<Dict>("student", "dictionary").then(setDict, () => {});
  }, []);
  if (!me || !dict) return <Loading />;
  const extra = dict.vocab.filter((v) => !Object.values(NUANCE).flat().includes(v)); // 교과서에서 더한 말

  const Word = ({ word }: { word: string }) => {
    const n = dict.counts[word] ?? 0;
    return (
      <div className={`rounded-2xl border-2 p-3 ${dict.mine.includes(word) ? "border-leaf bg-leaf-soft/50" : "border-line bg-card"}`}>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-xl">{w(lang, word)}</b>
          {lang !== "ko" && <span className="text-sm text-soft">{word}</span>}
          {dict.vocab.includes(word) && <span className="text-sm" title={tt("dictClass")}>⭐</span>}
        </p>
        {MEANING[word] && <p className="mt-1 text-sm">{MEANING[word]}</p>}
        <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${n ? "bg-sun/30" : "bg-paper text-soft"}`}>{n ? tt("dictUsed", { n }) : tt("dictNew")}</span>
          {dict.mine.includes(word) && <span className="rounded-full bg-leaf px-2 py-0.5 text-white">✓ {tt("dictMine")}</span>}
        </p>
      </div>
    );
  };

  return (
    <StudentFrame title={tt("tileWords")} lang={lang} wide>
      <p className="mb-4 rounded-2xl bg-leaf-soft p-3 text-lg">{tt("growWords", { n: dict.mine.length })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(NUANCE).map(([emotion, words]) => (
          <section key={emotion} className="card space-y-2">
            <h2 className="flex items-center gap-2 font-display text-2xl" style={{ color: EMOTION_COLOR[emotion] }}>
              <EmotionArt name={emotion} size={40} /> {w(lang, emotion)}
            </h2>
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {words.map((x) => <Word key={x} word={x} />)}
            </div>
          </section>
        ))}
        {extra.length > 0 && (
          <section className="card space-y-2 md:col-span-2">
            <h2 className="font-display text-2xl">📚 {tt("dictClass")}</h2>
            <div className="grid gap-2 sm:grid-cols-3">{extra.map((x) => <Word key={x} word={x} />)}</div>
          </section>
        )}
      </div>
    </StudentFrame>
  );
}
