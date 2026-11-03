// 마음 친구 표정·몸짓: 감정 12가지마다 눈·눈썹·입·볼·효과·몸짓을 따로 정하고, 시간(t초)에 따라 자세를 계산한다.
// 손그림 애니메이션처럼 1초에 12장(「투스」)으로만 바뀌게 그리는 쪽에서 t를 끊어 준다.
import { NUANCE, breathOf, groupOf, type Group } from "@/lib/shared";

export type EyeKind =
  | "open" | "star" | "half" | "sleepy" | "worried" | "wide" | "sad" | "teary" | "down" | "angry" | "frustrated" // 뜬 눈
  | "happy" | "relax" | "closed" | "squeeze"; // 감은 눈(선으로)
export type BrowKind = "none" | "up" | "soft" | "worried" | "sad" | "angry" | "frown" | "flat";
export type MouthKind = "smile" | "soft" | "grin" | "laugh" | "cat" | "flat" | "side" | "wavy" | "o" | "smallO" | "frown" | "pout" | "teeth" | "yawn";
export type Fx =
  | "sparkle" | "stars" | "notes" | "hearts" | "petals" | "dots" | "zzz" | "sweat" | "shiver" | "gloom" | "tears"
  | "tear" | "cloud" | "puff" | "steam" | "vein" | "bang";
export type Motion = "bounce" | "dance" | "sway" | "float" | "idle" | "droop" | "sleepy" | "fidget" | "tremble" | "slump" | "stomp" | "shake";
export type Arms = "rest" | "wave" | "up" | "hug" | "down" | "fists" | "cover" | "wipe" | "open";
export type Tint = "warm" | "cool" | "pale" | "hot" | null;

export interface Expr {
  eye: EyeKind; brow: BrowKind; mouth: MouthKind; blush: number; fx: Fx[]; motion: Motion; arms: Arms; tint: Tint;
  look?: [number, number]; // 시선(-1~1)
}

const E = (eye: EyeKind, brow: BrowKind, mouth: MouthKind, blush: number, fx: Fx[], motion: Motion, arms: Arms, tint: Tint = null, look?: [number, number]): Expr =>
  ({ eye, brow, mouth, blush, fx, motion, arms, tint, look });

// 감정 이름(큰 감정 12가지) → 표정
export const EXPR: Record<string, Expr> = {
  기뻐요: E("happy", "up", "laugh", 0.9, ["sparkle"], "bounce", "up", "warm"),
  신나요: E("star", "up", "grin", 1, ["stars", "notes"], "dance", "wave", "warm"),
  고마워요: E("relax", "soft", "cat", 1, ["hearts"], "sway", "hug", "warm"),
  편안해요: E("relax", "soft", "soft", 0.45, ["petals"], "float", "rest"),
  "그저 그래요": E("half", "flat", "side", 0, ["dots"], "idle", "rest", null, [0.6, 0]),
  피곤해요: E("sleepy", "flat", "yawn", 0.15, ["zzz"], "sleepy", "down", "cool"),
  걱정돼요: E("worried", "worried", "wavy", 0.1, ["sweat"], "fidget", "fists", "cool"),
  무서워요: E("wide", "worried", "o", 0, ["shiver", "gloom"], "tremble", "cover", "pale"),
  슬퍼요: E("teary", "sad", "frown", 0.2, ["tears"], "droop", "wipe", "cool", [0, 0.4]),
  속상해요: E("down", "sad", "pout", 0.3, ["tear", "cloud"], "slump", "down", "cool", [-0.3, 0.6]),
  억울해요: E("frustrated", "angry", "pout", 0.7, ["bang", "puff"], "stomp", "fists", "hot"),
  화나요: E("angry", "angry", "teeth", 0.6, ["vein", "steam"], "shake", "fists", "hot"),
};
// 감정을 모를 때(첫 화면 등): 반짝 눈으로 두리번거리는 기본 모습
export const NEUTRAL: Expr = E("open", "soft", "smile", 0.4, [], "idle", "rest");

