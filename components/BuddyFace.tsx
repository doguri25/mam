// 마음 친구의 멈춘 한 장: 선생님 화면처럼 작게 여러 개 보여야 하는 곳, 꾸미기 고르는 칸.
// 움직이는 마음 친구와 같은 그림(같은 몸·눈·볼·무늬·팔다리·꾸미개·감정 표정)을 크기에 맞게 덜 그려 가볍게 한다.
import { DEFAULT_LOOK, type BuddyLook } from "@/lib/shared";
import BuddyArt from "./buddy/BuddyArt";
import { exprOf, moodOf, pose } from "./buddy/expr";

export default function BuddyFace({ look = DEFAULT_LOOK, emotion, size = 40, className, aura, label }: { look?: BuddyLook; emotion?: string; size?: number; className?: string; aura?: boolean; label?: string }) {
  const expr = exprOf(emotion);
  const p = { ...pose({ t: 0, expr, intensity: 3, cheer: null, hard: false }), x: 0, y: 0, rot: 0, sx: 1, sy: 1, shadow: 1, blink: 0 };
  return (
    <BuddyArt look={look} mood={moodOf(emotion)} expr={expr} pose={p} t={0.4} boil={0} detail={size < 48 ? "tiny" : size < 110 ? "small" : "full"} size={size} className={className} aura={aura} label={label} />
  );
}
