"use client";
// 마음 친구 그림: 손으로 그린 셀 애니메이션처럼 — 따뜻한 세피아 잉크선(아래·오른쪽이 굵음), 한 단계 셀 그림자(차가운 보라),
// 반사광과 윤기 한 줄, 선이 살짝 떨리는 「boil」. 배경 장면은 선 없이 수채·과슈처럼 칠한다(인물은 선, 배경은 물감).
// 그림 하나(정지 화면)만 그린다. 움직임은 Buddy.tsx가 1초 12장으로 t를 넘겨 준다.
import { memo, useId, type ReactNode } from "react";
import { GROUPS, type BuddyLook } from "@/lib/shared";
import type { BrowKind, EyeKind, Expr, Fx, MouthKind, Pose } from "./expr";
import { INK, SCENE, cloudBumps, mix, paints, shapeGeo, type Geo } from "./paint";
import type { Group } from "@/lib/shared";

export type Detail = "full" | "small" | "tiny";
const MOUTH_DARK = "#6e2b2b";
const TONGUE = "#ee8a86";
const WATER = "#c4e8ff";
const n2 = (x: number) => Math.round(x * 100) / 100;

export interface ArtProps {
  look: BuddyLook;
  mood: Group;
  expr: Expr;
  pose: Pose;
  t: number;
  boil: number; // 선 떨림 그림 번호(0~2)
  scene?: boolean;
  detail?: Detail;
  size?: number;
  className?: string;
}

export default function BuddyArt({ look, mood, expr, pose, t, boil, scene = false, detail = "full", size = 200, className }: ArtProps) {
  const id = `b${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const full = detail === "full";
  const lw = detail === "tiny" ? 4.6 : detail === "small" ? 3 : 2;
  const moodColor = GROUPS[mood].color;
  const pal = paints(look.color || moodColor);
  const geo = shapeGeo(look.shape);
  const { rx } = geo;
  const S = scene ? 0.74 : 1; // 장면 속에서는 조금 작게
  const G = scene ? 176 : 183; // 바닥선
  const fx = full ? pose.fx ?? expr.fx : detail === "small" ? (pose.fx ?? expr.fx).filter((f) => f === "tears" || f === "vein" || f === "sweat") : [];
  const kit = SCENE[mood];
  // 장면 없이 그릴 때는 인물 둘레만 잘라 크게 보이게(효과는 상자 밖으로 조금 나가도 보임)
  const box = scene ? "0 0 200 200" : detail === "tiny" ? "24 46 152 152" : detail === "small" ? "16 34 168 168" : "8 22 184 184";

  const person = (
    <svg viewBox={box} width={size} height={size} className={scene ? undefined : className} style={scene ? LAYER : undefined} aria-hidden overflow={scene ? "hidden" : "visible"}>
      <defs>
        <linearGradient id={`${id}lit`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.lit} />
          <stop offset="1" stopColor={pal.base} />
        </linearGradient>
        <linearGradient id={`${id}limb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stopColor={pal.base} />
          <stop offset="0.51" stopColor={pal.shade} />
        </linearGradient>
        <radialGradient id={`${id}hi`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}blush`}>
          <stop offset="0" stopColor="#ff7f95" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff9fb0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}aura`}>
          <stop offset="0.55" stopColor={moodColor} stopOpacity="0.38" />
          <stop offset="1" stopColor={moodColor} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}body`}>
          <path d={geo.d} />
        </clipPath>
        {full && (
          <>
            {/* 선 떨림: 그림마다 잡음 씨앗을 바꿔 손으로 다시 그린 듯 */}
            <filter id={`${id}boil`} x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed={boil + 1} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={scene ? 2.4 : 1.9} xChannelSelector="R" yChannelSelector="G" />
            </filter>
            {/* 종이·물감 결 */}
            <filter id={`${id}grain`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
              <feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.18  0 0 0 0 0.12  0 0 0 0.9 -0.35" />
            </filter>
          </>
        )}
        <filter id={`${id}soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g transform={`translate(100 ${G}) scale(${S})`}>
        {/* 바닥 그림자 */}
        <ellipse cx={n2(pose.x)} cy="2" rx={n2(rx * 0.86 * pose.shadow * pose.sx)} ry={n2(7 * pose.shadow)} fill={scene ? "#2d3b22" : INK} opacity={scene ? 0.3 : 0.16} filter={`url(#${id}soft)`} />
        <g filter={full ? `url(#${id}boil)` : undefined}>
          <Character id={id} look={look} pal={pal} geo={geo} expr={expr} pose={pose} t={t} lw={lw} detail={detail} glow={!!look.color} fx={fx} />
          {fx.length > 0 && <Effects fx={fx} pose={pose} geo={geo} t={t} lw={lw} />}
        </g>
      </g>
    </svg>
  );
  if (!scene) return person;
  // 장면은 겹친 층으로: 멈춰 있는 배경·종이 결은 한 번만 그려 두고(따로 합성 층), 구름은 0.5초마다, 인물·풀·날씨만 1초 12장
  return (
    <div className={className} style={{ position: "relative", width: className ? undefined : size, height: className ? undefined : size, borderRadius: "11%", overflow: "hidden", isolation: "isolate" }} aria-hidden>
      <SceneStill id={`${id}s`} kit={kit} mood={mood} />
      <SceneClouds id={`${id}c`} kit={kit} mood={mood} step={Math.floor(t * 2)} />
      {person}
      <SceneFront kit={kit} mood={mood} t={t} />
      <SceneLight id={`${id}l`} kit={kit} />
    </div>
  );
}
const LAYER = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
const STILL = { ...LAYER, willChange: "transform" } as const;

type Pal = ReturnType<typeof paints>;
interface CharProps {
  id: string; look: BuddyLook; pal: Pal; geo: Geo; expr: Expr; pose: Pose; t: number; lw: number; detail: Detail; glow: boolean; fx: Fx[];
}

