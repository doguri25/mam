"use client";
// 학생 첫 화면 띠 그림: 맑은 날 들판에 마음 친구 다섯이 저마다 다른 마음으로 놀다가,
// 7초마다 왼쪽 친구부터 차례로 폴짝 인사(파도타기)하고, 그때마다 다른 마음 표정으로 바뀐다(누가 어떤 마음인지는 buddy/parade.ts).
// 그림체는 마음 친구 장면과 같다(인물은 세피아 잉크선, 배경은 선 없이 수채·과슈). 친구 1초 24장 · 선 떨림 1초 8번 · 구름 1초 4번.
// 화면 밖이거나 「동작 줄이기」 설정이면 멈춘 한 장만 그린다.
import { memo, useEffect, useId, useRef, useState, type ReactNode } from "react";
import BuddyArt, { Cloud, Wash } from "./buddy/BuddyArt";
import { exprOf, moodOf, pose } from "./buddy/expr";
import { SCENE, cloudBumps, mix } from "./buddy/paint";
import { FRIENDS, PARADE_H as H, PARADE_W as W, friendAt } from "./buddy/parade";

const FPS = 24;
const BOIL_EVERY = 3;
const CLOUD_STEPS = 4;
const kit = SCENE.joy;
const n2 = (x: number) => Math.round(x * 100) / 100;
const LAYER = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
const STILL = { ...LAYER, willChange: "transform" } as const;
const VIEW = `0 0 ${W} ${H}`;
// 앞줄 친구는 뒤에 그려야 뒷줄을 가린다
const ORDER = FRIENDS.map((f, i) => [f, i] as const).sort(([a], [b]) => Number(b.back) - Number(a.back));