const PARENT: Record<string, string> = Object.fromEntries(Object.entries(NUANCE).flatMap(([p, ws]) => ws.map((w) => [w, p])));
export function exprOf(emotion?: string): Expr {
  if (!emotion) return NEUTRAL;
  return EXPR[emotion] ?? EXPR[PARENT[emotion]] ?? EXPR[{ joy: "기뻐요", calm: "편안해요", sad: "슬퍼요", angry: "화나요", fear: "걱정돼요" }[groupOf(emotion)]];
}
export function moodOf(emotion?: string): Group {
  if (!emotion) return "calm";
  return groupOf(EXPR[emotion] ? emotion : PARENT[emotion] ?? emotion);
}

export interface Pose {
  x: number; y: number; sx: number; sy: number; rot: number; // 몸 위치·찌그러짐·기울기(바닥 가운데 기준)
  armL: number; armR: number; footL: number; footR: number; // 팔 각도(위로 들수록 +), 발 들기
  blink: number; look: [number, number]; mouth: number; // 눈 깜빡임 0~1, 시선, 입 벌림 0~1
  shadow: number; // 바닥 그림자 크기(뜰수록 작게)
  eye?: EyeKind; mouthKind?: MouthKind; brow?: BrowKind; blush?: number; fx?: Fx[]; arms?: Arms; // 인사·숨 고르기 때 바꿔 쓰는 표정
  puff: number; // 숨 고르기·꼭 쥐기 값 0~1
}

export interface PoseIn {
  t: number; // 초(12장/초로 끊긴 값)
  expr: Expr;
  intensity: number; // 1~5
  cheer: number | null; // 인사 시작부터 지난 초(없으면 null)
  hard: boolean; // 힘든 마음이면 인사가 토닥토닥
  breath?: number; // 숨 고르기 시작부터 ms
  squeeze?: number; // 꼭 쥐었다 펴기 시작부터 ms
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => 0.5 - Math.cos(Math.PI * clamp(x)) / 2;
// 한 번 뛰기(0~1): 웅크림 → 늘어나며 뜸 → 내려와 찌그러짐 → 제자리
function hop(p: number, h: number) {
  if (p < 0.16) { const k = ease(p / 0.16); return { y: 0, sx: 1 + 0.1 * k, sy: 1 - 0.13 * k }; }
  if (p < 0.66) {
    const q = (p - 0.16) / 0.5;
    const up = Math.sin(q * Math.PI);
    const st = q < 0.5 ? 1 - q * 2 : 0; // 떠오를 때만 길쭉
    return { y: -h * up, sx: 1 - 0.07 * st, sy: 1 + 0.12 * st };
  }
  if (p < 0.8) { const k = Math.sin(((p - 0.66) / 0.14) * Math.PI); return { y: 0, sx: 1 + 0.12 * k, sy: 1 - 0.14 * k }; }
  return { y: 0, sx: 1, sy: 1 };
}
// 눈 깜빡임: 3~5초마다 한두 장
function blinkAt(t: number) {
  const p = (t + 2 + 1.3 * Math.sin(t * 0.31)) % 3.7;
  return p < 0.1 ? 1 : p < 0.17 ? 0.5 : 0;
}

export function pose({ t, expr, intensity, cheer, hard, breath, squeeze }: PoseIn): Pose {
  const k = 0.6 + clamp((intensity - 1) / 4) * 0.8; // 세기 1→0.6, 5→1.4
  const p: Pose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0, armL: 0, armR: 0, footL: 0, footR: 0, blink: blinkAt(t), look: expr.look ?? [0, 0], mouth: 0, shadow: 1, puff: 0 };
  const breathe = 1 + Math.sin(t * 2.1) * 0.018;
  p.sx = 2 - breathe;
  p.sy = breathe;

