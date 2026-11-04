// 학생 첫 화면 띠 그림의 친구들: 누가 어디에 서서 어떤 마음을 짓는지, 언제 인사하는지(그림 없이 계산만).
// 7초마다 왼쪽 친구부터 차례로 폴짝 인사(파도타기)하고, 인사하며 뛰어오른 사이에 다음 마음 표정으로 바뀐다.
import { DEFAULT_LOOK, type BuddyLook } from "../../lib/shared.ts";

export const PARADE_W = 320; // 장면 크기(가로 8 : 세로 5)
export const PARADE_H = 200;
export const WAVE_EVERY = 7; // 인사 물결 간격(초)
export const WAVE_GAP = 0.35; // 옆 친구가 이어받는 간격(초)
const FIRST_WAVE = 1.2; // 화면이 뜨고 첫 인사까지(초)
const CHEER = 1.8; // 인사 한 번(폴짝 두 번) 길이(초) — Buddy의 인사와 같다
const SWAP = 0.45; // 인사 시작 뒤 이만큼 지나 공중에 떴을 때 표정을 바꾼다

export interface Friend {
  x: number; y: number; // 발 자리(장면 단위)
  b: number; // 그림 상자 크기(장면 단위). 뒤쪽 친구는 작게
  back: boolean; // 뒤쪽 줄(먼저 그려 앞 친구에 가려지게)
  look: BuddyLook;
  feelings: readonly string[]; // 돌아가며 짓는 마음
}

const look = (o: Partial<BuddyLook>): BuddyLook => ({ ...DEFAULT_LOOK, ...o });

// 왼쪽부터(= 인사 순서). 몸 모양·색·꾸미개가 모두 다르게
export const FRIENDS: readonly Friend[] = [
  { x: 46, y: 182, b: 88, back: false, look: look({ color: "#ff9eb0", shape: "bean", cheek: "heart", acc: "ribbon" }), feelings: ["반가워요", "신나요", "궁금해요"] },
  { x: 104, y: 153, b: 70, back: true, look: look({ color: "#7fb5f0", shape: "cloud", eyes: "big", pattern: "stars", limbs: "wings" }), feelings: ["설레요", "편안해요", "신기해요"] },
  { x: 160, y: 186, b: 100, back: false, look: look({ color: "#f6c445", acc: "sprout" }), feelings: ["기뻐요", "고마워요", "뿌듯해요"] },
  { x: 216, y: 153, b: 70, back: true, look: look({ color: "#7cc88f", shape: "mochi", eyes: "dot", cheek: "freckle", pattern: "belly", limbs: "both", acc: "headphones" }), feelings: ["느긋해요", "즐거워요", "기대돼요"] },
  { x: 274, y: 182, b: 88, back: false, look: look({ color: "#b79cf0", shape: "egg", eyes: "lash", cheek: "swirl", pattern: "spots", limbs: "tail", acc: "beret" }), feelings: ["행복해요", "든든해요", "차분해요"] },
];

// t초에 i번째 친구: 지금 마음과 인사 진행(인사 중이 아니면 null)
export function friendAt(i: number, t: number): { feeling: string; cheer: number | null } {
  const f = FRIENDS[i];
  const local = t - FIRST_WAVE - i * WAVE_GAP;
  if (local < 0) return { feeling: f.feelings[0], cheer: null };
  const n = Math.floor(local / WAVE_EVERY);
  const ph = local - n * WAVE_EVERY;
  return { feeling: f.feelings[(n + (ph >= SWAP ? 1 : 0)) % f.feelings.length], cheer: ph < CHEER ? ph : null };
}
