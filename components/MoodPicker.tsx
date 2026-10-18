"use client";
// 감정 그림카드 12장 → (더 꼭 맞는 말) → 마음 크기 1~5 → 까닭 5개. 처음엔 아무것도 골라 두지 않는다.
import { useState } from "react";
import { EmotionArt, EMOTION_COLOR, ReasonArt } from "./Art";
import { t, w, type Lang } from "@/lib/i18n";
import { speak } from "@/lib/local";
import { EMOTIONS, GROUPS, INTENSITY, NUANCE, REASONS, type Group } from "@/lib/shared";

export interface Pick {
  emotion?: string;
  intensity?: number;
  reason?: string;
  word?: string;
}

export default function MoodPicker({ value, onChange, vocab, lang }: { value: Pick; onChange: (v: Pick) => void; vocab: string[]; lang: Lang }) {
  const [help, setHelp] = useState(false);
  const color = value.emotion ? EMOTION_COLOR[value.emotion] : "#f2b705";
  const say = (ko: string) => speak(w(lang, ko), false, lang);
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-xl">{t(lang, "q1")}</h3>
          <button type="button" onClick={() => setHelp(!help)} className="shrink-0 text-sm text-leaf underline underline-offset-4">
            {help ? t(lang, "helpClose") : t(lang, "help")}
          </button>
        </div>
        {help && (
          <div className="mb-3 space-y-2 rounded-2xl bg-leaf-soft p-4 text-left text-sm">
            {(Object.keys(GROUPS) as Group[]).map((g) => (
              <p key={g} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="w-16">{w(lang, GROUPS[g].label)}</b>
                {EMOTIONS.filter((e) => e.group === g).map((e) => (
                  <span key={e.name} className="inline-flex items-center gap-1">
                    <EmotionArt name={e.name} size={22} /> {w(lang, e.name)}
                  </span>
                ))}
              </p>
            ))}
            {vocab.length > 0 && <p>{t(lang, "classWords")}: {vocab.map((x) => w(lang, x)).join(", ")}</p>}
            {lang === "ko" && (
              <>
                <p className="text-soft">예) “쉬는 시간에 혼자 있어서 서운했어요” → 속상해요 · 친구</p>
                <p className="text-soft">예) “발표를 잘해서 뿌듯했어요” → 기뻐요 · 공부</p>
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {EMOTIONS.map((e) => {
            const on = value.emotion === e.name;
            return (
              <button
                key={e.name}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange({ ...value, emotion: e.name, word: undefined });
                  say(e.name);
                }}
                className={`chip flex flex-col items-center gap-1 pb-2.5 pt-3 ${on ? "chip-on" : ""}`}
                style={on ? { borderColor: EMOTION_COLOR[e.name], background: `${EMOTION_COLOR[e.name]}1f` } : undefined}
              >
                <EmotionArt name={e.name} size={60} />
                <span className="text-sm font-bold">{w(lang, e.name)}</span>
                {lang !== "ko" && <span className="text-[11px] text-soft">{e.name}</span>}
              </button>
            );
          })}
        </div>

        {/* 감정 단어 키우기: 큰 감정을 고르면 더 꼭 맞는 말 세 개 */}
        {value.emotion && NUANCE[value.emotion] && (
          <div className="mt-3 rounded-2xl border-2 border-dashed p-3" style={{ borderColor: `${color}88` }}>
            <p className="font-bold">{t(lang, "nuance")} <span className="text-xs font-normal text-soft">{t(lang, "nuanceSkip")}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NUANCE[value.emotion].map((word) => {
                const on = value.word === word;
                const learned = vocab.includes(word);
                return (
                  <button
                    key={word}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onChange({ ...value, word: on ? undefined : word });
                      if (!on) say(word);
                    }}
                    className={`rounded-full border-2 px-4 py-2 text-base font-bold transition ${on ? "text-white" : "bg-card"}`}
                    style={{ borderColor: color, background: on ? color : undefined }}
                  >
                    {w(lang, word)}
                    {lang !== "ko" && <span className={`ml-1 text-xs font-normal ${on ? "text-white/80" : "text-soft"}`}>{word}</span>}
                    {learned && <span className="ml-1 text-xs" title={t(lang, "learned")}>⭐</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl">{t(lang, "q2")}</h3>
        <div className="grid grid-cols-5 gap-2">
          {INTENSITY.map((label, i) => {
            const on = value.intensity === i + 1;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={`${i + 1} ${w(lang, label)}`}
                onClick={() => {
                  onChange({ ...value, intensity: i + 1 });
                  say(label);
                }}
                className={`chip flex flex-col items-center justify-end gap-1.5 pb-2 pt-3 ${on ? "chip-on" : ""}`}
              >
                <span className="flex h-12 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((k) => (
                    <span key={k} className="w-1.5 rounded-full" style={{ height: 8 + k * 9, background: k <= i ? color : "#e8e2d6" }} />
                  ))}
                </span>
                <span className="text-xs font-bold sm:text-sm">{w(lang, label)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl">{t(lang, "q3")}</h3>
        <div className="grid grid-cols-5 gap-2">
          {REASONS.map((r) => (
            <button
              key={r.name}
              type="button"
              aria-pressed={value.reason === r.name}
              onClick={() => {
                onChange({ ...value, reason: r.name });
                say(r.name);
              }}
              className={`chip flex flex-col items-center gap-1 py-2.5 ${value.reason === r.name ? "chip-on" : ""}`}
            >
              <ReasonArt name={r.name} size={46} />
              <span className="text-center text-sm font-bold">{w(lang, r.name)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