function Character({ id, look, pal, geo, expr, pose, t, lw, detail, glow, fx }: CharProps) {
  const { rx, ry, bottom, d: body } = geo;
  const full = detail === "full";
  const tiny = detail === "tiny";
  const eye = pose.eye ?? expr.eye;
  const sc = Math.min(rx, ry) / 57;
  const s = (look.eyes === "dot" ? 8 : look.eyes === "big" ? 11.4 : 10) * sc * (tiny ? 1.15 : 1);
  const ex = rx * geo.eye;
  const ey = -ry * 0.08;
  const [lx, ly] = pose.look;
  const fX = lx * rx * 0.12, fY = ly * ry * 0.07; // 얼굴이 시선 쪽으로(고개 돌리는 2D 요령)
  // 눈꺼풀은 그 높이의 몸 색으로 칠한다
  const skin = mix(pal.lit, pal.base, Math.min(1, Math.max(0, (ey + fY + ry * 1.1) / (ry * 2.1))));
  const arms = pose.arms ?? expr.arms;
  const blush = pose.blush ?? expr.blush;
  const tint = expr.tint;
  const hasLimbs = look.limbs !== "none";
  const armX = geo.half(ry * 0.12) * 0.94;

  return (
    <g transform={`translate(${n2(pose.x)} ${n2(pose.y)}) rotate(${n2(pose.rot)}) scale(${n2(pose.sx)} ${n2(pose.sy)}) translate(0 ${n2(-bottom)})`}>
      {glow && <ellipse cx="0" cy="0" rx={rx * 1.42} ry={ry * 1.42} fill={`url(#${id}aura)`} />}
      <BackAcc acc={look.acc} pal={pal} geo={geo} t={t} lw={lw} />
      {look.limbs === "both" && [-1, 1].map((d) => (
        <g key={d} transform={`translate(${n2(d * rx * 0.42)} ${n2(bottom - 2 - (d < 0 ? pose.footL : pose.footR))})`}>
          <ellipse cx="0" cy="0" rx={16 * sc} ry={9 * sc} fill={pal.shade} stroke={INK} strokeWidth={lw} />
          <ellipse cx={-3 * sc} cy={-2.5 * sc} rx={10 * sc} ry={4.5 * sc} fill={pal.base} />
        </g>
      ))}

      {/* 몸: 잉크 그림자(굵은 선) → 그림자색 → 밝은 면(셀 경계) → 반사광·무늬·결 → 윤곽 */}
      <path d={body} fill={INK} transform={`translate(${n2(lw * 0.45)} ${n2(lw * 0.7)})`} />
      <path d={body} fill={pal.shade} />
      <g clipPath={`url(#${id}body)`}>
        <path d={geo.lit} transform={`translate(${n2(-rx * 0.17)} ${n2(-ry * 0.19)})`} fill={`url(#${id}lit)`} />
        {full && <path d={`M${n2(rx * 0.62)},${n2(-ry * 0.62)} Q${n2(rx * 0.92)},${n2(ry * 0.1)} ${n2(rx * 0.3)},${n2(ry * 0.68)}`} fill="none" stroke={pal.deep} strokeWidth="1.6" opacity="0.18" />}
        <ellipse cx={rx * 0.12} cy={ry * 1.0} rx={rx * 0.72} ry={ry * 0.22} fill={pal.bounce} opacity="0.45" />
        {look.pattern === "spots" && ([[-0.62, -0.42, 0.2], [0.66, -0.3, 0.16], [-0.5, 0.48, 0.15], [0.55, 0.5, 0.18], [0.05, -0.82, 0.13]] as const).map(([x, y, r], i) => (
          <ellipse key={i} cx={x * rx} cy={y * ry} rx={r * rx} ry={r * rx * 0.86} fill={pal.soft} opacity="0.8" transform={`rotate(${i * 23} ${x * rx} ${y * ry})`} />
        ))}
        {look.pattern === "belly" && <ellipse cx={-rx * 0.03} cy={ry * 0.62} rx={rx * 0.52} ry={ry * 0.36} fill={pal.soft} opacity="0.9" />}
        {full && <rect x={-rx} y={-ry} width={rx * 2} height={ry * 2} filter={`url(#${id}grain)`} opacity="0.32" style={{ mixBlendMode: "multiply" }} />}
        {!tiny && <ellipse cx={-rx * 0.45} cy={-ry * 0.52} rx={rx * 0.3} ry={ry * 0.2} fill={`url(#${id}hi)`} opacity="0.55" />}
      </g>
      <path d={body} fill="none" stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
      {/* 윤기 한 줄 */}
      {!tiny && (
        <>
          <path d={`M${-rx * 0.74},${-ry * 0.36} Q${-rx * 0.66},${-ry * 0.64} ${-rx * 0.46},${-ry * 0.74}`} fill="none" stroke={pal.hi} strokeWidth={2.6 * sc} strokeLinecap="round" opacity="0.85" />
          <circle cx={-rx * 0.33} cy={-ry * 0.8} r={1.5 * sc} fill={pal.hi} opacity="0.85" />
        </>
      )}

      {/* 얼굴 */}
      <g transform={`translate(${n2(fX)} ${n2(fY)})`}>
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${n2(side * ex)} ${n2(ey)}) scale(${side} 1)`}>
            <Eye kind={eye} style={look.eyes} s={s} side={side} blink={pose.blink} lx={lx * side} ly={ly} t={t} lw={lw} skin={skin} detail={detail} />
          </g>
        ))}
        {blush > 0 && [-1, 1].map((side) => (
          <g key={side} transform={`translate(${n2(side * rx * 0.6)} ${n2(ry * 0.14)})`}>
            <ellipse rx={10.5 * sc} ry={6 * sc} fill={`url(#${id}blush)`} opacity={Math.min(1, blush)} />
            {blush > 0.55 && !tiny && [0, 1, 2].map((i) => (
              <path key={i} d={`M${n2((i - 1) * 4 * sc + 1.6 * sc)},${n2(-3 * sc)} L${n2((i - 1) * 4 * sc - 1.6 * sc)},${n2(3 * sc)}`} stroke="#c4566a" strokeWidth={lw * 0.5} strokeLinecap="round" opacity="0.65" />
            ))}
          </g>
        ))}
        {look.cheek === "freckle" && [-1, 1].flatMap((side) => ([[0.5, 0.02], [0.6, 0.1], [0.44, 0.13]] as const).map(([x, y], j) => (
          <circle key={`${side}${j}`} cx={side * x * rx} cy={y * ry} r={(tiny ? 2.2 : 1.4) * sc} fill="#9b5b3c" />
        )))}
        {look.acc === "glasses" && <Glasses ex={ex} ey={ey} s={s} lw={lw} />}
      </g>

      {/* 감정 빛: 화남은 위쪽이 붉게, 무서움은 파리하게(만화의 그늘 선), 슬픔은 푸르스름 */}
      {tint && (
        <g clipPath={`url(#${id}body)`}>
          {tint === "blush" ? (
            <ellipse cx="0" cy={ry * 0.12} rx={rx * 0.95} ry={ry * 0.42} fill="#ff6f8a" opacity="0.28" style={{ mixBlendMode: "multiply" }} />
          ) : (
            <rect x={-rx} y={-ry} width={rx * 2} height={ry * 1.1} fill={tint === "hot" ? "#ff5a3c" : tint === "warm" ? "#ffd27a" : tint === "pale" ? "#6f7fd6" : "#7aa0d8"}
              opacity={tint === "hot" ? (fx.includes("boilUp") ? 0.32 : 0.22) : tint === "warm" ? 0.1 : tint === "pale" ? 0.2 : 0.12} style={{ mixBlendMode: "multiply" }} />
          )}
          {fx.includes("gloom") && [-3, -1.5, 0, 1.5, 3].map((i) => (
            <path key={i} d={`M${n2(i * rx * 0.13)},${n2(-ry * 0.98)} L${n2(i * rx * 0.13)},${n2(-ry * (0.55 - Math.abs(i) * 0.04))}`} stroke="#4f4f9a" strokeWidth={lw * 0.7} opacity="0.55" />
          ))}
        </g>
      )}

      <g transform={`translate(${n2(fX)} ${n2(fY)})`}>
        {(pose.brow ?? expr.brow) !== "none" && !tiny && [-1, 1].map((side) => (
          <g key={side} transform={`translate(${n2(side * ex)} ${n2(ey)}) scale(${side} 1)`}>
            <Brow kind={pose.brow ?? expr.brow} s={s} lw={lw} />
          </g>
        ))}
        <g transform={`translate(0 ${n2(ry * 0.25)})`}>
          <Mouth kind={pose.mouthKind ?? expr.mouth} m={rx * 0.16} open={pose.mouth} t={t} lw={lw} />
        </g>
        {fx.includes("tears") && [-1, 1].map((side) => (
          <g key={side} transform={`translate(${n2(side * ex)} ${n2(ey)}) scale(${side} 1)`}><Tears s={s} t={t} lw={lw} drop={side > 0} /></g>
        ))}
        {fx.includes("tear") && <g transform={`translate(${n2(ex)} ${n2(ey)})`}><Tear s={s} t={t} lw={lw} /></g>}
      </g>
      {fx.includes("vein") && <Vein x={rx * 0.5} y={-ry * 0.62} t={t} lw={lw} />}

      <FrontAcc acc={look.acc} geo={geo} t={t} lw={lw} sc={sc} tiny={tiny} />

      {hasLimbs && [-1, 1].map((side) => {
        const a = side < 0 ? pose.armL : pose.armR;
        const fist = arms === "fists" || arms === "cover" || arms === "hips" || arms === "crossed";
        return (
          <g key={side} transform={`translate(${n2(side * armX)} ${n2(ry * 0.12)}) scale(${side} 1) rotate(${n2(-a)})`}>
            <g transform="rotate(38)">
              <path d={`M${2 * sc},${-7 * sc} Q${16 * sc},${-11 * sc} ${(fist ? 19 : 22) * sc},${-1 * sc} Q${(fist ? 20 : 23) * sc},${9 * sc} ${10 * sc},${(fist ? 9 : 8) * sc} Q${1 * sc},${7 * sc} ${2 * sc},${-7 * sc}Z`} fill={`url(#${id}limb)`} stroke={INK} strokeWidth={lw * 0.95} strokeLinejoin="round" />
              {!tiny && <path d={`M${8 * sc},${-6 * sc} Q${14 * sc},${-7.5 * sc} ${18 * sc},${-4 * sc}`} fill="none" stroke={pal.hi} strokeWidth={1.4 * sc} strokeLinecap="round" opacity="0.7" />}
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ── 눈(오른쪽 눈 기준, 바깥쪽이 +x. 왼쪽은 뒤집어 그린다) ──
const LIDS: Partial<Record<EyeKind, [number, number]>> = {
  half: [-0.12, -0.12], sleepy: [0.12, 0.32], worried: [-0.9, -0.42], sad: [-0.78, -0.05], down: [-0.18, -0.18], angry: [-0.05, -0.88], frustrated: [-0.18, -0.82],
};
function Eye({ kind, style, s, side, blink, lx, ly, t, lw, skin, detail }: {
  kind: EyeKind; style: BuddyLook["eyes"]; s: number; side: number; blink: number; lx: number; ly: number; t: number; lw: number; skin: string; detail: Detail;
}) {
  const line = { fill: "none", stroke: INK, strokeWidth: lw * 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "happy") return <path d={`M${-s * 0.95},${s * 0.3} Q0,${-s * 1.05} ${s * 0.95},${s * 0.3}`} {...line} />;
  if (kind === "relax")
    return (
      <g>
        <path d={`M${-s * 0.9},${-s * 0.05} Q0,${s * 0.8} ${s * 0.9},${-s * 0.05}`} {...line} />
        <path d={`M${s * 0.88},${-s * 0.06} L${s * 1.18},${-s * 0.32}`} {...line} strokeWidth={lw * 0.8} />
      </g>
    );
  if (kind === "closed" || blink >= 0.75) return <path d={`M${-s * 0.85},${s * 0.12} Q0,${s * 0.42} ${s * 0.92},${s * 0.06}`} {...line} />;
  if (kind === "squeeze") return <path d={`M${s * 0.85},${-s * 0.75} L${-s * 0.7},0 L${s * 0.85},${s * 0.75}`} {...line} strokeWidth={lw * 1.3} />;
  if (kind === "flat") return <path d={`M${-s * 0.85},${s * 0.05} L${s * 0.9},${s * 0.05}`} {...line} strokeWidth={lw * 1.4} />;
  // 하트 눈(설렘)
  if (kind === "heart") {
    const k = s * (1.05 + 0.08 * Math.abs(Math.sin(t * 8)));
    return (
      <g>
        <path d={`M0,${k * 0.75} C${-k * 1.25},${-k * 0.05} ${-k * 0.65},${-k * 0.95} 0,${-k * 0.35} C${k * 0.65},${-k * 0.95} ${k * 1.25},${-k * 0.05} 0,${k * 0.75}Z`} fill="#e8456b" stroke={INK} strokeWidth={lw * 0.8} strokeLinejoin="round" />
        {detail !== "tiny" && <ellipse cx={-k * 0.36 * side} cy={-k * 0.32} rx={k * 0.18} ry={k * 0.13} fill="#ffffff" opacity="0.9" />}
      </g>
    );
  }
  // 멍한 눈: 흰자에 작은 점, 빛 없음
  if (kind === "blank")
    return (
      <g>
        <ellipse cx="0" cy="0" rx={s * 0.9} ry={s * 1.05} fill="#fffaf1" stroke={INK} strokeWidth={lw * 0.8} />
        <circle cx={lx * s * 0.2} cy={ly * s * 0.2} r={s * 0.17} fill={INK} />
      </g>
    );
  // 깜짝: 동그랗게 튀어나온 흰 눈, 아주 작은 눈동자
  if (kind === "pop") {
    const r = s * (1.25 + 0.06 * Math.sin(t * 29));
    return (
      <g>
        <circle cx="0" cy={-s * 0.1} r={r} fill="#fffaf1" stroke={INK} strokeWidth={lw} />
        <circle cx={lx * s * 0.2} cy={-s * 0.1 + ly * s * 0.2} r={s * 0.2} fill={INK} />
      </g>
    );
  }

  const wide = kind === "wide";
  const moved = kind === "moved";
  const sclera = style === "big" || wide || moved;
  const pr = wide ? s * 0.33 : style === "dot" ? s * 0.55 : s * 0.63;
  const pry = wide ? s * 0.36 : style === "dot" ? s * 0.62 : s * 0.86;
  const shaky = wide ? Math.sin(t * 31) * s * 0.06 : 0;
  const px = lx * s * 0.28 + shaky, py = ly * s * 0.25 + (kind === "down" ? s * 0.3 : 0);
  const half = blink >= 0.25;
  const lid = half ? ([0.05, 0.05] as [number, number]) : LIDS[kind];
  const wet = kind === "teary" || kind === "sad" || kind === "frustrated" || moved;
  const shine = style !== "dot" || kind === "star" || wet;
  const smiling = kind === "smiling";
  const cx = px - pr * 0.3 * side; // 빛은 늘 왼쪽 위에서
  return (
    <g>
      {sclera && <ellipse cx="0" cy="0" rx={s * 0.98} ry={s * 1.18} fill="#fffaf1" stroke={INK} strokeWidth={lw * 0.75} />}
      <ellipse cx={px} cy={py} rx={pr} ry={pry} fill={style === "big" && !wide ? "#4a3426" : INK} />
      {style === "big" && !wide && <ellipse cx={px} cy={py + pry * 0.08} rx={pr * 0.52} ry={pry * 0.58} fill={INK} />}
      {wet && detail !== "tiny" && (
        <path d={`M${-s * 0.72},${s * 0.42} Q0,${s * 1.05} ${s * 0.74},${s * 0.42} Q0,${s * 0.72} ${-s * 0.72},${s * 0.42}Z`} fill={WATER} opacity="0.9" />
      )}
      {shine && detail !== "tiny" && (
        kind === "star" ? (
          <path d={star4(cx, py - pry * 0.3, pr * 0.62)} fill="#ffffff" />
        ) : (
          <circle cx={cx} cy={py - pry * 0.36} r={pr * (wet ? 0.36 : 0.42)} fill="#ffffff" />
        )
      )}
      {shine && detail === "full" && <circle cx={px + pr * 0.32 * side} cy={py + pry * 0.42} r={pr * 0.17} fill="#ffffff" opacity="0.9" />}
      {wet && detail === "full" && <circle cx={px + Math.sin(t * 7) * pr * 0.2} cy={py + pry * 0.1} r={pr * 0.14} fill="#ffffff" opacity="0.85" />}
      {kind === "star" && detail === "full" && <path d={star4(s * 1.15, -s * 1.05, s * 0.32 * (0.7 + 0.3 * Math.abs(Math.sin(t * 5))))} fill="#fff3b0" stroke={INK} strokeWidth={lw * 0.4} />}
      {moved && detail !== "tiny" && <path d={star4(px + pr * 0.25 * side, py + pry * 0.15, pr * 0.32 * (0.6 + 0.4 * Math.abs(Math.sin(t * 6))))} fill="#ffffff" />}
      {/* 웃는 눈: 아래 눈꺼풀이 둥글게 올라와 눈웃음 */}
      {smiling && (
        <>
          <path d={`M${-s * 1.3},${s * 1.6} L${s * 1.35},${s * 1.6} L${s * 1.35},${s * 0.42} Q0,${-s * 0.18} ${-s * 1.3},${s * 0.42}Z`} fill={skin} />
          <path d={`M${-s * 0.85},${s * 0.4} Q0,${-s * 0.05} ${s * 0.9},${s * 0.4}`} fill="none" stroke={INK} strokeWidth={lw * 1.1} strokeLinecap="round" />
        </>
      )}
      {lid && (
        <>
          <path d={`M${-s * 1.3},${-s * 1.6} L${s * 1.35},${-s * 1.6} L${s * 1.35},${lid[1] * s} L${-s * 1.3},${lid[0] * s}Z`} fill={skin} />
          <path d={`M${-s * (sclera ? 1 : 0.8)},${(lid[0] + 0.04) * s} Q0,${((lid[0] + lid[1]) / 2 - 0.12) * s} ${s * (sclera ? 1.05 : 0.88)},${(lid[1] + 0.04) * s}`} fill="none" stroke={INK} strokeWidth={lw * 1.15} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function star4(cx: number, cy: number, r: number) {
  const k = r * 0.28;
  return `M${n2(cx)},${n2(cy - r)} Q${n2(cx + k)},${n2(cy - k)} ${n2(cx + r)},${n2(cy)} Q${n2(cx + k)},${n2(cy + k)} ${n2(cx)},${n2(cy + r)} Q${n2(cx - k)},${n2(cy + k)} ${n2(cx - r)},${n2(cy)} Q${n2(cx - k)},${n2(cy - k)} ${n2(cx)},${n2(cy - r)}Z`;
}

// 눈썹(바깥쪽 +x): 짧고 굵은 붓질
function Brow({ kind, s, lw }: { kind: BrowKind; s: number; lw: number }) {
  const P: Record<Exclude<BrowKind, "none">, string> = {
    up: `M${-s * 0.7},${-s * 2.05} Q0,${-s * 2.7} ${s * 0.8},${-s * 2.1}`,
    soft: `M${-s * 0.7},${-s * 1.85} Q0,${-s * 2.25} ${s * 0.75},${-s * 1.88}`,
    worried: `M${-s * 0.78},${-s * 2.3} Q0,${-s * 2.0} ${s * 0.82},${-s * 1.6}`,
    sad: `M${-s * 0.8},${-s * 2.15} Q0,${-s * 1.75} ${s * 0.85},${-s * 1.42}`,
    angry: `M${-s * 0.85},${-s * 1.25} Q${-s * 0.1},${-s * 1.55} ${s * 0.82},${-s * 2.05}`,
    frown: `M${-s * 0.8},${-s * 1.5} Q0,${-s * 1.82} ${s * 0.8},${-s * 1.78}`,
    flat: `M${-s * 0.72},${-s * 1.78} L${s * 0.74},${-s * 1.78}`,
  };
  if (kind === "none") return null;
  return <path d={P[kind]} fill="none" stroke={INK} strokeWidth={lw * (kind === "angry" ? 1.7 : 1.35)} strokeLinecap="round" opacity="0.9" />;
}

function Mouth({ kind, m, open, t, lw }: { kind: MouthKind; m: number; open: number; t: number; lw: number }) {
  const line = { fill: "none", stroke: INK, strokeWidth: lw * 1.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const fillD = { fill: MOUTH_DARK, stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const };
  switch (kind) {
    case "smile": return <path d={`M${-m},${-m * 0.1} Q0,${m * 0.85} ${m},${-m * 0.1}`} {...line} />;
    case "soft": return <path d={`M${-m * 0.6},0 Q0,${m * 0.5} ${m * 0.6},0`} {...line} />;
    case "cat": return <path d={`M${-m * 0.9},${-m * 0.12} Q${-m * 0.45},${m * 0.6} 0,${-m * 0.02} Q${m * 0.45},${m * 0.6} ${m * 0.9},${-m * 0.12}`} {...line} />;
    case "grin":
    case "laugh": {
      const big = kind === "laugh" ? 1.95 : 1.55;
      const bot = 0.25 * -0.15 + 0.5 * big + 0.25 * -0.15;
      return (
        <g>
          <path d={`M${-m},${-m * 0.15} Q0,${m * big} ${m},${-m * 0.15} Q0,${m * 0.12} ${-m},${-m * 0.15}Z`} {...fillD} />
          <path d={`M${-m * 0.42},${m * (bot - 0.14)} Q0,${m * (bot - 0.42)} ${m * 0.42},${m * (bot - 0.14)} Q0,${m * (bot - 0.04)} ${-m * 0.42},${m * (bot - 0.14)}Z`} fill={TONGUE} />
        </g>
      );
    }
    case "flat": return <path d={`M${-m * 0.55},${m * 0.1} L${m * 0.55},${m * 0.1}`} {...line} />;
    case "side": return <path d={`M${-m * 0.6},${m * 0.22} Q${m * 0.05},${m * 0.18} ${m * 0.55},${-m * 0.06}`} {...line} />;
    case "wavy": {
      const ph = Math.sin(t * 9) * m * 0.08;
      return <path d={`M${-m * 0.8},${m * 0.12} Q${-m * 0.53},${-m * 0.18 + ph} ${-m * 0.27},${m * 0.12} Q0,${m * 0.4 - ph} ${m * 0.27},${m * 0.12} Q${m * 0.53},${-m * 0.18 + ph} ${m * 0.8},${m * 0.12}`} {...line} />;
    }
    case "o": return <ellipse cx="0" cy={m * 0.15} rx={m * 0.3} ry={m * (0.36 + Math.abs(Math.sin(t * 23)) * 0.05)} {...fillD} />;
    case "smallO": return <ellipse cx="0" cy={m * 0.1} rx={m * 0.2} ry={m * 0.24} {...fillD} />;
    case "frown": return <path d={`M${-m * 0.68},${m * 0.38} Q0,${-m * 0.32} ${m * 0.68},${m * 0.38}`} {...line} />;
    case "pout":
      return (
        <g>
          <path d={`M${-m * 0.38},${m * 0.28} Q0,${-m * 0.08} ${m * 0.38},${m * 0.28}`} {...line} />
          <path d={`M${-m * 0.62},${m * 0.18} l${-m * 0.12},${-m * 0.1} M${m * 0.62},${m * 0.18} l${m * 0.12},${-m * 0.1}`} {...line} strokeWidth={lw * 0.7} />
        </g>
      );
    case "teeth":
      return (
        <g>
          <path d={`M${-m * 0.82},${m * 0.18} Q${-m * 0.82},${-m * 0.16} ${-m * 0.4},${-m * 0.13} L${m * 0.4},${-m * 0.13} Q${m * 0.82},${-m * 0.16} ${m * 0.82},${m * 0.18} Q${m * 0.82},${m * 0.52} ${m * 0.4},${m * 0.47} L${-m * 0.4},${m * 0.47} Q${-m * 0.82},${m * 0.52} ${-m * 0.82},${m * 0.18}Z`} fill="#fffaf1" stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <path d={`M${-m * 0.78},${m * 0.17} L${m * 0.78},${m * 0.17} M${-m * 0.35},${-m * 0.12} V${m * 0.46} M0,${-m * 0.13} V${m * 0.47} M${m * 0.35},${-m * 0.12} V${m * 0.46}`} fill="none" stroke={INK} strokeWidth={lw * 0.6} />
        </g>
      );
    case "pant": // 헉헉: 벌린 입에 혀
      return (
        <g>
          <path d={`M${-m * 0.55},${-m * 0.05} Q0,${m * (0.9 + Math.abs(Math.sin(t * 6)) * 0.15)} ${m * 0.55},${-m * 0.05} Q0,${m * 0.1} ${-m * 0.55},${-m * 0.05}Z`} {...fillD} />
          <path d={`M${-m * 0.22},${m * 0.35} Q${-m * 0.24},${m * 0.95} 0,${m * 0.95} Q${m * 0.24},${m * 0.95} ${m * 0.22},${m * 0.35}Z`} fill={TONGUE} stroke={INK} strokeWidth={lw * 0.6} />
        </g>
      );
    case "nervous": // 긴장해 꾹 다문 지그재그 입
      return <path d={`M${-m * 0.7},${m * 0.15} l${m * 0.23},${-m * 0.18} l${m * 0.23},${m * 0.18} l${m * 0.23},${-m * 0.18} l${m * 0.23},${m * 0.18} l${m * 0.23},${-m * 0.18}`} {...line} />;
    case "wail": { // 엉엉: 크게 벌린 우는 입
      const w2 = 1 + Math.abs(Math.sin(t * 5)) * 0.12;
      return (
        <g>
          <path d={`M${-m * 0.75},${m * 0.75 * w2} Q${-m * 0.65},${-m * 0.25} 0,${-m * 0.2} Q${m * 0.65},${-m * 0.25} ${m * 0.75},${m * 0.75 * w2} Q0,${m * 0.55} ${-m * 0.75},${m * 0.75 * w2}Z`} {...fillD} />
          <path d={`M${-m * 0.4},${m * 0.62} Q0,${m * 0.4} ${m * 0.4},${m * 0.62}`} fill={TONGUE} />
        </g>
      );
    }
    case "quiver": { // 감동해 떨리는 웃음
      const q = Math.sin(t * 14) * m * 0.06;
      return <path d={`M${-m * 0.75},${-m * 0.05} Q${-m * 0.38},${m * 0.42 + q} 0,${m * 0.22} Q${m * 0.38},${m * 0.42 - q} ${m * 0.75},${-m * 0.05}`} {...line} />;
    }
    case "yawn":
      if (open < 0.08) return <path d={`M${-m * 0.38},${m * 0.12} Q0,${m * 0.3} ${m * 0.38},${m * 0.12}`} {...line} />;
      return (
        <g>
          <ellipse cx="0" cy={m * 0.3} rx={m * (0.3 + 0.22 * open)} ry={m * (0.22 + 0.55 * open)} {...fillD} />
          <ellipse cx="0" cy={m * (0.3 + 0.4 * open)} rx={m * 0.22 * open} ry={m * 0.12 * open} fill={TONGUE} />
        </g>
      );
  }
}

function Glasses({ ex, ey, s, lw }: { ex: number; ey: number; s: number; lw: number }) {
  const r = s * 1.6;
  return (
    <g fill="none" stroke={INK} strokeWidth={lw * 1.2}>
      {[-1, 1].map((d) => <circle key={d} cx={d * ex} cy={ey} r={r} fill="#ffffff" fillOpacity="0.14" />)}
      <path d={`M${-ex + r},${ey - s * 0.2} Q0,${ey - s * 0.75} ${ex - r},${ey - s * 0.2}`} />
      {[-1, 1].map((d) => <path key={`g${d}`} d={`M${d * ex - r * 0.55},${ey - r * 0.25} L${d * ex - r * 0.15},${ey - r * 0.62}`} stroke="#ffffff" strokeWidth={lw * 0.9} strokeLinecap="round" opacity="0.8" />)}
    </g>
  );
}

function Tears({ s, t, lw, drop }: { s: number; t: number; lw: number; drop: boolean }) {
  const p = (t % 1.4) / 1.4;
  const w = 3.6 + Math.sin(t * 5) * 0.4;
  return (
    <g>
      <path d={`M${s * 0.55},${s * 0.55} Q${s * 0.95},${s * 2.2} ${s * 0.75},${s * 4.3} L${s * 0.75 + w},${s * 4.3} Q${s * 1.25},${s * 2.2} ${s * 0.95},${s * 0.45}Z`} fill={WATER} stroke="#6f9fc8" strokeWidth={lw * 0.5} opacity="0.92" />
      {drop && <ellipse cx={s * 0.85} cy={s * (4.6 + p * 3.5)} rx={2.2} ry={3} fill={WATER} stroke="#6f9fc8" strokeWidth={lw * 0.45} opacity={1 - p} />}
    </g>
  );
}
function Tear({ s, t, lw }: { s: number; t: number; lw: number }) {
  const p = (t % 3.4) / 3.4;
  const y = p < 0.55 ? s * 0.7 : s * 0.7 + ((p - 0.55) / 0.45) ** 2 * s * 4;
  const r = 1.5 + Math.min(1, p / 0.5) * 1.6;
  return <path d={`M${s * 0.8},${y - r * 1.8} Q${s * 0.8 + r * 1.2},${y} ${s * 0.8},${y + r} Q${s * 0.8 - r * 1.2},${y} ${s * 0.8},${y - r * 1.8}Z`} fill={WATER} stroke="#6f9fc8" strokeWidth={lw * 0.5} opacity={p > 0.95 ? 0 : 0.95} />;
}
// 화난 표시(네 갈래 핏줄)
function Vein({ x, y, t, lw }: { x: number; y: number; t: number; lw: number }) {
  const k = 1 + Math.abs(Math.sin(t * 6)) * 0.18;
  const arm = "M2.5,-9 Q2.5,-2.5 9,-2.5";
  return (
    <g transform={`translate(${n2(x)} ${n2(y)}) scale(${n2(k)})`} fill="none" stroke="#d6362a" strokeWidth={lw * 1.25} strokeLinecap="round">
      {[0, 90, 180, 270].map((a) => <path key={a} d={arm} transform={`rotate(${a})`} />)}
    </g>
  );
}

// ── 꾸미개 ──
function BackAcc({ acc, pal, geo, t, lw }: { acc: BuddyLook["acc"]; pal: Pal; geo: Geo; t: number; lw: number }) {
  const { rx, ry, top } = geo;
  if (acc === "cat") {
    const tw = (t % 4.3) < 0.25 ? -8 : 0; // 가끔 귀를 쫑긋
    const y = top + ry * 0.26;
    const x = Math.min(rx * 0.5, geo.half(y) * 0.78);
    return (
      <g>
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${n2(d * x)} ${n2(y)}) scale(${d} 1) rotate(${18 + (d > 0 ? tw : 0)})`}>
            <path d="M-15,8 Q-6,-26 2,-30 Q10,-22 15,8Z" fill={pal.base} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
            <path d="M-8,4 Q-3,-16 2,-20 Q7,-13 9,4Z" fill="#ffb8c6" />
          </g>
        ))}
      </g>
    );
  }
  if (acc === "bunny") {
    const flop = Math.sin(t * 1.3) * 4;
    const y = top + ry * 0.2;
    const x = Math.min(rx * 0.3, geo.half(y) * 0.6);
    return (
      <g>
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${n2(d * x)} ${n2(y)}) rotate(${d * 12 + (d > 0 ? 18 + flop : 0)})`}>
            <path d="M-10,6 Q-14,-30 -2,-48 Q12,-30 9,6Z" fill={pal.base} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
            <path d="M-4,0 Q-7,-26 -1,-38 Q6,-26 4,0Z" fill="#ffb8c6" />
          </g>
        ))}
      </g>
    );
  }
  return null;
}

function FrontAcc({ acc, geo, t, lw, sc, tiny }: { acc: BuddyLook["acc"]; geo: Geo; t: number; lw: number; sc: number; tiny: boolean }) {
  const { rx, ry } = geo;
  const st = { stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const };
  const top = geo.top + 1;
  if (acc === "sprout") {
    const sw = Math.sin(t * 1.8) * 4;
    return (
      <g>
        <path d={`M0,${top + 3} Q${2 + sw * 0.3},${top - 10} ${sw},${top - 20}`} fill="none" stroke="#3f7d39" strokeWidth={lw * 1.4} strokeLinecap="round" />
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${sw} ${top - 20}) rotate(${d * 40 + sw * 2}) scale(${d} 1)`}>
            <path d="M0,0 Q8,-12 22,-4 Q12,6 0,0Z" fill="#8fd16f" {...st} />
            {!tiny && <path d="M2,-1 Q10,-4 18,-4" fill="none" stroke="#5aa246" strokeWidth={lw * 0.6} />}
          </g>
        ))}
      </g>
    );
  }
  if (acc === "ribbon")
    return (
      <g transform={`translate(${n2(Math.min(rx * 0.56, geo.half(top + ry * 0.24) * 0.85))} ${n2(top + ry * 0.24)}) rotate(${-22 + Math.sin(t * 2) * 3})`}>
        {[-1, 1].map((d) => (
          <g key={d} transform={`scale(${d} 1)`}>
            <path d="M0,0 Q10,-15 20,-9 Q24,0 20,9 Q10,15 0,0Z" fill="#ff7aa0" {...st} />
            {!tiny && <path d="M4,0 Q12,-6 17,-4" fill="none" stroke="#d94d7a" strokeWidth={lw * 0.6} />}
          </g>
        ))}
        <ellipse rx="5.5" ry="6.5" fill="#e3507b" {...st} />
      </g>
    );
  if (acc === "party")
    return (
      <g transform={`translate(${rx * 0.12} ${top + 6}) rotate(${12 + Math.sin(t * 2.2) * 3})`}>
        <path d="M-21,0 L0,-50 L21,0 Q0,7 -21,0Z" fill="#8cbcf2" {...st} />
        {!tiny && <path d="M-15,-14 Q0,-10 15,-14 M-9,-29 Q0,-26 9,-29" fill="none" stroke="#ffffff" strokeWidth={lw * 1.6} strokeLinecap="round" />}
        <circle cy="-52" r="6.5" fill="#f6c445" {...st} />
      </g>
    );
  if (acc === "crown")
    return (
      <g transform={`translate(0 ${top + 4})`}>
        <path d="M-25,0 L-27,-24 L-13,-11 L0,-30 L13,-11 L27,-24 L25,0 Q0,6 -25,0Z" fill="#f4c22b" {...st} />
        {!tiny && (
          <>
            <path d="M-22,-4 Q0,1 22,-4" fill="none" stroke="#c98f00" strokeWidth={lw * 0.7} />
            {[[-14, -5, "#e24a6f"], [0, -6, "#5cc8c0"], [14, -5, "#7f9df0"]].map(([x, y, c]) => <circle key={String(x)} cx={Number(x)} cy={Number(y)} r="3.2" fill={String(c)} stroke={INK} strokeWidth={lw * 0.5} />)}
            <path d="M-20,-18 L-19,-8" stroke="#fff5c0" strokeWidth={lw * 0.9} strokeLinecap="round" />
          </>
        )}
      </g>
    );
  if (acc === "flower")
    return (
      <g transform={`translate(${n2(-Math.min(rx * 0.56, geo.half(top + ry * 0.28) * 0.85))} ${n2(top + ry * 0.28)}) rotate(${Math.sin(t * 1.6) * 6})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-8.5" rx="6" ry="8.5" fill="#ff9dbb" {...st} strokeWidth={lw * 0.8} transform={`rotate(${a})`} />
        ))}
        <circle r="5.5" fill="#f6c445" {...st} strokeWidth={lw * 0.8} />
      </g>
    );
  const hx = geo.half(-ry * 0.2) * 1.02;
  if (acc === "headphones")
    return (
      <g>
        {[INK, "#6b7480"].map((c, i) => (
          <path key={c} d={`M${-hx},${-ry * 0.1} Q${-hx * 1.05},${top - ry * 0.2} 0,${top - ry * 0.16} Q${hx * 1.05},${top - ry * 0.2} ${hx},${-ry * 0.1}`} fill="none" stroke={c} strokeWidth={lw * (i ? 1.8 : 3.2)} strokeLinecap="round" />
        ))}
        {[-1, 1].map((d) => (
          <rect key={d} x={d * hx - 9 * sc} y={-ry * 0.32} width={18 * sc} height={26 * sc} rx={8 * sc} fill="#ff8a66" {...st} />
        ))}
      </g>
    );
  return null;
}

// ── 효과(몸 바깥): 반짝임·별·음표·하트·꽃잎·말줄임·zzz·땀·떨림·비구름·한숨·김·!? ──
function Effects({ fx, pose, geo, t, lw }: { fx: Fx[]; pose: Pose; geo: Geo; t: number; lw: number }) {
  const { rx, ry, bottom } = geo;
  const head = (geo.top - bottom) * pose.sy + pose.y; // 정수리 높이
  const X = pose.x;
  const out: ReactNode[] = [];
  const thin = { stroke: INK, strokeWidth: lw * 0.6, strokeLinejoin: "round" as const };
  for (const f of fx) {
    if (f === "sparkle")
      ([[-rx * 1.12, head + ry * 0.55, 7], [rx * 1.15, head + ry * 0.2, 9], [rx * 0.7, head - 10, 6]] as const).forEach(([x, y, r], i) => {
        const k = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.6 + i * 2.1));
        out.push(<path key={`sp${i}`} d={star4(X + x, y, r * k)} fill="#fff3b8" {...thin} />);
      });
    if (f === "stars")
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.7 + i / 4) % 1;
        const x = X + (i - 1.5) * rx * 0.62 + Math.sin(p * 9 + i) * 4;
        out.push(<path key={`st${i}`} d={star5(x, head + 6 - p * 34, 4.5 + 2 * (1 - p))} fill={["#ffd54a", "#ff8fb0", "#8ec5ff", "#a5e08a"][i]} {...thin} opacity={1 - p * p} />);
      }
    if (f === "notes")
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.45 + i * 0.5) % 1;
        const d = i ? 1 : -1;
        const x = X + d * (rx * 1.05 + p * 10) + Math.sin(p * 8) * 4;
        const y = head + ry * 0.5 - p * 38;
        out.push(
          <g key={`n${i}`} transform={`translate(${n2(x)} ${n2(y)}) rotate(${n2(Math.sin(p * 6) * 12)})`} opacity={1 - p * p}>
            <ellipse cx="0" cy="0" rx="4.2" ry="3.2" fill={INK} transform="rotate(-20)" />
            <path d="M3.6,-1 V-15 Q8,-12 9,-8" fill="none" stroke={INK} strokeWidth={lw * 0.8} strokeLinecap="round" />
          </g>,
        );
      }
    if (f === "hearts")
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.42 + i / 3) % 1;
        const x = X + Math.sin(i * 2.2 + 0.5) * rx * 0.95 + Math.sin(p * 5 + i) * 4;
        const k = 0.55 + 0.45 * p;
        out.push(<path key={`h${i}`} d="M0,4 C-9,-3 -6,-11 0,-6 C6,-11 9,-3 0,4Z" transform={`translate(${n2(x)} ${n2(head + ry * 0.4 - p * 42)}) scale(${n2(k)})`} fill="#ff7f9c" {...thin} opacity={1 - p * p} />);
      }
    if (f === "petals")
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.16 + i / 4) % 1;
        const x = -95 + p * 190 + Math.sin(p * 7 + i) * 10;
        const y = head - 30 + p * (bottom + ry + 40) + Math.sin(p * 11) * 4;
        out.push(<ellipse key={`pe${i}`} cx="0" cy="0" rx="4.2" ry="2.4" fill={i % 2 ? "#ffd6e2" : "#e9f7c9"} {...thin} strokeWidth={lw * 0.45} transform={`translate(${n2(x)} ${n2(y)}) rotate(${n2(t * 90 + i * 50)})`} />);
      }
    if (f === "dots") {
      const p = (t % 5) / 5;
      if (p > 0.15 && p < 0.85) {
        const shown = Math.min(3, Math.floor((p - 0.15) / 0.12) + 1);
        out.push(
          <g key="dots" transform={`translate(${n2(X + rx * 0.95)} ${n2(head + 2)})`}>
            <circle cx="-8" cy="14" r="2.6" fill="#fffaf1" {...thin} />
            <ellipse cx="6" cy="-2" rx="17" ry="11" fill="#fffaf1" {...thin} />
            {[0, 1, 2].slice(0, shown).map((i) => <circle key={i} cx={-4 + i * 8} cy="-2" r="2" fill={INK} />)}
          </g>,
        );
      }
    }
    if (f === "zzz")
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3) % 1;
        const z = 5 + p * 5;
        out.push(<path key={`z${i}`} d={`M0,0 h${z} l${-z},${z} h${z}`} fill="none" stroke="#5f6f9a" strokeWidth={lw * 0.9} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${n2(X + rx * 0.55 + p * 26)} ${n2(head + 4 - p * 30)})`} opacity={1 - p * p} />);
      }
    if (f === "sweat") {
      const slide = ((t % 2.4) / 2.4) * 7;
      out.push(<path key="sw" d="M0,-9 Q7,1 0,6 Q-7,1 0,-9Z" fill={WATER} {...thin} strokeWidth={lw * 0.7} transform={`translate(${n2(X + rx * 0.82)} ${n2(head + ry * 0.55 + slide)}) rotate(-12)`} />);
      out.push(<path key="sw2" d="M-1.5,-3 Q-2.5,0 -1.5,2" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" transform={`translate(${n2(X + rx * 0.82)} ${n2(head + ry * 0.55 + slide)}) rotate(-12)`} />);
    }
    if (f === "shiver")
      [-1, 1].forEach((d) => {
        const j = Math.sin(t * 40) * 1.5;
        out.push(
          <g key={`sh${d}`} transform={`translate(${n2(X + d * (rx * 1.12 + j))} ${n2(head + ry * 0.9)})`} fill="none" stroke={INK} strokeWidth={lw * 0.7} strokeLinecap="round">
            <path d={`M${d * 2},-10 q${d * 4},5 0,10 q${d * -4},5 0,10`} />
            <path d={`M${d * 8},-6 q${d * 3},4 0,8 q${d * -3},4 0,8`} opacity="0.7" />
          </g>,
        );
      });
    if (f === "cloud") {
      const p = (t % 0.9) / 0.9;
      out.push(
        <g key="cl" transform={`translate(${n2(X + rx * 0.15)} ${n2(head - 18)})`}>
          <InkPuff bumps={cloudBumps(40, 14, 3)} fill="#aab6c8" lw={lw} />
          {[-10, 0, 10].map((x, i) => <path key={`r${i}`} d={`M${x - 1},${9 + ((p + i * 0.33) % 1) * 12} l-2,5`} stroke="#7b9cc8" strokeWidth={lw * 0.8} strokeLinecap="round" />)}
        </g>,
      );
    }
    if (f === "puff") {
      const p = (t % 1.6) / 1.6;
      out.push(
        <g key="pf" transform={`translate(${n2(X + rx * 0.35 + p * 22)} ${n2(-bottom * pose.sy + pose.y + ry * 0.25 - p * 6)}) scale(${n2(0.5 + p * 0.7)})`} opacity={1 - p}>
          <InkPuff bumps={cloudBumps(20, 9, 1)} fill="#ffffff" lw={lw} />
        </g>,
      );
    }
    if (f === "steam")
      [-1, 1].forEach((d, i) => {
        const p = (t * 0.8 + i * 0.5) % 1;
        out.push(
          <g key={`stm${d}`} transform={`translate(${n2(X + d * rx * 0.45 + d * p * 8)} ${n2(head + 4 - p * 26)}) scale(${n2(0.6 + p * 0.6)})`} opacity={1 - p}>
            <InkPuff bumps={cloudBumps(18, 9, 2 + i)} fill="#f4f1ec" lw={lw} />
          </g>,
        );
      });
    if (f === "bang") {
      const b = Math.abs(Math.sin(t * 5)) * 3;
      out.push(
        <g key="bang" transform={`translate(${n2(X + rx * 0.85)} ${n2(head - 2 - b)}) rotate(12)`} fill="#e04b3c" stroke={INK} strokeWidth={lw * 0.5}>
          <path d="M-3,-14 L3,-14 L1.5,1 L-1.5,1Z" />
          <circle cx="0" cy="6" r="2.6" />
          <path d="M8,-10 Q8,-16 13,-16 Q19,-16 18,-10 Q17,-6 13,-4 L13,0 L10,0 L10,-6 Q15,-8 14.5,-10.5 Q14,-13 12.5,-12.5 Q11,-12 11,-10Z" />
          <circle cx="11.5" cy="5.5" r="2.4" />
        </g>,
      );
    }
  }
  const mid = -bottom * pose.sy + pose.y; // 몸 가운데 높이
  const faceY = mid + ry * 0.25 * pose.sy; // 입 높이
  for (const f of fx) {
    if (f === "medal") { // 뿌듯: 가슴에 금메달
      const sw = Math.sin(t * 2.4) * 6;
      out.push(
        <g key="medal" transform={`translate(${n2(X + rx * 0.38)} ${n2(mid + ry * 0.3)}) rotate(${n2(sw)})`}>
          <path d="M-5,-14 L-1,0 M5,-14 L1,0" stroke="#4f7fd8" strokeWidth={lw * 2} strokeLinecap="round" />
          <circle cx="0" cy="5" r="7" fill="#f4c22b" {...thin} strokeWidth={lw * 0.8} />
          <path d={star5(0, 5, 3.6)} fill="#fff1a8" />
        </g>,
      );
    }
    if (f === "flowers") // 행복: 머리 둘레에 꽃이 피었다 진다
      ([[-rx * 1.0, head + ry * 0.45], [rx * 1.05, head + ry * 0.3], [-rx * 0.45, head - 8], [rx * 0.5, head - 12]] as const).forEach(([x, y], i) => {
        const k = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + i * 1.3));
        out.push(
          <g key={`fl${i}`} transform={`translate(${n2(X + x)} ${n2(y)}) scale(${n2(k)}) rotate(${n2(t * 20 + i * 30)})`}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-4.5" rx="3.2" ry="4.5" fill={["#ffb3c8", "#ffe07a", "#c9b6ff", "#ffffff"][i]} {...thin} strokeWidth={lw * 0.4} transform={`rotate(${a})`} />)}
            <circle r="2.4" fill="#f6b73c" />
          </g>,
        );
      });
    if (f === "heartbeat") { // 설렘·조마조마: 가슴 옆 하트가 두근두근(두 번 뛰고 쉼)
      const b = (t % 0.9) / 0.9;
      const k = 1 + (b < 0.15 ? Math.sin((b / 0.15) * Math.PI) * 0.35 : b < 0.35 ? Math.sin(((b - 0.2) / 0.15) * Math.PI) * 0.25 : 0);
      out.push(
        <g key="hb" transform={`translate(${n2(X + rx * 0.95)} ${n2(mid - ry * 0.05)}) scale(${n2(k)})`}>
          <path d="M0,6 C-12,-3 -8,-13 0,-7 C8,-13 12,-3 0,6Z" fill="#ff6f8f" {...thin} strokeWidth={lw * 0.7} />
          <path d="M-12,-10 l-3,-3 M12,-10 l3,-3 M0,-14 v-4" stroke={INK} strokeWidth={lw * 0.5} strokeLinecap="round" opacity={k > 1.1 ? 0.8 : 0} />
        </g>,
      );
    }
    if (f === "speed") // 들뜸: 양옆 바람 줄
      [-1, 1].forEach((d) => {
        const j = (t * 12) % 2 < 1 ? 0 : 3;
        out.push(<path key={`spd${d}`} d={`M${n2(X + d * (rx * 1.15 + j))},${n2(mid - 8)} h${d * 12} M${n2(X + d * (rx * 1.25 + j))},${n2(mid + 4)} h${d * 16} M${n2(X + d * (rx * 1.12 + j))},${n2(mid + 16)} h${d * 10}`} stroke={INK} strokeWidth={lw * 0.6} strokeLinecap="round" opacity="0.7" />);
      });
    if (f === "zap") // 짜릿: 작은 번개가 번쩍번쩍
      ([[-rx * 1.0, head + ry * 0.3, -15], [rx * 1.0, head + ry * 0.15, 18], [rx * 0.2, head - 14, 5]] as const).forEach(([x, y, r], i) => {
        if (Math.floor(t * 6 + i) % 3 === 0) return;
        out.push(<path key={`zp${i}`} d="M2,-10 L-5,1 L0,1 L-3,10 L6,-2 L1,-2 L4,-10Z" fill="#ffe14a" {...thin} transform={`translate(${n2(X + x)} ${n2(y)}) rotate(${r})`} />);
      });
    if (f === "glowRing") { // 든든: 따뜻한 빛 테두리
      const o = 0.35 + 0.25 * Math.sin(t * 2);
      out.push(<ellipse key="gr" cx={X} cy={mid} rx={rx * 1.28 * pose.sx} ry={ry * 1.28 * pose.sy} fill="none" stroke="#ffcf6a" strokeWidth={lw * 2.2} opacity={o} strokeDasharray="10 6" />);
    }
    if (f === "warmth") // 따뜻함: 위로 피어오르는 아지랑이
      [-1, 0, 1].forEach((d, i) => {
        const p = (t * 0.6 + i / 3) % 1;
        out.push(<path key={`wm${i}`} d={`M${n2(X + d * 18)},${n2(head + 2 - p * 26)} q-4,-5 0,-10 q4,-5 0,-10`} fill="none" stroke="#ff9c5a" strokeWidth={lw * 0.9} strokeLinecap="round" opacity={(1 - p) * 0.85} />);
      });
    if (f === "bubbles") // 홀가분: 비눗방울이 둥실
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.3 + i / 5) % 1;
        const x = X + (i - 2) * rx * 0.5 + Math.sin(p * 7 + i) * 6;
        const r = 3 + (i % 3) * 1.6;
        out.push(
          <g key={`bb${i}`} opacity={1 - p * p}>
            <circle cx={x} cy={head + ry * 0.7 - p * 70} r={r} fill="#dff3ff" fillOpacity="0.35" stroke="#7fb8e0" strokeWidth={lw * 0.5} />
            <circle cx={x - r * 0.35} cy={head + ry * 0.7 - p * 70 - r * 0.35} r={r * 0.28} fill="#ffffff" />
          </g>,
        );
      }
    if (f === "daze") { // 멍: 머리 위 빙글빙글 동그라미
      const a = t * 120;
      out.push(
        <g key="dz" transform={`translate(${n2(X)} ${n2(head - 10)})`}>
          <ellipse rx="16" ry="5" fill="none" stroke={INK} strokeWidth={lw * 0.5} strokeDasharray="3 4" opacity="0.6" />
          {[0, 120, 240].map((o) => { const r = ((a + o) * Math.PI) / 180; return <circle key={o} cx={n2(Math.cos(r) * 16)} cy={n2(Math.sin(r) * 5)} r="2.2" fill="#ffe27a" {...thin} strokeWidth={lw * 0.4} />; })}
        </g>,
      );
    }
    if (f === "sleepBubble") { // 졸림: 코풍선이 부풀었다 줄었다
      const k = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.1));
      out.push(
        <g key="sb" transform={`translate(${n2(X + rx * 0.18 + 7 * k)} ${n2(faceY - 4)})`}>
          <circle r={7 * k} fill="#d6efff" fillOpacity="0.7" stroke="#6f9fc8" strokeWidth={lw * 0.5} />
          <circle cx={-2.5 * k} cy={-2.5 * k} r={1.8 * k} fill="#ffffff" />
        </g>,
      );
    }
    if (f === "battery") { // 기운 없음: 머리 위 빈 건전지(빨간 칸이 깜빡)
      out.push(
        <g key="bt" transform={`translate(${n2(X + 4)} ${n2(head - 12)})`}>
          <rect x="-13" y="-7" width="24" height="14" rx="3" fill="#fffaf1" {...thin} strokeWidth={lw * 0.7} />
          <rect x="11" y="-3" width="3" height="6" rx="1" fill={INK} />
          {Math.floor(t * 2) % 2 === 0 && <rect x="-10" y="-4" width="5" height="8" rx="1" fill="#e5483b" />}
        </g>,
      );
    }
    if (f === "questions") // 불안: 물음표가 동동
      [-1, 1, 0].forEach((d, i) => {
        const p = (t * 0.5 + i / 3) % 1;
        out.push(<text key={`q${i}`} x={X + d * rx * 0.75} y={head + 4 - p * 22} fontSize={12 + i * 2} fontWeight="700" textAnchor="middle" fill="#6a76c8" stroke={INK} strokeWidth="0.4" opacity={1 - p * p} transform={`rotate(${d * 12} ${X + d * rx * 0.75} ${head - p * 22})`}>?</text>);
      });
    if (f === "tangle") { // 답답: 머리 위 엉킨 실타래
      const j = Math.sin(t * 9) * 1.2;
      out.push(<path key="tg" d="M-14,0 C-10,-12 6,-12 4,-2 C2,8 -12,6 -8,-4 C-4,-14 14,-10 12,0 C10,10 -4,10 -2,0 C0,-8 10,-6 14,2" fill="none" stroke={INK} strokeWidth={lw * 0.9} strokeLinecap="round" transform={`translate(${n2(X + rx * 0.2 + j)} ${n2(head - 12)})`} />);
    }
    if (f === "exclaim") { // 깜짝: 큰 느낌표 + 놀람 선
      const s = (t % 2.2) / 2.2;
      const k = s < 0.15 ? 0.6 + (s / 0.15) * 0.6 : 1.2 - Math.min(0.2, (s - 0.15) * 0.4);
      out.push(
        <g key="ex" transform={`translate(${n2(X + rx * 0.75)} ${n2(head - 6)}) scale(${n2(k)}) rotate(10)`} fill="#ffe14a" stroke={INK} strokeWidth={lw * 0.6}>
          <path d="M-3.5,-18 L3.5,-18 L1.8,2 L-1.8,2Z" />
          <circle cx="0" cy="8" r="3.2" />
        </g>,
      );
      if (s < 0.4) [-50, -20, 20, 50].forEach((a) => out.push(<path key={`exl${a}`} d="M0,-8 v-9" stroke={INK} strokeWidth={lw * 0.7} strokeLinecap="round" transform={`translate(${n2(X)} ${n2(head + 6)}) rotate(${a}) translate(0 ${-ry * 0.5})`} />));
    }
    if (f === "chill") // 오싹: 양옆 차가운 지그재그 + 서리 점
      [-1, 1].forEach((d) => {
        const j = Math.sin(t * 38) * 1.2;
        out.push(<path key={`ch${d}`} d={`M${n2(X + d * (rx * 1.1 + j))},${n2(mid - 18)} l${d * 4},5 l${-d * 4},5 l${d * 4},5 l${-d * 4},5 l${d * 4},5`} fill="none" stroke="#6fa8e6" strokeWidth={lw * 0.9} strokeLinecap="round" strokeLinejoin="round" />);
        out.push(<path key={`chs${d}`} d={star4(X + d * rx * 0.9, head + 4, 3.5)} fill="#dff1ff" stroke="#6fa8e6" strokeWidth={lw * 0.4} />);
      });
    if (f === "leaf") { // 외로움: 잎 하나가 천천히 떨어짐
      const p = (t * 0.18) % 1;
      out.push(<path key="lf" d="M0,-5 Q6,0 0,6 Q-6,0 0,-5Z M0,-5 V6" fill="#c9965a" stroke={INK} strokeWidth={lw * 0.4} transform={`translate(${n2(X + rx * 1.1 - p * rx * 0.6 + Math.sin(p * 9) * 10)} ${n2(head - 20 + p * (bottom + ry + 20))}) rotate(${n2(Math.sin(p * 9) * 50)})`} />);
    }
    if (f === "thought") { // 그리움: 생각 구름 속 하트
      const b = Math.sin(t * 2) * 1.5;
      out.push(
        <g key="th" transform={`translate(${n2(X + rx * 0.95)} ${n2(head - 10 + b)})`}>
          <circle cx="-14" cy="20" r="2.4" fill="#fffaf1" {...thin} />
          <circle cx="-9" cy="13" r="3.4" fill="#fffaf1" {...thin} />
          <InkPuff bumps={cloudBumps(30, 13, 4)} fill="#fffaf1" lw={lw} />
          <path d="M0,4 C-8,-2 -5,-9 0,-5 C5,-9 8,-2 0,4Z" fill="#ff8fa8" stroke={INK} strokeWidth={lw * 0.4} transform="translate(0 -1)" />
        </g>,
      );
    }
    if (f === "earSteam") // 약 오름: 양옆으로 칙칙 김
      [-1, 1].forEach((d, i) => {
        const p = (t * 1.2 + i * 0.5) % 1;
        out.push(
          <g key={`es${d}`} transform={`translate(${n2(X + d * (rx * 0.95 + p * 22))} ${n2(mid - ry * 0.2 - p * 6)}) scale(${n2(0.5 + p * 0.6)})`} opacity={1 - p}>
            <InkPuff bumps={cloudBumps(16, 8, 3 + i)} fill="#f4f1ec" lw={lw} />
          </g>,
        );
      });
    if (f === "boilUp") // 부글부글: 머리 위에서 거품이 끓어오름
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.9 + i / 5) % 1;
        const x = X + (i - 2) * 9 + Math.sin(p * 10 + i) * 2;
        const r = 2 + (i % 2) * 1.5 + p * 2;
        out.push(<circle key={`bu${i}`} cx={x} cy={head + 2 - p * 20} r={r} fill="#ffb09a" fillOpacity="0.55" stroke="#d6362a" strokeWidth={lw * 0.5} opacity={1 - p} />);
      }
  }
  return <g>{out}</g>;
}

// 동그라미 여럿을 합친 모양에 바깥 윤곽선만(김·한숨·작은 비구름)
function InkPuff({ bumps, fill, lw }: { bumps: [number, number, number][]; fill: string; lw: number }) {
  return (
    <g>
      {bumps.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r + lw * 0.55} fill={INK} />)}
      {bumps.map(([x, y, r], i) => <circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />)}
      {bumps.slice(0, 3).map(([x, y, r], i) => <circle key={`h${i}`} cx={x - r * 0.2} cy={y - r * 0.25} r={r * 0.45} fill="#ffffff" opacity="0.6" />)}
    </g>
  );
}

function star5(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"}${n2(cx + Math.cos(a) * rr)},${n2(cy + Math.sin(a) * rr)}`;
  }
  return `${d}Z`;
}