export default function BuddyParade({ className = "" }: { className?: string }) {
  const id = `p${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, seen = true, last = -1;
    const start = performance.now();
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; });
    if (box.current) io.observe(box.current);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!seen) return;
      const f = Math.max(0, Math.floor(((now - start) / 1000) * FPS)); // 첫 rAF 시각이 시작보다 앞설 수 있음
      if (f !== last) { last = f; setFrame(f); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  const t = frame / FPS;
  const boil = Math.floor(frame / BOIL_EVERY) % 3;
  return (
    <div ref={box} className={`relative w-full overflow-hidden rounded-3xl ${className}`} style={{ aspectRatio: `${W} / ${H}`, isolation: "isolate" }} aria-hidden>
      <ParadeStill id={`${id}s`} />
      <ParadeClouds id={`${id}c`} step={Math.floor(t * CLOUD_STEPS)} />
      {ORDER.map(([f, i]) => {
        const { feeling, cheer } = friendAt(i, t);
        const expr = exprOf(feeling);
        const mood = moodOf(feeling);
        const p = pose({ t: t + i * 0.83, expr, intensity: 3, cheer, hard: false }); // 몸짓 박자를 친구마다 조금씩 어긋나게
        // 마음 친구 그림 상자(장면 없이 그린 것)는 발이 위에서 87.5%, 몸 가운데가 50% 자리에 온다
        const style = { position: "absolute", left: `${((f.x - f.b / 2) / W) * 100}%`, top: `${((f.y - f.b * 0.875) / H) * 100}%`, width: `${(f.b / W) * 100}%`, height: `${(f.b / H) * 100}%` } as const;
        return (
          <div key={i} style={style}>
            <BuddyArt look={f.look} mood={mood} expr={expr} pose={p} t={t + i * 0.83} boil={(boil + i) % 3} size={f.b} className="size-full" aura={false} />
          </div>
        );
      })}
      <ParadeFront t={t} />
      <ParadeLight id={`${id}l`} />
    </div>
  );
}

function Tree({ x, y, s, dark }: { x: number; y: number; s: number; dark: string }) {
  const bumps = cloudBumps(26 * s, 13 * s, 5);
  return (
    <g>
      <path d={`M${x},${y} L${x},${n2(y - 16 * s)}`} stroke="#5a4232" strokeWidth={n2(3 * s)} />
      {bumps.map(([bx, by, r], i) => <circle key={i} cx={n2(x + bx)} cy={n2(y - 24 * s + by)} r={n2(r)} fill={mix(dark, "#1f3b22", 0.35)} />)}
      {bumps.map(([bx, by, r], i) => <circle key={`l${i}`} cx={n2(x + bx - 1.5)} cy={n2(y - 26 * s + by)} r={n2(r * 0.75)} fill={mix(dark, "#2f5a2c", 0.15)} />)}
    </g>
  );
}

// 하늘·해·먼 산·언덕·나무·풀밭: 한 번만 그린다
const ParadeStill = memo(function ParadeStill({ id }: { id: string }) {
  return (
    <svg viewBox={VIEW} style={STILL} aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={kit.sky[0]} />
          <stop offset="0.6" stopColor={kit.sky[1]} />
          <stop offset="1" stopColor={kit.sky[2]} />
        </linearGradient>
        <linearGradient id={`${id}near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={kit.near[0]} />
          <stop offset="1" stopColor={kit.near[1]} />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" stopColor={kit.glow} stopOpacity="0.95" />
          <stop offset="1" stopColor={kit.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        <Wash id={`${id}wash`} />
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <circle cx="266" cy="40" r="60" fill={`url(#${id}glow)`} />
      <circle cx="266" cy="40" r="15" fill={kit.sun!} filter={`url(#${id}blur)`} opacity="0.95" />
      <g filter={`url(#${id}wash)`}>
        {/* 먼 산 → 가까운 언덕(멀수록 푸르게) → 친구들이 선 풀밭 */}
        <path d="M0,114 Q28,92 62,104 T128,96 T196,88 T262,100 T320,92 V200 H0Z" fill={kit.far} />
        <path d="M0,114 Q28,92 62,104 T128,96 T196,88 T262,100 T320,92" fill="none" stroke={mix(kit.far, "#ffffff", 0.35)} strokeWidth="2" opacity="0.5" />
        <path d="M0,134 Q46,114 104,126 T214,122 T320,128 V200 H0Z" fill={kit.mid} />
        <Tree x={26} y={131} s={1.15} dark={kit.mid} />
        <Tree x={250} y={124} s={0.8} dark={kit.mid} />
        <Tree x={298} y={129} s={1.05} dark={kit.mid} />
        <path d="M-10,200 L-10,154 Q70,134 160,144 Q250,134 330,152 L330,200Z" fill={`url(#${id}near)`} />
      </g>
      {/* 풀포기: 세 잎씩 모여 난 풀, 풀밭 꼭대기에는 밝은 붓질 몇 번, 작은 꽃 */}
      {Array.from({ length: 22 }, (_, i) => {
        const x = ((i * 53 + 7) % 312) + 4, y = 158 + ((i * 29) % 40);
        return (
          <path key={i} d={`M${x},${y} q-2,-3 -3.5,-6 M${x},${y} q0,-4 0.5,-8 M${x},${y} q2,-3 3.5,-5`}
            stroke={mix(kit.grass, kit.near[0], 0.25)} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.75" />
        );
      })}
      {[[34, 151], [96, 145], [160, 147], [222, 145], [288, 150]].map(([x, y], i) => (
        <path key={`hl${i}`} d={`M${x - 9},${y + 1} q9,-3 18,0`} stroke={mix(kit.near[0], "#fffbe6", 0.4)} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={`f${i}`} cx={((i * 61 + 13) % 312) + 4} cy={156 + ((i * 23) % 42)} r="1.6" fill={i % 3 === 0 ? "#ffb3c4" : i % 2 ? "#ffffff" : "#ffe27a"} />
      ))}
    </svg>
  );
});

