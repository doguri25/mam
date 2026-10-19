// 마음 친구의 납작한(2D) 얼굴: 선생님 화면처럼 작게 여러 개 보여야 하거나 3D가 안 되는 기기에서 쓴다.
// 3D 마음 친구와 같은 몸 색·모양·눈·볼·무늬·팔다리·꾸미개·감정 표정을 그린다.
import { DEFAULT_LOOK, GROUPS, groupOf, lighten, type BuddyLook, type Group } from "@/lib/shared";

const BODY = { round: [30, 30], squish: [35, 25], bean: [25, 35] } as const;
const MOUTH: Record<Group, string> = {
  joy: "M41 67 Q50 75 59 67",
  calm: "M44 68 Q50 72 56 68",
  sad: "M42 73 Q50 65 58 73",
  angry: "M42 73 Q50 66 58 73",
  fear: "",
};
const INK = "#2d2a26";

export default function BuddyFace({ look = DEFAULT_LOOK, emotion, size = 40, className }: { look?: BuddyLook; emotion?: string; size?: number; className?: string }) {
  const g = emotion ? groupOf(emotion) : "calm";
  const mood = GROUPS[g].color;
  const color = look.color || mood;
  const soft = lighten(color, 0.45);
  const [rx, ry] = BODY[look.shape];
  const cy = 60;
  const top = cy - ry;
  const eyeY = g === "sad" || g === "angry" ? 0.5 : g === "fear" ? 1.35 : 1;
  const tilt = (dx: number) => (g === "angry" ? `rotate(${dx < 0 ? 18 : -18} ${50 + dx} 54)` : undefined);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      {look.color && <ellipse cx="50" cy={cy} rx={rx + 5} ry={ry + 5} fill={mood} opacity="0.35" />}
      {/* 머리 뒤로 가는 귀 */}
      {look.acc === "cat" && [-1, 1].map((d) => (
        <g key={d}>
          <path d={`M${50 + d * 9} ${top + 6} L${50 + d * 25} ${top - 12} L${50 + d * 27} ${top + 12} Z`} fill={color} />
          <path d={`M${50 + d * 13} ${top + 6} L${50 + d * 23} ${top - 5} L${50 + d * 24} ${top + 9} Z`} fill="#ffb3c4" />
        </g>
      ))}
      {look.acc === "bunny" && [-1, 1].map((d) => (
        <g key={d} transform={`rotate(${d * 10} ${50 + d * 10} ${top + 4})`}>
          <ellipse cx={50 + d * 10} cy={top - 12} rx="6.5" ry="17" fill={color} />
          <ellipse cx={50 + d * 10} cy={top - 11} rx="3.5" ry="12" fill="#ffb3c4" />
        </g>
      ))}
      {look.limbs === "both" && [-1, 1].map((d) => <ellipse key={d} cx={50 + d * 13} cy={cy + ry - 1} rx="9" ry="5" fill={color} />)}
      {look.limbs !== "none" && [-1, 1].map((d) => (
        <ellipse key={d} cx={50 + d * (rx + 4)} cy={cy + 5} rx="5" ry="8" fill={color} transform={`rotate(${d * (g === "sad" || g === "angry" || g === "fear" ? 10 : 35)} ${50 + d * (rx + 4)} ${cy + 5})`} />
      ))}
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={color} />
      {look.pattern === "spots" && [[-0.7, -0.45], [0.72, -0.3], [-0.55, 0.62], [0.6, 0.58]].map(([x, y], i) => (
        <circle key={i} cx={50 + x * rx} cy={cy + y * ry} r="4.2" fill={soft} />
      ))}
      {look.pattern === "belly" && <ellipse cx="50" cy={cy + ry * 0.72} rx={rx * 0.5} ry={ry * 0.22} fill={soft} />}
      <ellipse cx="41" cy={cy - 6} rx="9" ry="6" fill="#fff" opacity="0.25" />
      {[-10, 10].map((dx) => (
        <g key={dx} transform={tilt(dx)}>
          {look.eyes === "big" && <ellipse cx={50 + dx} cy="54" rx="6" ry={6.5 * eyeY} fill="#fff" />}
          <ellipse cx={50 + dx} cy={look.eyes === "big" ? 55 : 54} rx={look.eyes === "sparkle" ? 4.2 : 3.4} ry={(look.eyes === "sparkle" ? 4.2 : 3.4) * eyeY} fill={INK} />
          {look.eyes !== "dot" && <circle cx={51.5 + dx} cy="52.5" r="1.3" fill="#fff" />}
        </g>
      ))}
      {MOUTH[g] ? <path d={MOUTH[g]} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" /> : <ellipse cx="50" cy="69" rx="3.5" ry="4.5" fill={INK} />}
      {(g === "joy" || look.cheek === "blush") && [-19, 19].map((dx) => <ellipse key={dx} cx={50 + dx} cy="63" rx="5" ry="3" fill="#ff9eb0" opacity="0.8" />)}
      {look.cheek === "freckle" && [-1, 1].flatMap((d) => [[17, 61], [21, 64], [15, 65]].map(([x, y], j) => <circle key={`${d}${j}`} cx={50 + d * x} cy={y} r="1.1" fill="#a0623c" />))}
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
          <path d={`M42.5 ${top - 4} L58.5 ${top - 4}`} stroke="#fff" strokeWidth="2.5" />
          <circle cx="51" cy={top - 23} r="4" fill="#f6c445" />
        </g>
      )}
      {look.acc === "crown" && (
        <path d={`M36 ${top + 5} L36 ${top - 8} L43 ${top - 1} L50 ${top - 11} L57 ${top - 1} L64 ${top - 8} L64 ${top + 5} Z`} fill="#f2b705" />
      )}
      {look.acc === "glasses" && (
        <g fill="none" stroke={INK} strokeWidth="2.5">
          <circle cx="40" cy="54" r="7.5" />
          <circle cx="60" cy="54" r="7.5" />
          <path d="M47.5 54 H52.5" />
        </g>
      )}
      {look.acc === "flower" && (
        <g transform={`translate(${50 - rx * 0.6} ${top + 7})`}>
          {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 4.5} cy={Math.sin((a * Math.PI) / 180) * 4.5} r="3.6" fill="#ff8fb0" />)}
          <circle r="2.8" fill="#f6c445" />
        </g>
      )}
      {look.acc === "headphones" && (
        <g>
          <path d={`M${50 - rx - 2} ${cy - 2} A${rx + 2} ${ry + 3} 0 0 1 ${50 + rx + 2} ${cy - 2}`} fill="none" stroke="#5b6470" strokeWidth="3.5" />
          {[-1, 1].map((d) => <rect key={d} x={50 + d * (rx + 2) - 5} y={cy - 9} width="10" height="15" rx="4" fill="#ff7a59" />)}
        </g>
      )}
    </svg>
  );
}
