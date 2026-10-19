"use client";
// 마음 다스리기 도구 상자: 도구 고르기 → 마음 친구와 해 보기 → 「지금 마음은 어때?」
// 고른 느낌은 오늘 기록에 붙어 선생님이 「어떤 도구가 이 아이에게 도움이 되는지」 볼 수 있다. 그림은 저장하지 않는다.
import { useEffect, useRef, useState } from "react";
import BuddyLazy from "./BuddyLazy";
import { t, type Lang, type UIKey } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { BREATH_MS, CALM_TOOLS, FELT, type BuddyLook, type CalmTool, type Felt } from "@/lib/shared";

const ICON: Record<CalmTool, string> = { breathe: "🫧", squeeze: "✊", senses: "🔎", draw: "🎨" };
const FELT_ICON: Record<Felt, string> = { better: "😊", same: "😐", unsure: "🤔" };
type Common = { look: BuddyLook; emotion?: string; lang: Lang };

// 숨 고르기·꼭 쥐었다 펴기: 8초 박자(앞 4초 들이쉼·쥐기, 뒤 4초 내쉼·펴기)를 3번
function Rhythm({ mode, look, emotion, lang, onDone, onStop }: Common & { mode: "breathe" | "squeeze"; onDone: () => void; onStop: () => void }) {
  const [ms, setMs] = useState(0);
  const finished = ms >= BREATH_MS * 3;
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setMs((m) => m + 100), 100);
    return () => clearInterval(id);
  }, [finished]);
  const first = ms % BREATH_MS < BREATH_MS / 2;
  const line = finished ? t(lang, "breatheDone")
    : mode === "breathe" ? t(lang, first ? "breatheIn" : "breatheOut")
    : t(lang, first ? "squeezeIn" : "squeezeOut");
  useEffect(() => speak(line, false, lang), [line, lang]); // 「읽어 주기」를 켠 학생에게만 소리로
  const beat = finished ? undefined : ms;
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <BuddyLazy emotion={emotion} look={look} breath={mode === "breathe" ? beat : undefined} squeeze={mode === "squeeze" ? beat : undefined} size={260} className="size-56 sm:size-[260px]" />
      <p className="font-display text-3xl text-leaf" aria-live="polite">{line}</p>
      {!finished && <p className="text-soft">{t(lang, "breatheCount", { n: Math.floor(ms / BREATH_MS) + 1 })}</p>}
      <button onClick={finished ? onDone : onStop} className={finished ? "btn-main px-8" : "btn-sub"}>{finished ? t(lang, "nextBtn") : t(lang, "breatheNo")}</button>
    </div>
  );
}

// 5-4-3-2-1 찾기: 보이는 것 5 · 만질 수 있는 것 4 · 들리는 것 3 · 냄새 2 · 나에게 해 줄 좋은 말 1
const SENSES: [UIKey, string][] = [["senses1", "👀"], ["senses2", "✋"], ["senses3", "👂"], ["senses4", "👃"], ["senses5", "💗"]];
function Senses({ look, emotion, lang, onDone, onStop }: Common & { onDone: () => void; onStop: () => void }) {
  const [i, setI] = useState(0);
  const [key, emoji] = SENSES[i];
  useEffect(() => speak(t(lang, key), false, lang), [key, lang]);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_200px]">
      <div className="space-y-4 text-center sm:text-left">
        <p className="flex items-center justify-center gap-3 sm:justify-start">
          <span className="grid size-20 place-items-center rounded-full bg-leaf font-display text-5xl text-white">{5 - i}</span>
          <span className="text-6xl" aria-hidden>{emoji}</span>
        </p>
        <h2 className="font-display text-3xl leading-snug" aria-live="polite">{t(lang, key)}</h2>
        <div className="flex justify-center gap-1.5 sm:justify-start" aria-hidden>
          {SENSES.map((_, k) => <span key={k} className={`h-2.5 w-8 rounded-full ${k <= i ? "bg-leaf" : "bg-line"}`} />)}
        </div>
        <div className="flex justify-center gap-2 sm:justify-start">
          <button onClick={() => (i < 4 ? setI(i + 1) : onDone())} className="btn-main px-8 text-lg">{t(lang, "sensesFound")}</button>
          <button onClick={onStop} className="btn-sub">{t(lang, "breatheNo")}</button>
        </div>
      </div>
      <BuddyLazy emotion={emotion} look={look} cheer={i} size={200} className="mx-auto size-40 sm:size-[200px]" />
    </div>
  );
}

