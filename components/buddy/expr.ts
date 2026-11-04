// 마음 친구 표정·몸짓: 큰 감정 12가지와 「더 꼭 맞는 말」 36가지, 모두 48가지 표정이 저마다 눈·눈썹·입·볼·효과·몸짓·팔을 가진다.
// 시간(t초)에 따라 자세를 계산한다. 1초에 24장으로 바뀌게 그리는 쪽에서 t를 끊어 준다(선 떨림은 1초 8번).
import { breathOf, groupOf, parentEmotion, type Group } from "../../lib/shared.ts";

export type EyeKind =
  | "open" | "star" | "half" | "sleepy" | "worried" | "wide" | "sad" | "teary" | "down" | "angry" | "frustrated" // 뜬 눈
  | "smiling" | "heart" | "blank" | "pop" | "moved" // 웃는 뜬 눈·하트 눈·멍한 눈·튀어나온 눈·감동한 눈
  | "happy" | "relax" | "closed" | "squeeze" | "flat"; // 감은 눈·선 눈
export type BrowKind = "none" | "up" | "soft" | "worried" | "sad" | "angry" | "frown" | "flat";
export type MouthKind =
  | "smile" | "soft" | "grin" | "laugh" | "cat" | "flat" | "side" | "wavy" | "o" | "smallO" | "frown" | "pout" | "teeth" | "yawn"
  | "pant" | "nervous" | "wail" | "quiver";
export type Fx =
  | "sparkle" | "stars" | "notes" | "hearts" | "petals" | "dots" | "zzz" | "sweat" | "shiver" | "gloom" | "tears"
  | "tear" | "cloud" | "puff" | "steam" | "vein" | "bang"
  | "medal" | "flowers" | "heartbeat" | "speed" | "zap" | "glowRing" | "warmth" | "bubbles" | "daze" | "sleepBubble"
  | "battery" | "questions" | "tangle" | "exclaim" | "chill" | "leaf" | "thought" | "earSteam" | "boilUp";
export type Motion =
  | "bounce" | "dance" | "sway" | "float" | "idle" | "droop" | "sleepy" | "fidget" | "tremble" | "slump" | "stomp" | "shake"
  | "proud" | "skip" | "drift" | "rock" | "still" | "lazy" | "melt" | "stiff" | "cower" | "startle" | "sob" | "puffUp" | "shy";
export type Arms = "rest" | "wave" | "up" | "hug" | "down" | "fists" | "cover" | "wipe" | "open" | "fidget" | "clasp" | "hips" | "crossed" | "reach";
export type Tint = "warm" | "cool" | "pale" | "hot" | "blush" | null;

export interface Expr {
  eye: EyeKind; brow: BrowKind; mouth: MouthKind; blush: number; fx: Fx[]; motion: Motion; arms: Arms; tint: Tint;
  look?: [number, number]; // 시선(-1~1)
}

const E = (eye: EyeKind, brow: BrowKind, mouth: MouthKind, blush: number, fx: Fx[], motion: Motion, arms: Arms, tint: Tint = null, look?: [number, number]): Expr =>
  ({ eye, brow, mouth, blush, fx, motion, arms, tint, look });

