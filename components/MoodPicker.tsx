"use client";
// 감정 그림카드 12장 · 마음 크기 1~5 · 까닭 5개. 처음엔 아무것도 골라 두지 않는다.
import { useState } from "react";
import { EmotionArt, EMOTION_COLOR, ReasonArt } from "./Art";
import { speak } from "@/lib/local";
import { EMOTIONS, GROUPS, INTENSITY, REASONS, type Group } from "@/lib/shared";

export interface Pick {
  emotion?: string;
  intensity?: number;
  reason?: string;
}

export default function MoodPicker({ value, onChange, vocab }: { value: Pick; onChange: (v: Pick) => void; vocab: string[] }) {
  const [help, setHelp] = useState(false);
  const color = value.emotion ? EMOTION_COLOR[value.emotion] : "#f2b705";
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-xl">① 지금 마음과 가까운 카드를 골라요</h3>
          <button type="button" onClick={() => setHelp(!help)} className="shrink-0 text-sm text-leaf underline underline-offset-4">
            {help ? "도움판 닫기" : "잘 모르겠어요"}
          </button>
        </div>
        {help && (
          <div className="mb-3 space-y-2 rounded-2xl bg-leaf-soft p-4 text-left text-sm">
            {(Object.keys(GROUPS) as Group[]).map((g) => (
              <p key={g} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="w-10">{GROUPS[g].label}</b>
                {EMOTIONS.filter((e) => e.group === g).map((e) => (
                  <span key={e.name} className="inline-flex items-center gap-1">
                    <EmotionArt name={e.name} size={22} /> {e.name}
                  </span>
                ))}
              </p>
            ))}
            {vocab.length > 0 && <p>우리 반에서 배운 마음 단어: {vocab.join(", ")}</p>}
            <p className="text-soft">예) “쉬는 시간에 혼자 있어서 서운했어요” → 속상해요 · 친구</p>
            <p className="text-soft">예) “발표를 잘해서 뿌듯했어요” → 기뻐요 · 공부</p>
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
                  onChange({ ...value, emotion: e.name });
                  speak(e.name);
                }}
                className={`chip flex flex-col items-center gap-1 pb-2.5 pt-3 ${on ? "chip-on" : ""}`}
                style={on ? { borderColor: EMOTION_COLOR[e.name], background: `${EMOTION_COLOR[e.name]}1f` } : undefined}
              >
                <EmotionArt name={e.name} size={60} />
                <span className="text-sm font-bold">{e.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl">② 마음이 얼마나 큰가요?</h3>
        <div className="grid grid-cols-5 gap-2">
          {INTENSITY.map((label, i) => {
            const on = value.intensity === i + 1;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={`${i + 1} ${label}`}
                onClick={() => {
                  onChange({ ...value, intensity: i + 1 });
                  speak(label);
                }}
                className={`chip flex flex-col items-center justify-end gap-1.5 pb-2 pt-3 ${on ? "chip-on" : ""}`}
              >
                <span className="flex h-12 items-end gap-0.5">
                  {[0, 1, 2, 3, 4].map((k) => (
                    <span key={k} className="w-1.5 rounded-full" style={{ height: 8 + k * 9, background: k <= i ? color : "#e8e2d6" }} />
                  ))}
                </span>
                <span className="text-xs font-bold sm:text-sm">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-xl">③ 무엇 때문일까요?</h3>
        <div className="grid grid-cols-5 gap-2">
          {REASONS.map((r) => (
            <button
              key={r.name}
              type="button"
              aria-pressed={value.reason === r.name}
              onClick={() => {
                onChange({ ...value, reason: r.name });
                speak(r.name);
              }}
              className={`chip flex flex-col items-center gap-1 py-2.5 ${value.reason === r.name ? "chip-on" : ""}`}
            >
              <ReasonArt name={r.name} size={46} />
              <span className="text-sm font-bold">{r.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
