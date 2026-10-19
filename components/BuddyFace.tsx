// 마음 친구의 납작한(2D) 얼굴: 선생님 화면처럼 작게 여러 개 보여야 하거나 3D가 안 되는 기기에서 쓴다.
// 3D 마음 친구와 같은 몸 색·모양·꾸미개·감정 표정을 그린다.
import { DEFAULT_LOOK, GROUPS, groupOf, type BuddyLook, type Group } from "@/lib/shared";

const BODY = { round: [32, 32], squish: [37, 27], bean: [27, 37] } as const;
const MOUTH: Record<Group, string> = {
  joy: "M40 66 Q50 75 60 66",
  calm: "M43 67 Q50 71 57 67",
  sad: "M41 72 Q50 64 59 72",
  angry: "M41 72 Q50 65 59 72",
  fear: "",
};

export default function BuddyFace({ look = DEFAULT_LOOK, emotion, size = 40, className }: { look?: BuddyLook; emotion?: string; size?: number; className?: string }) {
  const g = emotion ? groupOf(emotion) : "calm";
  const mood = GROUPS[g].color;
  const [rx, ry] = BODY[look.shape];
  const top = 58 - ry;
  const eyeY = g === "sad" || g === "angry" ? 0.5 : g === "fear" ? 1.35 : 1;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      {look.color && <ellipse cx="50" cy="58" rx={rx + 5} ry={ry + 5} fill={mood} opacity="0.35" />}
      <ellipse cx="50" cy="58" rx={rx} ry={ry} fill={look.color || mood} />
      <ellipse cx="42" cy="54" rx="9" ry="6" fill="#fff" opacity="0.25" />
      {[-10, 10].map((dx) => (
        <ellipse key={dx} cx={50 + dx} cy="53" rx="3.4" ry={3.4 * eyeY} fill="#2d2a26" transform={g === "angry" ? `rotate(${dx < 0 ? 18 : -18} ${50 + dx} 53)` : undefined} />
      ))}
      {MOUTH[g] ? <path d={MOUTH[g]} fill="none" stroke="#2d2a26" strokeWidth="3" strokeLinecap="round" /> : <ellipse cx="50" cy="68" rx="3.5" ry="4.5" fill="#2d2a26" />}
      {g === "joy" && [-19, 19].map((dx) => <ellipse key={dx} cx={50 + dx} cy="62" rx="5" ry="3" fill="#ff9eb0" opacity="0.8" />)}
      {look.acc === "sprout" && (
        <g>
          <path d={`M50 ${top + 2} V${top - 9}`} stroke="#4f8f43" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="44" cy={top - 11} rx="7" ry="3.5" fill="#7cc36a" transform={`rotate(-25 44 ${top - 11})`} />
          <ellipse cx="56" cy={top - 11} rx="7" ry="3.5" fill="#7cc36a" transform={`rotate(25 56 ${top - 11})`} />
        </g>
      )}
      {look.acc === "ribbon" && (
        <g transform={`translate(${50 + rx * 0.62} ${top + 8}) rotate(-25)`}>
          <path d="M0 0 L-11 -7 L-11 7 Z M0 0 L11 -7 L11 7 Z" fill="#ff5c8a" />
          <circle r="3.5" fill="#e2406f" />
        </g>
      )}
      {look.acc === "party" && (
        <g transform={`rotate(-10 50 ${top + 3})`}>
          <path d={`M39 ${top + 4} L61 ${top + 4} L51 ${top - 22} Z`} fill="#7fb5f0" />
          <circle cx="51" cy={top - 23} r="4" fill="#f6c445" />
        </g>
      )}
      {look.acc === "crown" && (
        <path d={`M36 ${top + 5} L36 ${top - 8} L43 ${top - 1} L50 ${top - 11} L57 ${top - 1} L64 ${top - 8} L64 ${top + 5} Z`} fill="#f2b705" />
      )}
      {look.acc === "glasses" && (
        <g fill="none" stroke="#2d2a26" strokeWidth="2.5">
          <circle cx="40" cy="53" r="7.5" />
          <circle cx="60" cy="53" r="7.5" />
          <path d="M47.5 53 H52.5" />
        </g>
      )}
    </svg>
  );
}