  switch (expr.motion) {
    case "bounce": {
      const h = hop((t % 1.15) / 1.15, 11 * k);
      Object.assign(p, h);
      p.armL = p.armR = 95 + (h.y < -2 ? 20 : 0) + Math.sin(t * 6) * 10;
      break;
    }
    case "dance": {
      const h = hop((t % 0.75) / 0.75, 8 * k);
      Object.assign(p, h);
      p.rot = Math.sin(t * 4.2) * 8 * k;
      p.x = Math.sin(t * 2.1) * 5;
      p.armR = 120 + Math.sin(t * 11) * 28;
      p.armL = 100 + Math.sin(t * 11 + 2) * 28;
      p.look = [Math.sin(t * 2.1) * 0.5, -0.1];
      break;
    }
    case "sway":
      p.rot = Math.sin(t * 1.5) * 5;
      p.y = -Math.abs(Math.sin(t * 1.5)) * 2;
      p.armL = p.armR = -62 + Math.sin(t * 3) * 4;
      break;
    case "float":
      p.y = -2 - Math.sin(t * 1.1) * 3;
      p.rot = Math.sin(t * 0.7) * 2;
      p.armL = 8 + Math.sin(t * 1.1) * 6;
      p.armR = 8 + Math.sin(t * 1.1 + 0.6) * 6;
      p.shadow = 0.92 + Math.sin(t * 1.1) * 0.05;
      break;
    case "idle": {
      // 두리번: 3초쯤마다 시선이 옮겨 간다
      const n = Math.floor(t / 2.8);
      const spots: [number, number][] = [[0, 0], [0.7, -0.1], [0, 0], [-0.7, 0.05], [0.3, -0.5], [0, 0]];
      const base = expr.look ?? [0, 0];
      const s = spots[n % spots.length];
      p.look = [base[0] * 0.5 + s[0] * 0.8, base[1] + s[1] * 0.8];
      p.rot = p.look[0] * 3;
      p.armL = 10 + Math.sin(t * 1.6) * 5;
      p.armR = 10 + Math.sin(t * 1.6 + 1) * 5;
      break;
    }
    case "droop":
      p.sy *= 0.95;
      p.sx *= 1.04;
      p.y = Math.sin(t * 1.2) * 1.2;
      p.rot = -2;
      p.armL = -18;
      p.armR = -18 + (Math.sin(t * 0.9) > 0.55 ? 150 : 0); // 가끔 눈물을 훔친다
      break;
    case "sleepy": {
      const nod = Math.sin(t * 0.9);
      p.rot = nod * 4;
      p.sy *= 0.95 + Math.max(0, nod) * 0.02;
      p.sx *= 1.04;
      p.armL = p.armR = -20;
      const yawn = (t % 6.5) / 6.5; // 6.5초마다 하품
      p.mouth = yawn > 0.6 && yawn < 0.9 ? Math.sin(((yawn - 0.6) / 0.3) * Math.PI) : 0;
      p.blink = Math.max(p.blink, p.mouth > 0.3 ? 1 : 0, Math.sin(t * 0.7) > 0.8 ? 1 : 0);
      break;
    }
    case "fidget":
      p.x = Math.sin(t * 2.3) * 2 + Math.sin(t * 5.3) * 1;
      p.rot = Math.sin(t * 1.7) * 2;
      p.armL = -40 + Math.sin(t * 7) * 8;
      p.armR = -40 + Math.sin(t * 7 + 1.5) * 8;
      p.look = [Math.sin(t * 1.9) > 0 ? 0.75 : -0.75, 0];
      break;
    case "tremble":
      p.x = Math.sin(t * 41) * 1.6 * k;
      p.sy *= 0.93;
      p.sx *= 1.03;
      p.armL = p.armR = 132 + Math.sin(t * 37) * 3;
      p.look = [Math.sin(t * 13) * 0.25, 0];
      break;
    case "slump": {
      p.rot = -5;
      p.sy *= 0.95;
      p.sx *= 1.04;
      const sigh = (t % 4.2) / 4.2; // 4초마다 한숨
      if (sigh > 0.75) { const s = Math.sin(((sigh - 0.75) / 0.25) * Math.PI); p.sy *= 1 - 0.05 * s; p.sx *= 1 + 0.04 * s; }
      p.armL = p.armR = -22;
      break;
    }
    case "stomp": {
      const s = (t % 1.3) / 1.3;
      const st = s < 0.2 ? Math.sin((s / 0.2) * Math.PI) : 0;
      p.sy *= 1 - 0.06 * st;
      p.sx *= 1.05 + 0.04 * st; // 볼을 부풀린 채
      p.footL = s < 0.2 ? 0 : s < 0.5 ? 5 : 0;
      p.footR = s > 0.55 && s < 0.85 ? 5 : 0;
      p.rot = Math.sin(t * 2.4) * 3;
      p.armL = p.armR = -8 + st * -10;
      break;
    }
    case "shake": {
      p.x = Math.sin(t * 27) * 2.2 * k;
      const puffUp = (t % 2.6) / 2.6;
      const s = puffUp > 0.8 ? Math.sin(((puffUp - 0.8) / 0.2) * Math.PI) : 0;
      p.sx *= 1.03 + 0.06 * s;
      p.sy *= 1.02 + 0.03 * s;
      p.armL = p.armR = 4 + Math.sin(t * 27) * 4;
      break;
    }
  }

