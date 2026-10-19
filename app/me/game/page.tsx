"use client";
// 감정 단어 놀이: 상황을 읽고 알맞은 감정 단어를 고른다. 점수·순위는 없고, 틀리면 다시 생각해 볼 수 있다.
// 우리 반 감정 단어(교과서 연결)가 정답인 문제가 먼저 나온다.
import { useEffect, useMemo, useState } from "react";
import BuddyLazy from "@/components/BuddyLazy";
import StudentFrame, { Loading, useStudent } from "@/components/StudentFrame";
import { MEANING, makeRound } from "@/lib/game";
import { w } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { NUANCE } from "@/lib/shared";

const parentOf = (word: string) => Object.keys(NUANCE).find((k) => NUANCE[k].includes(word));

export default function GamePage() {
  const { me, lang, tt } = useStudent();
  const [round, setRound] = useState(1);
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [right, setRight] = useState(false);
  const [cheer, setCheer] = useState(0);
  const qs = useMemo(() => (me ? makeRound(me.vocab, me.no * 97 + round * 13) : []), [me, round]);
  const q = qs[i];
  useEffect(() => {
    if (q) speak(q.text[lang], false, lang);
  }, [q, lang]);

  if (!me) return <Loading />;
  const done = i >= qs.length;

  function pick(o: string) {
    if (right || wrong.includes(o)) return;
    if (o === q.answer) {
      setRight(true);
      setCheer((n) => n + 1);
      speak(tt("gameRight"), false, lang);
    } else setWrong([...wrong, o]);
  }
  function next() {
    setI(i + 1);
    setWrong([]);
    setRight(false);
  }

  return (
    <StudentFrame title={tt("tileGame")} lang={lang} wide>
      {done ? (
        <section className="card flex flex-col items-center gap-4 text-center">
          <BuddyLazy emotion="뿌듯해요" look={me.look} cheer={cheer} size={200} className="size-40 sm:size-[200px]" />
          <h2 className="font-display text-3xl">{tt("gameEnd")}</h2>
          <ul className="grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
            {qs.map((x) => (
              <li key={x.answer} className="rounded-2xl bg-paper p-3">
                <b className="text-lg">{w(lang, x.answer)}</b>{lang !== "ko" && <span className="ml-1 text-sm text-soft">{x.answer}</span>}
                <span className="block text-sm text-soft">{MEANING[x.answer]}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => { setRound(round + 1); setI(0); }} className="btn-main px-10 text-lg">{tt("gameMore")}</button>
        </section>
      ) : (
        <section className="card grid items-center gap-5 md:grid-cols-[1fr_200px]">
          <div className="space-y-5">
            <p className="flex items-center gap-2 text-sm font-bold text-leaf">
              {tt("gameAsk")}
              <span className="ml-auto flex gap-1" aria-label={`${i + 1}/${qs.length}`}>
                {qs.map((_, k) => <span key={k} className={`h-2.5 w-7 rounded-full ${k <= i ? "bg-leaf" : "bg-line"}`} />)}
              </span>
            </p>
            <h2 className="font-display text-3xl leading-snug sm:text-4xl">
              {q.text[lang]}
              <button onClick={() => speak(q.text[lang], true, lang)} className="ml-2 inline-grid size-10 place-items-center rounded-full bg-leaf-soft align-middle text-lg" aria-label="🔊">🔊</button>
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {q.options.map((o) => {
                const isRight = right && o === q.answer, isWrong = wrong.includes(o);
                return (
                  <button
                    key={o}
                    onClick={() => pick(o)}
                    className={`chip min-h-20 px-4 py-4 text-2xl font-bold ${isRight ? "border-leaf bg-leaf-soft" : isWrong ? "border-line text-soft line-through opacity-60" : "hover:border-leaf"}`}
                  >
                    {w(lang, o)}
                    {lang !== "ko" && <span className="block text-sm font-normal text-soft">{o}</span>}
                  </button>
                );
              })}
            </div>
            <div aria-live="polite" className="min-h-16">
              {right ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-soft p-4">
                  <p>
                    <b className="text-lg text-leaf">{tt("gameRight")}</b>
                    <span className="block">{w(lang, q.answer)} — {MEANING[q.answer]}{parentOf(q.answer) && <span className="text-soft"> ({w(lang, parentOf(q.answer)!)})</span>}</span>
                  </p>
                  <button onClick={next} className="btn-main px-8 text-lg">{tt("gameNext")}</button>
                </div>
              ) : wrong.length > 0 ? (
                <p className="rounded-2xl bg-paper p-4 text-lg">{tt("gameAgain")}</p>
              ) : null}
            </div>
          </div>
          <BuddyLazy emotion={right ? q.answer && parentOf(q.answer) : undefined} look={me.look} cheer={cheer} size={200} className="mx-auto size-36 md:size-[200px]" />
        </section>
      )}
    </StudentFrame>
  );
}
