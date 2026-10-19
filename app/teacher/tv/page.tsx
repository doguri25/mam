"use client";
// 교실 TV 「우리 반 마음 날씨」: 아침 조회 때 큰 화면에 띄운다. 이름·번호·위험 표현 없이 반 전체 숫자만 보인다.
// 마음 친구 행렬은 누구 것인지 알 수 없게 꾸미지 않은 기본 모습으로, 감정 무리 순서로만 늘어선다.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BuddyFace from "@/components/BuddyFace";
import BuddyLazy from "@/components/BuddyLazy";
import { api } from "@/lib/api";
import { label } from "@/lib/date";
import type { Weather } from "@/lib/rules";
import { DEFAULT_LOOK, GROUPS, NUANCE, groupOf, type Group } from "@/lib/shared";

type Data = {
  date: string; slot: "am" | "pm" | "day"; now: "am" | "pm"; className: string; students: number;
  n: number; groups: Record<Group, number>; words: [string, number][]; weather: Weather; monthWords: [string, number][];
};

const WEATHER: Record<Weather, { icon: string; name: string; line: string; bg: string; heavy?: boolean }> = {
  sunny: { icon: "☀️", name: "맑음", line: "기분 좋은 하루예요! 이 밝은 기운을 친구에게도 나눠 줘요.", bg: "from-[#fff3c4] to-[#ffe08a]" },
  warm: { icon: "🌤️", name: "포근함", line: "마음이 차분하고 편안해요. 오늘도 천천히, 사이좋게!", bg: "from-[#e9f6ec] to-[#c9ebd2]" },
  partly: { icon: "⛅", name: "구름 조금", line: "대부분 맑지만 구름 낀 마음도 있어요. 서로 살짝 챙겨 줘요.", bg: "from-[#eaf3ff] to-[#fff3c4]" },
  rainbow: { icon: "🌈", name: "알록달록", line: "여러 가지 마음이 모였어요. 어떤 마음이든 다 괜찮아요.", bg: "from-[#fde7ef] via-[#fff3c4] to-[#e3f0ff]" },
  cloudy: { icon: "☁️", name: "흐림", line: "마음이 무거운 친구들이 있어요. 오늘은 서로 조금 더 다정하게.", bg: "from-[#eef0f3] to-[#d9dee6]", heavy: true },
  rain: { icon: "🌧️", name: "비", line: "슬픈 마음이 많은 날이에요. 따뜻한 말 한마디가 우산이 되어 줄 거예요.", bg: "from-[#e3edf9] to-[#c6d8f0]", heavy: true },
  storm: { icon: "⛈️", name: "천둥번개", line: "속상하고 화난 마음이 많아요. 크게 숨 쉬고, 천천히 말해 봐요.", bg: "from-[#f3e6e6] to-[#dcc9d6]", heavy: true },
  fog: { icon: "🌫️", name: "안개", line: "걱정되는 마음이 많아요. 함께 있으면 안개도 걷혀요.", bg: "from-[#efeaf7] to-[#ddd3ee]", heavy: true },
};
const ORDER: Group[] = ["joy", "calm", "sad", "fear", "angry"];
const FACE_OF: Record<Group, string> = { joy: "기뻐요", calm: "편안해요", sad: "슬퍼요", angry: "화나요", fear: "걱정돼요" };
const SLOTS = [["am", "☀️ 아침"], ["pm", "🌇 하교 전"], ["day", "🗓️ 하루 전체"]] as const;
const MIN = 3; // 이보다 적으면 누구 마음인지 짐작될 수 있어 숫자를 보이지 않는다