  // 인사(저장했을 때): 폴짝 두 번 + 손 흔들기, 힘든 마음은 끄덕끄덕 + 가슴 토닥
  if (cheer !== null && cheer < 1.8 && breath === undefined && squeeze === undefined) {
    if (hard) {
      const q = cheer / 1.8;
      const nod = Math.sin(q * Math.PI * 4) * (1 - q);
      p.y = Math.abs(nod) * 2;
      p.sy = 1 - Math.abs(nod) * 0.05;
      p.sx = 1 + Math.abs(nod) * 0.04;
      p.rot = 0;
      p.x = 0;
      p.look = [0, 0.4];
      p.armR = -70 + Math.abs(Math.sin(cheer * 9)) * 18; // 토닥토닥
      p.armL = -20;
      p.eye = "relax";
      p.mouthKind = "soft";
      p.brow = "soft";
      p.blush = 0.6;
      p.fx = ["hearts"];
    } else {
      const h = hop((cheer % 0.9) / 0.9, cheer < 0.9 ? 22 : 14);
      Object.assign(p, h);
      p.x = 0;
      p.rot = 0;
      p.armR = 125 + Math.sin(cheer * 15) * 28; // 손 흔들기
      p.armL = 60;
      p.look = [0, -0.2];
      p.eye = "happy";
      p.mouthKind = "laugh";
      p.brow = "up";
      p.blush = 1;
      p.fx = ["sparkle", "stars"];
    }
  }

  // 숨 고르기: 들이쉬며 부풀고 내쉬며 줄어듦(눈 감고, 내쉴 때 「후~」)
  if (breath !== undefined) {
    const b = breathOf(breath);
    const rising = breathOf(breath + 120) >= b;
    p.puff = b;
    p.x = 0; p.rot = 0;
    p.sx = 1 + 0.2 * b;
    p.sy = 1 + 0.22 * b;
    p.y = -2 * b;
    p.armL = p.armR = 10 + 55 * b;
    p.eye = "relax";
    p.brow = "soft";
    p.mouthKind = rising ? "soft" : "smallO";
    p.blush = 0.35;
    p.fx = rising ? [] : ["puff"];
    p.look = [0, -0.2 * b];
  }
  // 꼭 쥐었다 펴기: 꼭 쥐면 움츠리고 부르르, 펴면 「휴~」 풀림
  if (squeeze !== undefined) {
    const s = breathOf(squeeze);
    const tight = s > 0.35;
    p.puff = s;
    p.x = s > 0.6 ? Math.sin(t * 45) * 1.2 : 0;
    p.rot = 0;
    p.sx = 1 - 0.1 * s;
    p.sy = 1 - 0.17 * s;
    p.armL = p.armR = 30 - 85 * s;
    p.eye = tight ? "squeeze" : "relax";
    p.brow = tight ? "angry" : "soft";
    p.mouthKind = tight ? "teeth" : "soft";
    p.blush = tight ? 0.8 : 0.4;
    p.fx = tight ? ["shiver"] : breathOf(squeeze + 120) < s ? ["puff"] : [];
    p.arms = tight ? "fists" : "rest";
  }
  p.shadow *= clamp(1 + p.y / 40, 0.5, 1.05);
  return p;
}

