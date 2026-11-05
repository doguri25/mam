// 감정 그림카드 · 까닭 그림 · 마음 꽃. 모두 마음 친구와 같은 손그림 그림체(세피아 잉크선 + 셀 그림자)로 그린다.
// 감정 카드는 감정마다 색을 입힌 마음 친구가 그 감정 표정(큰 감정 12가지 · 더 꼭 맞는 말 36가지)을 짓는다.
import Doodle, { type DoodleName } from "./Doodle";
import BuddyFace from "./BuddyFace";
import { parentOf } from "./buddy/expr";
import { INK, mix, paints } from "./buddy/paint";
import { w, type Lang } from "@/lib/i18n";
import { DEFAULT_LOOK, GROUPS, groupOf } from "@/lib/shared";

export const EMOTION_COLOR: Record<string, string> = {
  기뻐요: "#ffc23c", 신나요: "#ff9a2e", 고마워요: "#ff8fb1", 편안해요: "#74c27a", "그저 그래요": "#a9b7a4", 피곤해요: "#9aa9d8",
  걱정돼요: "#b691de", 무서워요: "#7d6bc8", 슬퍼요: "#5aa7ea", 속상해요: "#4b7fc3", 억울해요: "#f57d5c", 화나요: "#e5404d",
};
// 카드 색: 큰 감정은 그 색, 그 밑 낱말은 큰 감정 색에 낱말마다 다른 물감을 조금 섞어(같은 무리라도 카드가 알록달록)
const TINTS = ["#ffd36b", "#ff9eb0", "#8cc8f0", "#9be0a8", "#c8a6f0", "#ffb07a", "#7fd6c8"];
export function cardColor(name: string) {
  if (EMOTION_COLOR[name]) return EMOTION_COLOR[name];
  const base = EMOTION_COLOR[parentOf(name)] ?? GROUPS[groupOf(name)]?.color ?? EMOTION_COLOR["그저 그래요"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return mix(base.toLowerCase(), TINTS[h % TINTS.length], 0.35);
}
const colorOf = cardColor;

// 감정 그림카드: 그 감정 색을 입은 마음 친구가 그 표정을 짓는다(이름은 큰 감정이든 더 꼭 맞는 말이든)
// lang: 읽어 주기(그림 이름)를 학생이 고른 언어로. 없으면 한국어(선생님 화면)
export function EmotionArt({ name, size = 56, className, lang }: { name: string; size?: number; className?: string; lang?: Lang }) {
  return <BuddyFace look={{ ...DEFAULT_LOOK, color: colorOf(name) }} emotion={name} size={size} className={className} aura={false} label={lang ? w(lang, name) : name} />;
}

const REASONS: Record<string, { bg: string; icon: DoodleName }> = {
  친구: { bg: "#e3f4f1", icon: "friends" },
  공부: { bg: "#fff1d6", icon: "study" },
  집: { bg: "#fde8e4", icon: "house" },
  몸: { bg: "#e8f0fd", icon: "bandage" },
  그냥: { bg: "#eef1f4", icon: "cloudDots" },
};

export function ReasonArt({ name, size = 44, lang }: { name: string; size?: number; lang?: Lang }) {
  const r = REASONS[name] ?? REASONS["그냥"];
  return (
    <span role="img" aria-label={lang ? w(lang, name) : name} className="grid shrink-0 place-items-center" style={{ width: size, height: size, borderRadius: size * 0.28, background: r.bg }}>
      <Doodle name={r.icon} size={Math.round(size * 0.74)} className="block" />
    </span>
  );
}

// 마음 꽃: 기록한 날마다 한 송이 (색은 그날 마음 색)
export function Flower({ color, size = 28 }: { color: string; size?: number }) {
  const pal = paints(color);
  const leaf = paints("#7cc06a");
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden overflow="visible">
      <path d="M20 22Q19 32 20 39" stroke={INK} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <path d="M20 22Q19 32 20 39" stroke={leaf.lit} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M20 33Q12 31 10.5 25Q18 24.5 20 31Z" fill={leaf.lit} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`rotate(${a} 20 16)`}>
          <ellipse cx={20.5} cy={9.6} rx={5} ry={6.6} fill={INK} />
          <ellipse cx={20} cy={9} rx={5} ry={6.6} fill={pal.lit} stroke={INK} strokeWidth={1.6} />
          <ellipse cx={21.4} cy={10.6} rx={2.6} ry={4} fill={pal.shade} opacity={0.55} />
        </g>
      ))}
      <circle cx={20} cy={16} r={4} fill="#f7d35a" stroke={INK} strokeWidth={1.6} />
    </svg>
  );
}