// 구름: 왼쪽→오른쪽(1) · 오른쪽→왼쪽(-1) · 제자리에서 살짝 떠 있기(0)가 섞여 흐른다(1초 4번 한 칸씩)
// [x, y, 너비, 높이, 씨앗, 방향, 빠르기]
const CLOUDS: [number, number, number, number, number, -1 | 0 | 1, number][] = [
  [34, 40, 74, 22, 1, 1, 1], [196, 26, 92, 26, 2, -1, 0.75], [132, 66, 54, 15, 3, 0, 0], [92, 14, 46, 12, 5, 1, 0.55], [300, 62, 60, 16, 4, -1, 1.1],
];
const ParadeClouds = memo(function ParadeClouds({ id, step }: { id: string; step: number }) {
  const t = step / CLOUD_STEPS;
  const at = (x: number, dir: number, speed: number) => (dir ? ((((x + 50 + dir * t * 3 * speed) % 420) + 420) % 420) - 50 : x);
  return (
    <svg viewBox={VIEW} style={LAYER} aria-hidden>
      <defs><Wash id={`${id}wash`} /></defs>
      <g filter={`url(#${id}wash)`}>
        {CLOUDS.map(([x, y, w, h, s, dir, speed]) => (
          <Cloud key={s} x={at(x, dir, speed)} y={dir ? y : y + Math.sin(t * 0.9 + s) * 1.4} w={w} h={h} kit={kit} seed={s} />
        ))}
      </g>
    </svg>
  );
});

// 앞쪽 풀포기·나비·민들레 씨: 필터 없이 가볍게, 1초 24장
function ParadeFront({ t }: { t: number }) {
  const parts: ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 120 + Math.sin(t * 0.7 + i * 3) * 26, y = 86 + Math.cos(t * 1.1 + i) * 12 - (i % 2) * 18;
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + i));
    parts.push(
      <g key={`b${i}`} transform={`translate(${n2(x)} ${n2(y)})`}>
        {[-1, 1].map((d) => <ellipse key={d} cx={n2(d * 2.4 * flap)} cy="0" rx={n2(2.6 * flap)} ry="2.2" fill={["#ffe17a", "#ffffff", "#ffc3d2"][i]} />)}
        <path d="M0,-2.5 V2.5" stroke="#4a3a2a" strokeWidth="1" />
      </g>,
    );
  }
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.05 + i / 4) % 1;
    const x = -10 + p * 340, y = 132 - p * 80 + Math.sin(t * 1.3 + i * 2) * 8 + (i % 2) * 18;
    parts.push(
      <g key={`s${i}`} transform={`translate(${n2(x)} ${n2(y)})`} opacity="0.85">
        <circle r="2.4" fill="#ffffff" opacity="0.65" />
        {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M0,0 l0,-3.2" stroke="#ffffff" strokeWidth="0.7" transform={`rotate(${a})`} />)}
      </g>,
    );
  }
  return (
    <svg viewBox={VIEW} style={{ ...LAYER, pointerEvents: "none" }} aria-hidden>
      {[[8, 204, -1], [312, 204, 1], [106, 206, 1], [216, 206, -1]].map(([x, y, d], i) => (
        <g key={`g${i}`} transform={`translate(${x} ${y})`}>
          {[0, 1, 2, 3, 4].map((k) => {
            const sway = Math.sin(t * 1.8 + k + i) * 2;
            return <path key={k} d={`M${(k - 2) * 3},0 Q${n2((k - 2) * 4 + sway)},-12 ${n2((k - 2) * 5 * d + sway * 1.8)},-${20 + (k % 2) * 6}`} stroke={k % 2 ? kit.grass : mix(kit.grass, "#000000", 0.18)} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
          })}
        </g>
      ))}
      {parts}
    </svg>
  );
}

// 햇빛·가장자리 살짝 어둡게·종이 결: 한 번만 그려 따로 합성
const ParadeLight = memo(function ParadeLight({ id }: { id: string }) {
  return (
    <>
      <svg viewBox={VIEW} style={{ ...STILL, pointerEvents: "none", mixBlendMode: "soft-light" }} aria-hidden>
        <rect width={W} height={H} fill={kit.light} opacity={kit.lightOp * 1.6} />
      </svg>
      <svg viewBox={VIEW} style={{ ...STILL, pointerEvents: "none" }} aria-hidden>
        <defs>
          <radialGradient id={`${id}vig`} cx="0.5" cy="0.45" r="0.8">
            <stop offset="0.65" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#1d1630" stopOpacity="0.22" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${id}vig)`} />
      </svg>
      <svg viewBox={VIEW} style={{ ...STILL, pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.3 }} aria-hidden>
        <defs>
          <filter id={`${id}paper`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="4" seed="11" />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 1.4 -0.55" />
          </filter>
        </defs>
        <rect width={W} height={H} filter={`url(#${id}paper)`} />
      </svg>
    </>
  );
});