// 감정 이름 → 표정. 큰 감정 12가지 + 더 꼭 맞는 말 36가지 + 카드에 더한 낱말 24가지(lib/shared의 NUANCE·MORE_WORDS)
export const EXPR: Record<string, Expr> = {
  기뻐요: E("happy", "up", "laugh", 0.9, ["sparkle"], "bounce", "up", "warm"),
  뿌듯해요: E("relax", "up", "smile", 0.7, ["sparkle", "medal"], "proud", "hips", "warm", [0, -0.6]),
  즐거워요: E("smiling", "up", "laugh", 0.8, ["notes"], "skip", "wave", "warm"),
  행복해요: E("happy", "soft", "cat", 1, ["flowers", "sparkle"], "float", "open", "warm"),

  신나요: E("star", "up", "grin", 1, ["stars", "notes"], "dance", "wave", "warm"),
  설레요: E("heart", "up", "smallO", 1, ["heartbeat", "hearts"], "sway", "clasp", "warm"),
  들떠요: E("star", "up", "grin", 0.9, ["stars", "speed"], "dance", "up", "warm"),
  짜릿해요: E("star", "up", "laugh", 0.8, ["zap", "sparkle"], "startle", "up", "warm"),

  고마워요: E("relax", "soft", "cat", 1, ["hearts"], "sway", "hug", "warm"),
  감동했어요: E("moved", "worried", "quiver", 1, ["tears", "hearts"], "sway", "clasp", "warm"),
  든든해요: E("smiling", "soft", "smile", 0.5, ["glowRing"], "proud", "hips", "warm"),
  따뜻해요: E("relax", "soft", "soft", 0.9, ["warmth"], "sway", "hug", "warm"),

  편안해요: E("relax", "soft", "soft", 0.45, ["petals"], "float", "rest"),
  후련해요: E("closed", "soft", "smallO", 0.4, ["puff", "sparkle"], "float", "open"),
  느긋해요: E("half", "flat", "soft", 0.3, ["petals"], "lazy", "rest", null, [0.3, -0.2]),
  홀가분해요: E("happy", "up", "smile", 0.6, ["bubbles"], "drift", "open"),

  "그저 그래요": E("half", "flat", "side", 0, ["dots"], "idle", "rest", null, [0.6, 0]),
  심심해요: E("half", "flat", "pout", 0, ["dots"], "rock", "down", null, [-0.8, 0]),
  멍해요: E("blank", "none", "smallO", 0, ["daze"], "still", "rest", null, [0, -0.3]),
  무덤덤해요: E("flat", "none", "flat", 0, [], "still", "rest"),

  피곤해요: E("sleepy", "flat", "yawn", 0.15, ["zzz"], "sleepy", "down", "cool"),
  지쳤어요: E("sleepy", "sad", "pant", 0.2, ["sweat", "puff"], "melt", "down", "cool"),
  졸려요: E("closed", "flat", "smallO", 0.3, ["zzz", "sleepBubble"], "sleepy", "down", "cool"),
  "기운 없어요": E("half", "sad", "wavy", 0, ["battery"], "melt", "down", "cool"),

  걱정돼요: E("worried", "worried", "wavy", 0.1, ["sweat"], "fidget", "fidget", "cool"),
  불안해요: E("worried", "worried", "wavy", 0.1, ["questions", "sweat"], "fidget", "fidget", "cool"),
  긴장돼요: E("wide", "worried", "nervous", 0.2, ["sweat", "shiver"], "stiff", "down", "pale"),
  조마조마해요: E("worried", "worried", "o", 0.2, ["heartbeat"], "tremble", "cover", "cool", [0, -0.4]),

  무서워요: E("wide", "worried", "o", 0, ["shiver", "gloom"], "tremble", "cover", "pale"),
  겁나요: E("teary", "worried", "wavy", 0, ["shiver", "sweat"], "cower", "cover", "pale"),
  "깜짝 놀랐어요": E("pop", "up", "o", 0, ["exclaim"], "startle", "up"),
  오싹해요: E("wide", "worried", "wavy", 0, ["chill", "gloom"], "tremble", "hug", "pale", [0.6, 0]),

  슬퍼요: E("teary", "sad", "frown", 0.2, ["tears"], "droop", "wipe", "cool", [0, 0.4]),
  서운해요: E("down", "sad", "pout", 0.3, ["tear"], "slump", "down", "cool", [-0.6, 0.3]),
  외로워요: E("sad", "sad", "frown", 0, ["leaf"], "droop", "hug", "cool", [0, 0.3]),
  그리워요: E("sad", "worried", "soft", 0.3, ["thought"], "sway", "hug", "cool", [0.5, -0.7]),

  속상해요: E("down", "sad", "pout", 0.3, ["tear", "cloud"], "slump", "down", "cool", [-0.3, 0.6]),
  실망했어요: E("down", "sad", "frown", 0, ["gloom", "puff"], "slump", "down", "cool"),
  아쉬워요: E("sad", "worried", "side", 0.2, ["dots"], "slump", "reach", "cool", [0.7, 0]),
  창피해요: E("squeeze", "worried", "wavy", 1.3, ["sweat", "steam"], "shy", "clasp", "blush", [0, 0.4]),

  억울해요: E("frustrated", "angry", "pout", 0.7, ["bang", "puff"], "stomp", "fists", "hot"),
  답답해요: E("frustrated", "angry", "pout", 0.4, ["tangle"], "stomp", "fists", "hot"),
  분해요: E("frustrated", "angry", "teeth", 0.5, ["vein", "tear"], "shake", "fists", "hot"),
  서러워요: E("teary", "sad", "wail", 0.5, ["tears"], "sob", "wipe", "cool"),

  화나요: E("angry", "angry", "teeth", 0.6, ["vein", "steam"], "shake", "fists", "hot"),
  "짜증 나요": E("half", "angry", "side", 0.3, ["vein", "puff"], "stomp", "crossed", "hot"),
  "약 올라요": E("angry", "angry", "pout", 0.7, ["earSteam"], "puffUp", "fists", "hot"),
  부글부글해요: E("angry", "angry", "teeth", 0.5, ["boilUp", "steam"], "shake", "fists", "hot"),

  // 마음 남기기 카드에 더한 낱말 24가지 — 긍정
  흐뭇해요: E("relax", "soft", "smile", 0.8, ["warmth", "sparkle"], "sway", "clasp", "warm"),
  "자신 있어요": E("smiling", "up", "grin", 0.5, ["sparkle", "glowRing"], "proud", "hips", "warm", [0.2, -0.5]),
  반가워요: E("happy", "up", "laugh", 0.7, ["hearts", "notes"], "bounce", "wave", "warm"),
  신기해요: E("star", "up", "o", 0.4, ["sparkle", "exclaim"], "startle", "open", "warm", [0, -0.4]),
  기대돼요: E("smiling", "up", "grin", 0.7, ["heartbeat", "stars"], "skip", "clasp", "warm"),
  다행이에요: E("relax", "worried", "smile", 0.3, ["sweat", "puff"], "melt", "rest"),
  포근해요: E("closed", "soft", "cat", 0.6, ["warmth", "petals"], "sway", "hug", "warm"),
  개운해요: E("smiling", "up", "grin", 0.3, ["sparkle", "bubbles"], "bounce", "up"),
  // 보통
  궁금해요: E("open", "up", "smallO", 0, ["questions"], "idle", "reach", null, [0.7, -0.3]),
  헷갈려요: E("worried", "frown", "wavy", 0, ["tangle", "questions"], "rock", "fidget"),
  어색해요: E("half", "worried", "side", 0.4, ["sweat"], "stiff", "fidget", null, [-0.6, 0]),
  지루해요: E("half", "flat", "flat", 0, ["dots"], "lazy", "rest", null, [0.5, -0.4]),
  차분해요: E("relax", "flat", "soft", 0.2, [], "float", "clasp"),
  "생각이 많아요": E("open", "frown", "side", 0, ["thought"], "idle", "reach", null, [0.5, -0.6]),
  괜찮아요: E("smiling", "soft", "soft", 0.3, [], "idle", "wave"),
  평범해요: E("open", "none", "flat", 0.1, [], "idle", "rest"),
  낯설어요: E("wide", "worried", "smallO", 0, ["sweat"], "cower", "clasp", null, [-0.5, 0]),
  집중돼요: E("flat", "frown", "flat", 0, ["speed"], "still", "clasp", null, [0, 0.3]),
  귀찮아요: E("half", "flat", "pout", 0, ["puff"], "slump", "down", null, [-0.4, 0.2]),
  바빠요: E("open", "worried", "pant", 0.2, ["sweat", "speed"], "fidget", "up"),
  정신없어요: E("blank", "worried", "wavy", 0, ["daze", "tangle"], "fidget", "cover"),
  "조용히 있고 싶어요": E("closed", "soft", "flat", 0, ["dots"], "still", "hug"),
  나른해요: E("sleepy", "flat", "soft", 0.2, ["sleepBubble"], "melt", "rest"),
  "쉬고 싶어요": E("half", "sad", "flat", 0, ["battery"], "slump", "down"),
};
// 감정을 모를 때(첫 화면 등): 반짝 눈으로 두리번거리는 기본 모습
export const NEUTRAL: Expr = E("open", "soft", "smile", 0.4, [], "idle", "rest");

