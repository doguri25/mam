// 직접 그린 감정 얼굴 12개 · 까닭 그림 5개. 마음 친구와 같은 「빛 방울」 모양에 감정마다 색과 표정·소품을 다르게 했다.
import type { ReactNode } from "react";

const INK = "#3b2f2f";
const EYE_L = 36;
const EYE_R = 64;

type Face = { color: string; light: string; body: ReactNode; extra?: ReactNode };

const dots = (y = 47, r = 3.6) => (
  <>
    <circle cx={EYE_L} cy={y} r={r} fill={INK} />
    <circle cx={EYE_R} cy={y} r={r} fill={INK} />
  </>
);
const blush = (color = "#ff8fa3", r = 6, op = 0.55) => (
  <>
    <ellipse cx={25} cy={59} rx={r} ry={r * 0.62} fill={color} opacity={op} />
    <ellipse cx={75} cy={59} rx={r} ry={r * 0.62} fill={color} opacity={op} />
  </>
);
const line = { fill: "none", stroke: INK, strokeWidth: 3.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const star = (cx: number, cy: number, s: number, fill: string) => (
  <path
    d={`M${cx} ${cy - s} L${cx + s * 0.28} ${cy - s * 0.28} L${cx + s} ${cy} L${cx + s * 0.28} ${cy + s * 0.28} L${cx} ${cy + s} L${cx - s * 0.28} ${cy + s * 0.28} L${cx - s} ${cy} L${cx - s * 0.28} ${cy - s * 0.28}Z`}
    fill={fill}
  />
);
const heart = (cx: number, cy: number, s: number, fill: string) => (
  <path d={`M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.2} ${cx - s * 0.6} ${cy - s * 1.3} ${cx} ${cy - s * 0.35} C${cx + s * 0.6} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.2} ${cx} ${cy + s * 0.9}Z`} fill={fill} />
);
const drop = (cx: number, cy: number, s: number, fill = "#8fd0ff") => (
  <path d={`M${cx} ${cy - s} C${cx + s * 0.9} ${cy} ${cx + s * 0.75} ${cy + s * 0.9} ${cx} ${cy + s * 0.9} C${cx - s * 0.75} ${cy + s * 0.9} ${cx - s * 0.9} ${cy} ${cx} ${cy - s}Z`} fill={fill} stroke="#fff" strokeWidth={1.2} />
);

const FACES: Record<string, Face> = {
  기뻐요: {
    color: "#ffc23c", light: "#fff3c4",
    body: (
      <>
        <path d="M29 49 Q36 41 43 49" {...line} />
        <path d="M57 49 Q64 41 71 49" {...line} />
        <path d="M33 59 Q50 80 67 59 Z" fill={INK} />
        <path d="M42 70 Q50 64 58 70 Q50 76 42 70Z" fill="#ff7b8f" />
        {blush()}
      </>
    ),
  },
  신나요: {
    color: "#ff9a2e", light: "#ffe0b8",
    body: (
      <>
        {star(EYE_L, 46, 7, INK)}
        {star(EYE_R, 46, 7, INK)}
        <ellipse cx={50} cy={65} rx={11} ry={10} fill={INK} />
        <ellipse cx={50} cy={70} rx={7} ry={4.5} fill="#ff7b8f" />
      </>
    ),
    extra: (
      <>
        {star(13, 22, 7, "#ffd84d")}
        {star(88, 18, 5, "#ffd84d")}
        {star(90, 78, 6, "#ffd84d")}
      </>
    ),
  },
  고마워요: {
    color: "#ff8fb1", light: "#ffe3ec",
    body: (
      <>
        <path d="M29 48 Q36 42 43 48" {...line} />
        <path d="M57 48 Q64 42 71 48" {...line} />
        <path d="M41 60 Q50 69 59 60" {...line} />
        {blush("#ff5d8f", 6.5, 0.45)}
      </>
    ),
    extra: (
      <>
        {heart(80, 74, 9, "#e8396b")}
        {heart(84, 22, 5.5, "#ff5d8f")}
      </>
    ),
  },
  편안해요: {
    color: "#74c27a", light: "#dff3df",
    body: (
      <>
        <path d="M29 46 Q36 52 43 46" {...line} />
        <path d="M57 46 Q64 52 71 46" {...line} />
        <path d="M42 61 Q50 67 58 61" {...line} />
        {blush("#ffa3a3", 5, 0.35)}
      </>
    ),
    extra: (
      <>
        <path d="M50 12 Q50 6 55 3" fill="none" stroke="#3f7d4c" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M55 4 Q66 0 66 10 Q57 12 55 4Z" fill="#4fae5a" />
      </>
    ),
  },
  "그저 그래요": {
    color: "#a9b7a4", light: "#eef1ec",
    body: (
      <>
        {dots(47, 3.4)}
        <path d="M40 63 L60 63" {...line} />
      </>
    ),
  },
  피곤해요: {
    color: "#9aa9d8", light: "#e6eaf7",
    body: (
      <>
        <path d="M29 48 L43 48" {...line} />
        <path d="M31 49 Q36 54 41 49" fill={INK} />
        <path d="M57 48 L71 48" {...line} />
        <path d="M59 49 Q64 54 69 49" fill={INK} />
        <ellipse cx={50} cy={66} rx={5} ry={6} fill={INK} />
      </>
    ),
    extra: (
      <text x={76} y={26} fontSize={15} fontWeight={800} fill="#5b6aa8" fontFamily="sans-serif">
        z<tspan dx={2} dy={-8} fontSize={11}>z</tspan>
      </text>
    ),
  },
  걱정돼요: {
    color: "#b691de", light: "#efe5fa",
    body: (
      <>
        {dots(49, 3.4)}
        <path d="M28 39 L41 35" {...line} strokeWidth={3} />
        <path d="M72 39 L59 35" {...line} strokeWidth={3} />
        <path d="M37 65 q4.3 -4 8.6 0 t8.6 0 t8.6 0" {...line} strokeWidth={3.2} />
      </>
    ),
    extra: drop(80, 33, 7),
  },
  무서워요: {
    color: "#7d6bc8", light: "#e4dff6",
    body: (
      <>
        <circle cx={EYE_L} cy={46} r={8} fill="#fff" stroke={INK} strokeWidth={2.4} />
        <circle cx={EYE_R} cy={46} r={8} fill="#fff" stroke={INK} strokeWidth={2.4} />
        <circle cx={EYE_L} cy={47} r={2.6} fill={INK} />
        <circle cx={EYE_R} cy={47} r={2.6} fill={INK} />
        <ellipse cx={50} cy={67} rx={6} ry={8} fill={INK} />
      </>
    ),
    extra: (
      <>
        <path d="M5 42 l7 3 M4 52 l8 0 M5 62 l7 -3" stroke="#5a4aa0" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M95 42 l-7 3 M96 52 l-8 0 M95 62 l-7 -3" stroke="#5a4aa0" strokeWidth={2.6} strokeLinecap="round" />
      </>
    ),
  },
  슬퍼요: {
    color: "#5aa7ea", light: "#dceefc",
    body: (
      <>
        {dots(48, 3.4)}
        <path d="M29 41 L41 37" {...line} strokeWidth={3} />
        <path d="M71 41 L59 37" {...line} strokeWidth={3} />
        <path d="M38 69 Q50 58 62 69" {...line} />
        {drop(EYE_L - 2, 59, 6, "#a8dcff")}
      </>
    ),
  },
  속상해요: {
    color: "#4b7fc3", light: "#dbe6f6",
    body: (
      <>
        <circle cx={EYE_L} cy={51} r={3.2} fill={INK} />
        <circle cx={EYE_R} cy={51} r={3.2} fill={INK} />
        <path d="M29 43 L42 43" {...line} strokeWidth={3} />
        <path d="M58 43 L71 43" {...line} strokeWidth={3} />
        <path d="M44 67 Q50 62 56 67" {...line} />
      </>
    ),
    extra: (
      <path
        d="M30 14 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0 q4 -6 8 0"
        fill="none" stroke="#6b7a8f" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
      />
    ),
  },
  억울해요: {
    color: "#f57d5c", light: "#fde0d6",
    body: (
      <>
        <path d="M30 44 L41 48 L30 51" {...line} strokeWidth={3.2} />
        <path d="M70 44 L59 48 L70 51" {...line} strokeWidth={3.2} />
        <path d="M40 66 q5 -3.5 10 0 t10 0" {...line} strokeWidth={3.2} />
        <circle cx={24} cy={61} r={8} fill="#ff6a4d" opacity={0.45} />
        <circle cx={76} cy={61} r={8} fill="#ff6a4d" opacity={0.45} />
      </>
    ),
    extra: (
      <>
        <rect x={84} y={10} width={5.5} height={15} rx={2.5} fill="#c8402a" />
        <circle cx={86.8} cy={30} r={3} fill="#c8402a" />
      </>
    ),
  },
  화나요: {
    color: "#e5404d", light: "#fbdadd",
    body: (
      <>
        <path d="M27 37 L42 44" {...line} strokeWidth={4.2} />
        <path d="M73 37 L58 44" {...line} strokeWidth={4.2} />
        {dots(50, 3.6)}
        <rect x={37} y={61} width={26} height={11} rx={4} fill="#fff" stroke={INK} strokeWidth={2.6} />
        <path d="M45.7 61 V72 M54.3 61 V72 M37 66.5 H63" stroke={INK} strokeWidth={1.8} />
      </>
    ),
    extra: (
      <>
        <g fill="#f4f4f4" stroke="#c9c9c9" strokeWidth={1}>
          <circle cx={13} cy={20} r={6} />
          <circle cx={19} cy={13} r={5} />
          <circle cx={87} cy={20} r={6} />
          <circle cx={81} cy={13} r={5} />
        </g>
      </>
    ),
  },
};

export const EMOTION_COLOR = Object.fromEntries(Object.entries(FACES).map(([k, f]) => [k, f.color]));

export function EmotionArt({ name, size = 56, className }: { name: string; size?: number; className?: string }) {
  const f = FACES[name] ?? FACES["그저 그래요"];
  const id = `g-${Object.keys(FACES).indexOf(name)}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={name} className={className}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={f.light} />
          <stop offset="55%" stopColor={f.color} />
          <stop offset="100%" stopColor={f.color} stopOpacity={0.92} />
        </radialGradient>
      </defs>
      <ellipse cx={50} cy={93} rx={26} ry={4} fill="#000" opacity={0.08} />
      <circle cx={50} cy={53} r={38} fill={`url(#${id})`} />
      <ellipse cx={37} cy={31} rx={9} ry={5} fill="#fff" opacity={0.55} transform="rotate(-25 37 31)" />
      {f.body}
      {f.extra}
    </svg>
  );
}

const REASONS: Record<string, { bg: string; body: ReactNode }> = {
  친구: {
    bg: "#e3f4f1",
    body: (
      <>
        <circle cx={38} cy={38} r={11} fill="#3fb39a" />
        <path d="M20 76 Q20 54 38 54 Q56 54 56 76Z" fill="#3fb39a" />
        <circle cx={63} cy={42} r={10} fill="#ff9a6b" />
        <path d="M46 78 Q46 58 63 58 Q80 58 80 78Z" fill="#ff9a6b" />
        {heart(51, 24, 5, "#ff5d8f")}
      </>
    ),
  },
  공부: {
    bg: "#fff1d6",
    body: (
      <>
        <path d="M14 34 Q32 28 50 36 V78 Q32 70 14 76Z" fill="#fff" stroke="#e0a43a" strokeWidth={3} strokeLinejoin="round" />
        <path d="M86 34 Q68 28 50 36 V78 Q68 70 86 76Z" fill="#fff" stroke="#e0a43a" strokeWidth={3} strokeLinejoin="round" />
        <path d="M22 46 Q32 43 42 47 M22 56 Q32 53 42 57 M58 47 Q68 43 78 46 M58 57 Q68 53 78 56" stroke="#f0c26b" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <g transform="rotate(35 74 24)">
          <rect x={70} y={6} width={8} height={30} rx={2} fill="#4f8fe0" />
          <path d="M70 36 L74 44 L78 36Z" fill="#f2c08a" />
        </g>
      </>
    ),
  },
  집: {
    bg: "#fde8e4",
    body: (
      <>
        <path d="M16 48 L50 20 L84 48" fill="none" stroke="#e25a52" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 46 V80 H76 V46 L50 26Z" fill="#fff" stroke="#e25a52" strokeWidth={3} strokeLinejoin="round" />
        <rect x={43} y={58} width={14} height={22} rx={3} fill="#f2a65a" />
        <rect x={30} y={52} width={10} height={10} rx={2} fill="#9fd3f5" />
        <rect x={62} y={52} width={10} height={10} rx={2} fill="#9fd3f5" />
      </>
    ),
  },
  몸: {
    bg: "#e8f0fd",
    body: (
      <g transform="rotate(-35 50 52)">
        <rect x={16} y={39} width={68} height={26} rx={13} fill="#f7c9a0" stroke="#d9a074" strokeWidth={2.4} />
        <rect x={38} y={39} width={24} height={26} fill="#fbe3cc" />
        <g fill="#d9a074">
          <circle cx={45} cy={47} r={1.8} /><circle cx={55} cy={47} r={1.8} />
          <circle cx={45} cy={57} r={1.8} /><circle cx={55} cy={57} r={1.8} />
        </g>
      </g>
    ),
  },
  그냥: {
    bg: "#eef1f4",
    body: (
      <>
        <path d="M26 66 Q12 66 14 54 Q16 43 29 45 Q32 30 48 31 Q62 31 66 42 Q84 40 86 54 Q87 66 72 66Z" fill="#fff" stroke="#9aa6b5" strokeWidth={3} strokeLinejoin="round" />
        <circle cx={38} cy={54} r={3.4} fill="#9aa6b5" />
        <circle cx={50} cy={54} r={3.4} fill="#9aa6b5" />
        <circle cx={62} cy={54} r={3.4} fill="#9aa6b5" />
      </>
    ),
  },
};

export function ReasonArt({ name, size = 44 }: { name: string; size?: number }) {
  const r = REASONS[name] ?? REASONS["그냥"];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={name}>
      <rect x={4} y={4} width={92} height={92} rx={26} fill={r.bg} />
      {r.body}
    </svg>
  );
}

// 마음 꽃: 기록한 날마다 한 송이 (색은 그날 마음 색)
export function Flower({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <path d="M20 22 Q19 32 20 39" stroke="#5aa86a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M20 33 Q12 30 11 25 Q18 25 20 31" fill="#7cc487" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={20} cy={11} rx={5} ry={7.5} fill={color} opacity={0.9} transform={`rotate(${a} 20 17)`} />
      ))}
      <circle cx={20} cy={17} r={4.2} fill="#ffd84d" />
    </svg>
  );
}