// ── 배경 장면(선 없이 칠한 수채·과슈풍). 감정 무리마다 하늘·빛·날씨가 다르다. ──
type Kit = (typeof SCENE)[Group];

function Cloud({ x, y, w, h, kit, seed }: { x: number; y: number; w: number; h: number; kit: Kit; seed: number }) {
  const bumps = cloudBumps(w, h, seed);
  return (
    <g transform={`translate(${n2(x)} ${n2(y)})`}>
      {bumps.map(([bx, by, r], i) => <circle key={`a${i}`} cx={bx} cy={by + 3} r={r} fill={kit.cloud[2]} />)}
      {bumps.map(([bx, by, r], i) => <circle key={`b${i}`} cx={bx - 1} cy={by} r={r * 0.96} fill={kit.cloud[1]} />)}
      {bumps.map(([bx, by, r], i) => <circle key={`c${i}`} cx={bx - 2.5} cy={by - 3} r={r * 0.78} fill={kit.cloud[0]} />)}
    </g>
  );
}

// 물감이 번진 가장자리
function Wash({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-20%" width="120%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

// 하늘·해·달·먼 산·언덕·나무·풀포기: 감정이 바뀔 때만 다시 그린다
const SceneStill = memo(function SceneStill({ id, kit, mood }: { id: string; kit: Kit; mood: Group }) {
  return (
    <svg viewBox="0 0 200 200" style={STILL} aria-hidden>
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
        <mask id={`${id}moon`}><rect width="200" height="200" fill="#fff" /><circle cx="156" cy="37" r="11.5" fill="#000" /></mask>
        <Wash id={`${id}wash`} />
      </defs>
      <rect width="200" height="200" fill={`url(#${id}sky)`} />
      {kit.sun && mood !== "angry" && (
        <g>
          <circle cx="152" cy="44" r="46" fill={`url(#${id}glow)`} />
          <circle cx="152" cy="44" r="15" fill={kit.sun} filter={`url(#${id}blur)`} opacity="0.95" />
        </g>
      )}
      {mood === "angry" && (
        <g>
          <circle cx="62" cy="128" r="70" fill={`url(#${id}glow)`} />
          <circle cx="62" cy="128" r="26" fill={kit.sun!} filter={`url(#${id}blur)`} />
        </g>
      )}
      {kit.moon && (
        <g>
          <circle cx="150" cy="42" r="30" fill={`url(#${id}glow)`} opacity="0.6" />
          <circle cx="150" cy="42" r="13" fill="#fbf3c8" mask={`url(#${id}moon)`} />
        </g>
      )}
      <g filter={`url(#${id}wash)`}>
        {/* 먼 산 → 가까운 언덕(멀수록 푸르게) */}
        <path d="M0,128 Q22,108 48,118 T96,112 T150,104 T200,116 V200 H0Z" fill={kit.far} />
        <path d="M0,128 Q22,108 48,118 T96,112 T150,104 T200,116" fill="none" stroke={mix(kit.far, "#ffffff", 0.35)} strokeWidth="2" opacity="0.5" />
        <path d="M0,146 Q34,128 74,138 T140,134 T200,140 V200 H0Z" fill={kit.mid} />
        {mood !== "sad" && mood !== "fear" && (
          <g>
            <path d="M33,138 L33,122" stroke="#5a4232" strokeWidth="3" />
            {cloudBumps(26, 13, 5).map(([x, y, r], i) => <circle key={i} cx={33 + x} cy={114 + y} r={r} fill={mix(kit.mid, "#1f3b22", 0.35)} />)}
            {cloudBumps(26, 13, 5).map(([x, y, r], i) => <circle key={`l${i}`} cx={32 + x - 1.5} cy={112 + y} r={r * 0.75} fill={mix(kit.mid, "#2f5a2c", 0.15)} />)}
          </g>
        )}
        <path d="M-10,200 L-10,170 Q40,150 100,158 Q160,150 210,168 L210,200Z" fill={`url(#${id}near)`} />
      </g>
      {/* 풀포기: 세 잎씩 모여 난 풀, 언덕 꼭대기에는 밝은 붓질 몇 번 */}
      {Array.from({ length: 13 }, (_, i) => {
        const x = (i * 53 + 7) % 196 + 2, y = 172 + ((i * 29) % 24);
        const lean = mood === "angry" ? 1.8 : 0;
        return (
          <path key={i} d={`M${x},${y} q${-2 + lean},-3 ${-3.5 + lean * 1.5},-6 M${x},${y} q${lean},-4 ${0.5 + lean * 1.6},-8 M${x},${y} q${2 + lean},-3 ${3.5 + lean * 1.4},-5`}
            stroke={mix(kit.grass, kit.near[0], 0.25)} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.75" />
        );
      })}
      {[[30, 163], [78, 158], [126, 158], [172, 162]].map(([x, y], i) => (
        <path key={`hl${i}`} d={`M${x - 8},${y + 1} q8,-3 16,0`} stroke={mix(kit.near[0], "#fffbe6", 0.4)} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
      ))}
      {(mood === "joy" || mood === "calm") && Array.from({ length: 9 }, (_, i) => (
        <circle key={`f${i}`} cx={(i * 61 + 13) % 196 + 2} cy={170 + ((i * 23) % 26)} r="1.6" fill={i % 2 ? "#ffffff" : "#ffe27a"} />
      ))}
      {mood === "sad" && [[40, 186], [158, 181]].map(([x, y], i) => <ellipse key={`pd${i}`} cx={x} cy={y} rx="16" ry="3.2" fill="#a9bfd6" opacity="0.7" />)}
    </svg>
  );
});

// 구름은 0.5초마다 한 칸씩(배경은 천천히, 끊어서 흘러가는 리미티드 애니메이션)
const SceneClouds = memo(function SceneClouds({ id, kit, mood, step }: { id: string; kit: Kit; mood: Group; step: number }) {
  const t = step / 2;
  const heavy = mood === "sad";
  const drift = (base: number) => ((base + t * (heavy ? 1.6 : 2.4)) % 270) - 35;
  const clouds: [number, number, number, number, number][] = heavy
    ? [[10, 34, 90, 26, 1], [120, 26, 110, 30, 2], [60, 64, 80, 20, 3], [170, 70, 70, 18, 4]]
    : mood === "fear"
      ? [[40, 70, 70, 16, 1], [150, 92, 60, 14, 2]]
      : [[20, 48, 70, 22, 1], [130, 34, 84, 26, 2], [210, 78, 56, 16, 3]];
  return (
    <svg viewBox="0 0 200 200" style={LAYER} aria-hidden>
      <defs><Wash id={`${id}wash`} /></defs>
      {kit.moon && Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={(i * 53) % 190 + 5} cy={(i * 37) % 90 + 6} r={0.9 + (i % 3) * 0.4} fill="#fff8d8" opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 1.7 + i))} />
      ))}
      <g filter={`url(#${id}wash)`}>
        {clouds.map(([x, y, w, h, s]) => <Cloud key={s} x={drift(x)} y={y} w={w} h={h} kit={kit} seed={s} />)}
      </g>
    </svg>
  );
});