// 낱말 → 큰 감정(큰 감정이면 그대로)
export const parentOf = parentEmotion;
export function exprOf(emotion?: string): Expr {
  if (!emotion) return NEUTRAL;
  return EXPR[emotion] ?? EXPR[parentOf(emotion)] ?? EXPR[{ joy: "기뻐요", calm: "편안해요", sad: "슬퍼요", angry: "화나요", fear: "걱정돼요" }[groupOf(emotion)]];
}
export function moodOf(emotion?: string): Group {
  if (!emotion) return "calm";
  return groupOf(parentOf(emotion));
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
  t: number; // 초(24장/초로 끊긴 값)
  expr: Expr;
  intensity: number; // 1~5
  cheer: number | null; // 인사 시작부터 지난 초(없으면 null)
  hard: boolean; // 힘든 마음이면 인사가 토닥토닥
  breath?: number; // 숨 고르기 시작부터 ms
  squeeze?: number; // 꼭 쥐었다 펴기 시작부터 ms
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => 0.5 - Math.cos(Math.PI * clamp(x)) / 2;
const sin = Math.sin;
// 한 번 뛰기(0~1): 웅크림 → 늘어나며 뜸 → 내려와 찌그러짐 → 제자리
function hop(p: number, h: number) {
  if (p < 0.16) { const k = ease(p / 0.16); return { y: 0, sx: 1 + 0.1 * k, sy: 1 - 0.13 * k }; }
  if (p < 0.66) {
    const q = (p - 0.16) / 0.5;
    const up = sin(q * Math.PI);
    const st = q < 0.5 ? 1 - q * 2 : 0; // 떠오를 때만 길쭉
    return { y: -h * up, sx: 1 - 0.07 * st, sy: 1 + 0.12 * st };
  }
  if (p < 0.8) { const k = sin(((p - 0.66) / 0.14) * Math.PI); return { y: 0, sx: 1 + 0.12 * k, sy: 1 - 0.14 * k }; }
  return { y: 0, sx: 1, sy: 1 };
}
// 눈 깜빡임: 3~5초마다 한두 장
function blinkAt(t: number) {
  const p = (t + 2 + 1.3 * sin(t * 0.31)) % 3.7;
  return p < 0.1 ? 1 : p < 0.17 ? 0.5 : 0;
}

// 팔 자세(왼팔, 오른팔). 0이면 바깥 아래로 늘어뜨림, +면 위로, -면 몸 앞쪽으로.
export function armsOf(arms: Arms, t: number): [number, number] {
  switch (arms) {
    case "rest": return [8 + sin(t * 1.6) * 5, 8 + sin(t * 1.6 + 1) * 5];
    case "wave": return [60 + sin(t * 6) * 8, 125 + sin(t * 12) * 28];
    case "up": return [108 + sin(t * 6) * 12, 108 + sin(t * 6 + 1) * 12];
    case "open": return [62 + sin(t * 1.5) * 6, 62 + sin(t * 1.5 + 0.5) * 6];
    case "hug": return [-62 + sin(t * 3) * 4, -62 + sin(t * 3 + 1) * 4];
    case "clasp": return [-158 + sin(t * 5) * 3, -158 + sin(t * 5 + 0.6) * 3]; // 두 손을 볼·턱 앞에
    case "cover": return [132 + sin(t * 37) * 2, 132 + sin(t * 37 + 1) * 2];
    case "down": return [-18, -18];
    case "fists": return [4 + sin(t * 27) * 3, 4 + sin(t * 27 + 1) * 3];
    case "hips": return [-30, -30];
    case "crossed": return [-125, -125];
    case "reach": return [-15, 52 + sin(t * 1.4) * 8];
    case "fidget": return [-78 + sin(t * 7) * 8, -78 + sin(t * 7 + 1.5) * 8];
    case "wipe": return [-18, -18 + (sin(t * 0.9) > 0.55 ? 160 : 0)]; // 가끔 눈물을 훔친다
  }
}

export function pose({ t, expr, intensity, cheer, hard, breath, squeeze }: PoseIn): Pose {
  const k = 0.6 + clamp((intensity - 1) / 4) * 0.8; // 세기 1→0.6, 5→1.4
  const [aL, aR] = armsOf(expr.arms, t);
  const p: Pose = { x: 0, y: 0, sx: 1, sy: 1, rot: 0, armL: aL, armR: aR, footL: 0, footR: 0, blink: blinkAt(t), look: expr.look ?? [0, 0], mouth: 0, shadow: 1, puff: 0 };
  const breathe = 1 + sin(t * 2.1) * 0.018;
  p.sx = 2 - breathe;
  p.sy = breathe;

  switch (expr.motion) {
    case "bounce": {
      const h = hop((t % 1.15) / 1.15, 11 * k);
      Object.assign(p, h);
      if (h.y < -2) { p.armL += 20; p.armR += 20; }
      break;
    }
    case "dance": {
      const h = hop((t % 0.75) / 0.75, 8 * k);
      Object.assign(p, h);
      p.rot = sin(t * 4.2) * 8 * k;
      p.x = sin(t * 2.1) * 5;
      p.look = [sin(t * 2.1) * 0.5, -0.1];
      break;
    }
    case "skip": {
      const h = hop((t % 0.7) / 0.7, 6 * k);
      Object.assign(p, h);
      p.x = sin(t * 4.5) * 6;
      p.rot = sin(t * 4.5) * 5;
      break;
    }
    case "sway":
      p.rot = sin(t * 1.5) * 5;
      p.y = -Math.abs(sin(t * 1.5)) * 2;
      break;
    case "float":
      p.y = -2 - sin(t * 1.1) * 3;
      p.rot = sin(t * 0.7) * 2;
      p.shadow = 0.92 + sin(t * 1.1) * 0.05;
      break;
    case "drift": // 몸이 가벼워 둥실 떠오름
      p.y = -9 - sin(t * 1.2) * 4;
      p.rot = sin(t * 0.8) * 4;
      p.shadow = 0.7;
      break;
    case "proud": // 가슴을 펴고 살짝 으쓱
      p.sy *= 1.03;
      p.y = -Math.abs(sin(t * 1.3)) * 2;
      p.rot = sin(t * 0.9) * 2;
      break;
    case "idle": {
      // 두리번: 3초쯤마다 시선이 옮겨 간다
      const n = Math.floor(t / 2.8);
      const spots: [number, number][] = [[0, 0], [0.7, -0.1], [0, 0], [-0.7, 0.05], [0.3, -0.5], [0, 0]];
      const base = expr.look ?? [0, 0];
      const s = spots[((n % spots.length) + spots.length) % spots.length]; // t가 음수여도 깨지지 않게
      p.look = [base[0] * 0.5 + s[0] * 0.8, base[1] + s[1] * 0.8];
      p.rot = p.look[0] * 3;
      break;
    }
    case "rock": // 심심해서 좌우로 까딱까딱
      p.rot = sin(t * 1.1) * 7;
      break;
    case "still": // 거의 움직이지 않음(숨만)
      p.sx = 1 + (p.sx - 1) * 0.5;
      p.sy = 1 + (p.sy - 1) * 0.5;
      break;
    case "lazy": // 뒤로 기대어 느긋
      p.rot = -6 + sin(t * 0.6) * 2;
      p.sy *= 0.97;
      p.sx *= 1.03;
      break;
    case "droop":
      p.sy *= 0.95;
      p.sx *= 1.04;
      p.y = sin(t * 1.2) * 1.2;
      p.rot = -2;
      break;
    case "melt": // 기운이 빠져 녹아내림
      p.sy = 0.86 + sin(t * 1) * 0.012;
      p.sx = 1.12;
      break;
    case "sleepy": {
      const nod = sin(t * 0.9);
      p.rot = nod * 4;
      p.sy *= 0.95 + Math.max(0, nod) * 0.02;
      p.sx *= 1.04;
      const yawn = (t % 6.5) / 6.5; // 6.5초마다 하품
      p.mouth = yawn > 0.6 && yawn < 0.9 ? sin(((yawn - 0.6) / 0.3) * Math.PI) : 0;
      p.blink = Math.max(p.blink, p.mouth > 0.3 ? 1 : 0, sin(t * 0.7) > 0.8 ? 1 : 0);
      break;
    }
    case "fidget":
      p.x = sin(t * 2.3) * 2 + sin(t * 5.3) * 1;
      p.rot = sin(t * 1.7) * 2;
      p.look = [sin(t * 1.9) > 0 ? 0.75 : -0.75, 0];
      break;
    case "stiff": // 긴장해 꼿꼿, 아주 작게 떨림
      p.sx = 0.96;
      p.sy = 1.04;
      p.x = sin(t * 31) * 0.6;
      break;
    case "tremble":
      p.x = sin(t * 41) * 1.6 * k;
      p.sy *= 0.93;
      p.sx *= 1.03;
      p.look = [(expr.look?.[0] ?? 0) + sin(t * 13) * 0.25, expr.look?.[1] ?? 0];
      break;
    case "cower": // 움츠려 작아짐
      p.sy = 0.86;
      p.sx = 0.97;
      p.x = sin(t * 35) * 1.1;
      break;
    case "startle": { // 2초마다 화들짝 뛰어오름
      const s = (t % 2.2) / 2.2;
      if (s < 0.3) Object.assign(p, hop(s / 0.3, 16 * k));
      else p.x = sin(t * 30) * 0.8;
      break;
    }
    case "slump": {
      p.rot = -5;
      p.sy *= 0.95;
      p.sx *= 1.04;
      const sigh = (t % 4.2) / 4.2; // 4초마다 한숨
      if (sigh > 0.75) { const s = sin(((sigh - 0.75) / 0.25) * Math.PI); p.sy *= 1 - 0.05 * s; p.sx *= 1 + 0.04 * s; }
      break;
    }
    case "sob": { // 어깨를 들썩이며 흐느낌
      const s = Math.abs(sin(t * 5));
      p.sy = 0.96 - 0.04 * s;
      p.sx = 1.03 + 0.03 * s;
      p.y = -s * 1.5;
      break;
    }
    case "shy": // 부끄러워 몸을 배배 꼼
      p.rot = sin(t * 1.8) * 5;
      p.sy *= 0.96;
      p.x = sin(t * 0.9) * 2;
      break;
    case "stomp": {
      const s = (t % 1.3) / 1.3;
      const st = s < 0.2 ? sin((s / 0.2) * Math.PI) : 0;
      p.sy *= 1 - 0.06 * st;
      p.sx *= 1.05 + 0.04 * st; // 볼을 부풀린 채
      p.footL = s < 0.2 ? 0 : s < 0.5 ? 5 : 0;
      p.footR = s > 0.55 && s < 0.85 ? 5 : 0;
      p.rot = sin(t * 2.4) * 3;
      break;
    }
    case "puffUp": { // 약이 올라 볼을 빵빵하게 부풀렸다 푹
      const s = (t % 2) / 2;
      const b = s < 0.7 ? ease(s / 0.7) : 1 - ease((s - 0.7) / 0.3);
      p.sx = 1.04 + 0.1 * b;
      p.sy = 1.02 + 0.05 * b;
      break;
    }
    case "shake": {
      p.x = sin(t * 27) * 2.2 * k;
      const puffUp = (t % 2.6) / 2.6;
      const s = puffUp > 0.8 ? sin(((puffUp - 0.8) / 0.2) * Math.PI) : 0;
      p.sx *= 1.03 + 0.06 * s;
      p.sy *= 1.02 + 0.03 * s;
      break;
    }
  }

  // 인사(저장했을 때): 폴짝 두 번 + 손 흔들기, 힘든 마음은 끄덕이며 가슴 토닥
  if (cheer !== null && cheer < 1.8 && breath === undefined && squeeze === undefined) {
    if (hard) {
      const q = cheer / 1.8;
      const nod = sin(q * Math.PI * 4) * (1 - q);
      p.y = Math.abs(nod) * 2;
      p.sy = 1 - Math.abs(nod) * 0.05;
      p.sx = 1 + Math.abs(nod) * 0.04;
      p.rot = 0;
      p.x = 0;
      p.look = [0, 0.4];
      p.armR = -70 + Math.abs(sin(cheer * 9)) * 18; // 토닥토닥
      p.armL = -20;
      p.eye = "relax";
      p.mouthKind = "soft";
      p.brow = "soft";
      p.blush = 0.6;
      p.fx = ["hearts"];
      p.arms = "rest";
    } else {
      const h = hop((cheer % 0.9) / 0.9, cheer < 0.9 ? 22 : 14);
      Object.assign(p, h);
      p.x = 0;
      p.rot = 0;
      p.armR = 125 + sin(cheer * 15) * 28; // 손 흔들기
      p.armL = 60;
      p.look = [0, -0.2];
      p.eye = "happy";
      p.mouthKind = "laugh";
      p.brow = "up";
      p.blush = 1;
      p.fx = ["sparkle", "stars"];
      p.arms = "wave";
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
    p.arms = "open";
  }
  // 꼭 쥐었다 펴기: 꼭 쥐면 움츠리고 부르르, 펴면 「휴~」 풀림
  if (squeeze !== undefined) {
    const s = breathOf(squeeze);
    const tight = s > 0.35;
    p.puff = s;
    p.x = s > 0.6 ? sin(t * 45) * 1.2 : 0;
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