export default function ClassTV() {
  const [data, setData] = useState<Data | null>(null);
  const [slot, setSlot] = useState<"am" | "pm" | "day" | null>(null);
  const [locked, setLocked] = useState(false);
  const [view, setView] = useState<"weather" | "words">("weather");

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const d = await api<Data>("teacher", "classWeather", slot ? { slot } : { slot: "now" });
      setData(d);
      setLocked(false);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setLocked(true);
    }
  }, [slot]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load는 fetch가 끝난 뒤에만 setState한다
    load();
    const id = setInterval(load, 30_000); // 학생들이 기록하는 동안 30초마다 새로
    return () => clearInterval(id);
  }, [load]);

  if (locked)
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="card space-y-4">
          <p className="text-5xl">🔒</p>
          <p className="font-display text-2xl">선생님 화면에서 비밀번호를 넣은 뒤 다시 열어 주세요.</p>
          <Link href="/teacher" className="btn-main">선생님 화면으로</Link>
        </div>
      </main>
    );
  if (!data) return <main className="grid min-h-dvh place-items-center text-2xl text-soft">우리 반 마음 날씨를 불러오는 중…</main>;

  // 처음엔 지금 시간(아침·하교 전)을 보여 주다가, 선생님이 고르면 그걸 따른다
  const shown = slot ?? data.now;
  const w = WEATHER[data.weather];
  const enough = data.n >= MIN;
  const top = ORDER.reduce((a, g) => (data.groups[g] > data.groups[a] ? g : a), "joy" as Group);
  const parade = ORDER.flatMap((g) => Array.from({ length: data.groups[g] }, () => g));

  return (
    // 글자·그림 크기를 화면 높이(vh)에 맞춰 1280×720 프로젝터에서도 한 화면에 다 들어오게
    <main className={`flex h-dvh flex-col gap-[clamp(0.6rem,2vh,1.5rem)] overflow-hidden bg-gradient-to-br ${enough ? w.bg : "from-paper to-leaf-soft"} p-[clamp(1rem,3vh,2.5rem)]`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[clamp(1rem,2.4vh,1.5rem)] text-soft">{data.className} · {label(data.date)}</p>
          <h1 className="font-display text-[clamp(2rem,5.5vh,3.75rem)] leading-tight">우리 반 마음 날씨</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 opacity-80 hover:opacity-100">
          <div role="group" aria-label="시간" className="flex rounded-2xl border border-line bg-card p-1">
            {SLOTS.map(([id, name]) => (
              <button key={id} onClick={() => setSlot(id)} aria-pressed={shown === id} className={`rounded-xl px-3 py-2 text-sm font-bold lg:text-base ${shown === id ? "bg-leaf text-white" : "text-soft"}`}>
                {name}
              </button>
            ))}
          </div>
          <div role="group" aria-label="보기" className="flex rounded-2xl border border-line bg-card p-1">
            {([["weather", "🌤️ 날씨"], ["words", "📖 단어 사전"]] as const).map(([id, name]) => (
              <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={`rounded-xl px-3 py-2 text-sm font-bold lg:text-base ${view === id ? "bg-leaf text-white" : "text-soft"}`}>{name}</button>
            ))}
          </div>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="btn-sub min-h-10 px-3 text-sm">⛶ 전체 화면</button>
          <Link href="/teacher" className="btn-sub min-h-10 px-3 text-sm">선생님 화면</Link>
        </div>
      </header>

      {view === "words" ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-[clamp(0.75rem,3vh,2rem)] text-center">
          <p className="font-display text-[clamp(1.5rem,4.5vh,3rem)]">📖 우리 반이 요즘 쓴 감정 단어</p>
          {data.monthWords.length ? (
            <p className="flex max-w-6xl flex-wrap items-baseline justify-center gap-x-[clamp(0.75rem,2.5vw,2rem)] gap-y-2">
              {data.monthWords.map(([word, k]) => {
                const max = data.monthWords[0][1];
                const parent = Object.keys(NUANCE).find((e) => NUANCE[e].includes(word));
                return (
                  <span key={word} className="font-display leading-tight" style={{ fontSize: `clamp(1.25rem, ${2.4 + (k / max) * 5}vh, ${1.5 + (k / max) * 3}rem)`, color: parent ? GROUPS[groupOf(parent)].color : undefined }}>
                    {word}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-[clamp(1.25rem,3vh,2rem)] text-soft">감정 카드에서 「더 꼭 맞는 말」을 골라 보면 여기에 모여요!</p>
          )}
          <p className="text-[clamp(1rem,2.4vh,1.5rem)] text-soft">최근 30일 · 많이 쓴 말일수록 크게 · 이름 없이 우리 반 전체</p>
        </section>
      ) : !enough ? (
        <section className="grid flex-1 place-items-center text-center">
          <div className="space-y-4">
            <BuddyLazy emotion="기뻐요" size={260} className="mx-auto size-56 lg:size-[300px]" />
            <p className="font-display text-4xl lg:text-5xl">아직 마음을 남긴 친구가 적어요</p>
            <p className="text-2xl text-soft lg:text-3xl">마음을 남기면 우리 반 날씨가 나타나요! (지금 {data.n}명)</p>
          </div>
        </section>
      ) : (
        <>
          <section className="grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] items-center gap-[clamp(0.75rem,2vh,1.5rem)]">
            <div className="space-y-[clamp(0.5rem,1.6vh,1rem)] rounded-[2rem] bg-card/80 p-[clamp(1rem,3.5vh,2.5rem)] shadow-sm">
              <p className="flex items-center gap-4">
                <span className="text-[clamp(4rem,14vh,10rem)] leading-none" aria-hidden>{w.icon}</span>
                <span className="font-display text-[clamp(3rem,8vh,6rem)] leading-none">{w.name}</span>
              </p>
              <p className="font-display text-[clamp(1.5rem,4.2vh,3rem)] leading-snug">{w.line}</p>
              {w.heavy && <p className="text-[clamp(1rem,2.4vh,1.5rem)] text-soft">🧰 마음이 힘들면 마음 친구의 「마음 다스리기」를 해 봐요.</p>}
            </div>
            <div className="flex flex-col items-center gap-2">
              <BuddyLazy emotion={FACE_OF[top]} intensity={3} size={300} className="size-[clamp(140px,30vh,320px)]" />
              <p className="font-display text-[clamp(1.5rem,3.6vh,2.25rem)]">마음을 남긴 친구 <b className="text-leaf">{data.n}</b> / {data.students}명</p>
            </div>
          </section>

          <section className="grid grid-cols-[1.3fr_1fr] gap-[clamp(0.75rem,2vh,1.5rem)]">
            <div className="rounded-[2rem] bg-card/80 p-[clamp(0.75rem,2.2vh,1.5rem)]">
              <div className="flex h-[clamp(1.5rem,5vh,3.5rem)] overflow-hidden rounded-full">
                {ORDER.filter((g) => data.groups[g]).map((g) => (
                  <div key={g} style={{ width: `${(data.groups[g] / data.n) * 100}%`, background: GROUPS[g].color }} />
                ))}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[clamp(1.125rem,2.8vh,1.875rem)]">
                {ORDER.map((g) => (
                  <span key={g} className="flex items-center gap-2">
                    <span className="size-5 rounded-full" style={{ background: GROUPS[g].color }} />
                    {GROUPS[g].label} <b>{data.groups[g]}</b>
                  </span>
                ))}
              </p>
            </div>
            <div className="rounded-[2rem] bg-card/80 p-[clamp(0.75rem,2.2vh,1.5rem)]">
              <p className="mb-2 text-[clamp(1rem,2.4vh,1.5rem)] text-soft">오늘 우리 반이 쓴 감정 단어</p>
              {data.words.length ? (
                <p className="flex flex-wrap gap-2">
                  {data.words.slice(0, 6).map(([word, k]) => (
                    <span key={word} className="rounded-full bg-leaf-soft px-4 py-1 font-display text-[clamp(1.125rem,2.8vh,1.875rem)]">{word}{k > 1 && <span className="ml-1 text-[0.7em] text-soft">×{k}</span>}</span>
                  ))}
                </p>
              ) : (
                <p className="text-[clamp(1.125rem,2.8vh,1.875rem)] text-soft">감정 카드에서 「더 꼭 맞는 말」을 골라 봐요!</p>
              )}
            </div>
          </section>

          <section aria-label="마음 친구 행렬" className="flex shrink-0 flex-wrap justify-center gap-1">
            {parade.map((g, i) => (
              <span key={i} className="animate-bounce" style={{ animationDelay: `${(i % 7) * 0.15}s`, animationDuration: "2.4s" }}>
                <BuddyFace look={DEFAULT_LOOK} emotion={FACE_OF[g]} size={56} className="size-[clamp(32px,5.5vh,56px)]" />
              </span>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