// 마음 그리기: 손가락·펜으로 그리고, 저장하지 않는다
const INKS = ["#2d3a33", "#E25A52", "#F2B705", "#5FB672", "#4F8FE0", "#9B6BD3", "#ff9eb0"];
function Draw({ lang, onDone, onStop }: { lang: Lang; onDone: () => void; onStop: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState(INKS[4]);
  const [wide, setWide] = useState(10);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 900, y: ((e.clientY - r.top) / r.height) * 600 };
  };
  function line(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current?.getContext("2d");
    if (!c || !last.current) return;
    const p = at(e);
    c.strokeStyle = ink;
    c.lineWidth = wide;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
  }
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-soft">{t(lang, "drawHint")}</p>
      <canvas
        ref={canvas}
        width={900}
        height={600}
        className="aspect-[3/2] w-full touch-none rounded-2xl border-2 border-line bg-white"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = at(e); line(e); }}
        onPointerMove={(e) => last.current && line(e)}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
        aria-label={t(lang, "tool_draw")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {INKS.map((c) => (
            <button key={c} onClick={() => setInk(c)} aria-label={c} aria-pressed={ink === c} className={`size-9 rounded-full border-4 ${ink === c ? "border-ink" : "border-card"}`} style={{ background: c }} />
          ))}
          {[6, 14, 28].map((w) => (
            <button key={w} onClick={() => setWide(w)} aria-pressed={wide === w} className={`grid size-9 place-items-center rounded-full border ${wide === w ? "border-leaf bg-leaf-soft" : "border-line"}`} aria-label={`${w}`}>
              <span className="rounded-full bg-ink" style={{ width: w / 2 + 3, height: w / 2 + 3 }} />
            </button>
          ))}
          <button onClick={() => canvas.current?.getContext("2d")?.clearRect(0, 0, 900, 600)} className="btn-sub min-h-9 px-3 text-sm">{t(lang, "drawClear")}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={onStop} className="btn-sub">{t(lang, "breatheNo")}</button>
          <button onClick={onDone} className="btn-main px-6">{t(lang, "drawDone")}</button>
        </div>
      </div>
    </div>
  );
}

export default function CalmBox({ look, emotion, lang, onFelt, onClose }: Common & { onFelt: (tool: CalmTool, felt: Felt) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<"pick" | CalmTool | "felt" | "thanks">("pick");
  const [tool, setTool] = useState<CalmTool>("breathe");
  const [cheer, setCheer] = useState(0);
  const tt = (k: UIKey) => t(lang, k);
  const back = () => setPhase("pick");
  const felt = () => setPhase("felt");

  if (phase === "breathe" || phase === "squeeze") return <Rhythm mode={phase} look={look} emotion={emotion} lang={lang} onDone={felt} onStop={back} />;
  if (phase === "senses") return <Senses look={look} emotion={emotion} lang={lang} onDone={felt} onStop={back} />;
  if (phase === "draw") return <Draw lang={lang} onDone={felt} onStop={back} />;
  if (phase === "felt" || phase === "thanks")
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <BuddyLazy emotion={emotion} look={look} cheer={cheer} size={180} className="size-40 sm:size-[180px]" />
        <h2 className="font-display text-3xl">{phase === "felt" ? tt("feltAsk") : tt("feltThanks")}</h2>
        {phase === "felt" ? (
          <div className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
            {FELT.map((f) => (
              <button key={f} onClick={() => { onFelt(tool, f); setCheer((n) => n + 1); setPhase("thanks"); }} className="chip flex flex-col items-center gap-1 p-4 text-lg font-bold hover:border-leaf">
                <span className="text-4xl" aria-hidden>{FELT_ICON[f]}</span>
                {tt(`felt_${f}` as UIKey)}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={back} className="btn-sub">{tt("calmOpen")}</button>
            <button onClick={onClose} className="btn-main px-8">{tt("buddyBack")}</button>
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl">{tt("calmTitle")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CALM_TOOLS.map((k) => (
          <button key={k} onClick={() => { setTool(k); setPhase(k); }} className="chip flex items-center gap-4 p-5 text-left hover:border-leaf">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-leaf-soft text-4xl" aria-hidden>{ICON[k]}</span>
            <span>
              <span className="block font-display text-2xl">{tt(`tool_${k}` as UIKey)}</span>
              <span className="text-sm text-soft">{tt(`tool_${k}_sub` as UIKey)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="btn-sub">{tt("calmLater")}</button>
      </div>
    </div>
  );
}
