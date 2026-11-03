"use client";
// 마음 친구: 손으로 그린 2D 셀 애니메이션처럼 움직인다(WebGL 없이 SVG).
// - 1초에 12장(「투스」)만 바꿔 그리고, 선은 1초에 8번 다시 그린 듯 떨린다(boil).
// - 감정 12가지마다 눈·눈썹·입·볼·몸짓·효과(반짝임·하트·눈물·김…)가 다르고, 세기(1~5)만큼 크게.
// - cheer: 값이 바뀔 때마다 한 번 인사(폴짝 두 번 + 손 흔들기, 힘든 마음은 끄덕이며 가슴 토닥)
// - breath: 숨 고르기 시작부터 지난 ms(들이쉬며 부풀고 내쉬며 「후~」) · squeeze: 꼭 쥐었다 펴기(움츠렸다 「휴~」)
// - scene: 큰 자리에서는 감정 따라 바뀌는 그림 같은 배경 장면(하늘·구름·언덕·날씨)
// 화면 밖이거나 「동작 줄이기」 설정이면 멈춘 한 장만 그린다.
import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOOK, type BuddyLook } from "@/lib/shared";
import BuddyArt from "./buddy/BuddyArt";
import { exprOf, moodOf, pose } from "./buddy/expr";

export interface BuddyProps {
  emotion?: string;
  intensity?: number;
  look?: BuddyLook;
  cheer?: number;
  breath?: number;
  squeeze?: number;
  size?: number;
  className?: string;
  scene?: boolean;
}

const FPS = 12;

export default function Buddy({ emotion, intensity = 3, look = DEFAULT_LOOK, cheer, breath, squeeze, size = 200, className, scene }: BuddyProps) {
  const box = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState({ frame: 0, cheerAt: -99 });
  const cheerRef = useRef(cheer);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    let raf = 0, seen = true, last = -1, lastCheer = cheerRef.current;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; });
    if (box.current) io.observe(box.current);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!seen) return;
      const frame = Math.floor(((now - start) / 1000) * FPS);
      if (frame === last) return;
      last = frame;
      const c = cheerRef.current;
      if (c !== lastCheer) { lastCheer = c; setClock({ frame, cheerAt: frame }); } // 처음 그릴 때는 인사하지 않음
      else setClock((o) => ({ ...o, frame }));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);
  useEffect(() => { cheerRef.current = cheer; }, [cheer]);

  const t = clock.frame / FPS;
  const since = (clock.frame - clock.cheerAt) / FPS;
  const expr = exprOf(emotion);
  const mood = moodOf(emotion);
  const p = pose({ t, expr, intensity, cheer: since < 1.8 ? since : null, hard: mood === "sad" || mood === "angry" || mood === "fear", breath, squeeze });
  return (
    <div ref={box} className={className} style={className ? undefined : { width: size, height: size }} aria-hidden>
      <BuddyArt look={look} mood={mood} expr={expr} pose={p} t={t} boil={Math.floor(clock.frame / 1.5) % 3} scene={scene} size={size} className="size-full" />
    </div>
  );
}