// 앞쪽 풀포기·날씨(비·나비·민들레 씨·잎·반딧불)·웅덩이 물결: 필터 없이 가볍게, 1초 12장
function SceneFront({ kit, mood, t }: { kit: Kit; mood: Group; t: number }) {
  const parts: ReactNode[] = [];
  if (kit.particle === "rain") {
    for (let i = 0; i < 26; i++) {
      const p = (t * 1.4 + (i * 0.37) % 1) % 1;
      const x = (i * 41) % 210 - 5 - p * 10;
      parts.push(<path key={i} d={`M${n2(x)},${n2(-10 + p * 220)} l-3,9`} stroke="#e4eef8" strokeWidth="1" opacity="0.7" strokeLinecap="round" />);
    }
    [[40, 186], [158, 181]].forEach(([x, y], i) => {
      const p = (t * 0.6 + i * 0.5) % 1;
      parts.push(<ellipse key={`rp${i}`} cx={x} cy={y} rx={3 + p * 12} ry={0.8 + p * 2.4} fill="none" stroke="#e6f0fa" strokeWidth="0.8" opacity={1 - p} />);
    });
  }
  if (kit.particle === "fluff")
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.07 + i / 5) % 1;
      const x = 10 + p * 190, y = 130 - p * 70 + Math.sin(t * 1.3 + i * 2) * 8 + (i % 2) * 20;
      parts.push(
        <g key={i} transform={`translate(${n2(x)} ${n2(y)})`} opacity="0.85">
          <circle r="2.6" fill="#ffffff" opacity="0.65" />
          {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M0,0 l0,-3.5" stroke="#ffffff" strokeWidth="0.7" transform={`rotate(${a})`} />)}
        </g>,
      );
    }
  if (kit.particle === "butterfly")
    for (let i = 0; i < 2; i++) {
      const x = 24 + i * 140 + Math.sin(t * 0.8 + i * 3) * 18, y = 96 + Math.cos(t * 1.1 + i) * 12 - i * 14;
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + i));
      parts.push(
        <g key={i} transform={`translate(${n2(x)} ${n2(y)})`}>
          {[-1, 1].map((d) => <ellipse key={d} cx={d * 2.4 * flap} cy="0" rx={2.6 * flap} ry="2.2" fill={i ? "#ffffff" : "#ffe17a"} />)}
          <path d="M0,-2.5 V2.5" stroke="#4a3a2a" strokeWidth="1" />
        </g>,
      );
    }
  if (kit.particle === "leaf")
    for (let i = 0; i < 6; i++) {
      const p = (t * 0.22 + i / 6) % 1;
      const x = -10 + p * 220, y = 60 + ((i * 31) % 90) + Math.sin(p * 12 + i) * 10;
      parts.push(<ellipse key={i} cx="0" cy="0" rx="4" ry="2" fill={i % 2 ? "#e98a3c" : "#c9a23a"} transform={`translate(${n2(x)} ${n2(y)}) rotate(${n2(t * 200 + i * 40)})`} />);
    }
  if (kit.particle === "firefly")
    for (let i = 0; i < 7; i++) {
      const x = (i * 43 + 15) % 190 + Math.sin(t * 0.7 + i * 2) * 8, y = 120 + ((i * 19) % 60) + Math.cos(t * 0.9 + i) * 6;
      const on = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + i * 1.7));
      parts.push(
        <g key={i} opacity={on}>
          <circle cx={x} cy={y} r="5" fill="#e9ff9a" opacity="0.25" />
          <circle cx={x} cy={y} r="1.6" fill="#f6ffc8" />
        </g>,
      );
    }
  return (
    <svg viewBox="0 0 200 200" style={{ ...LAYER, pointerEvents: "none" }} aria-hidden>
      {/* 앞쪽 풀포기(인물 발치에 살짝 겹침) */}
      {[[8, 200, -1], [192, 200, 1], [150, 204, 1]].map(([x, y, d], i) => (
        <g key={`g${i}`} transform={`translate(${x} ${y})`}>
          {[0, 1, 2, 3, 4].map((k) => {
            const sway = Math.sin(t * 1.8 + k + i) * 2 + (mood === "angry" ? 3 : 0);
            return <path key={k} d={`M${(k - 2) * 3},0 Q${(k - 2) * 4 + sway},-12 ${(k - 2) * 5 * d + sway * 1.8},-${20 + (k % 2) * 6}`} stroke={k % 2 ? kit.grass : mix(kit.grass, "#000000", 0.18)} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
          })}
        </g>
      ))}
      {parts}
    </svg>
  );
}

// 빛·가장자리 어둠·종이 결: 한 번만 그려 따로 합성
const SceneLight = memo(function SceneLight({ id, kit }: { id: string; kit: Kit }) {
  return (
    <>
      <svg viewBox="0 0 200 200" style={{ ...STILL, pointerEvents: "none", mixBlendMode: "soft-light" }} aria-hidden>
        <rect width="200" height="200" fill={kit.light} opacity={kit.lightOp * 1.6} />
      </svg>
      <svg viewBox="0 0 200 200" style={{ ...STILL, pointerEvents: "none" }} aria-hidden>
        <defs>
          <radialGradient id={`${id}vig`} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#1d1630" stopOpacity="0.32" />
          </radialGradient>
        </defs>
        <rect width="200" height="200" fill={`url(#${id}vig)`} />
      </svg>
      <svg viewBox="0 0 200 200" style={{ ...STILL, pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.3 }} aria-hidden>
        <defs>
          <filter id={`${id}paper`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="4" seed="11" />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 1.4 -0.55" />
          </filter>
        </defs>
        <rect width="200" height="200" filter={`url(#${id}paper)`} />
      </svg>
    </>
  );
});
