// 화면과 서버가 함께 쓰는 감정·까닭·자료 모양
import type { VoiceFeatures } from "./tone.ts";

export type Group = "joy" | "calm" | "sad" | "angry" | "fear";
export type Slot = "am" | "pm";

export const EMOTIONS = [
  { name: "기뻐요", emoji: "😄", group: "joy" },
  { name: "신나요", emoji: "🤩", group: "joy" },
  { name: "고마워요", emoji: "🥰", group: "joy" },
  { name: "편안해요", emoji: "😌", group: "calm" },
  { name: "그저 그래요", emoji: "😐", group: "calm" },
  { name: "피곤해요", emoji: "😪", group: "sad" },
  { name: "걱정돼요", emoji: "😟", group: "fear" },
  { name: "무서워요", emoji: "😨", group: "fear" },
  { name: "슬퍼요", emoji: "😢", group: "sad" },
  { name: "속상해요", emoji: "😞", group: "sad" },
  { name: "억울해요", emoji: "😤", group: "angry" },
  { name: "화나요", emoji: "😠", group: "angry" },
] as const satisfies readonly { name: string; emoji: string; group: Group }[];

export type EmotionName = (typeof EMOTIONS)[number]["name"];
export const EMOTION_NAMES = EMOTIONS.map((e) => e.name) as string[];

export const REASONS = [
  { name: "친구", emoji: "👫" },
  { name: "공부", emoji: "📚" },
  { name: "집", emoji: "🏠" },
  { name: "몸", emoji: "🤒" },
  { name: "그냥", emoji: "🤷" },
] as const;
export const REASON_NAMES = REASONS.map((r) => r.name) as string[];

export const GROUPS: Record<Group, { label: string; color: string }> = {
  joy: { label: "기쁨", color: "#F2B705" },
  calm: { label: "평온", color: "#5FB672" },
  sad: { label: "슬픔", color: "#4F8FE0" },
  angry: { label: "화남", color: "#E25A52" },
  fear: { label: "불안", color: "#9B6BD3" },
};

export const INTENSITY = ["조금", "살짝", "보통", "많이", "아주 많이"];

// 감정 단어 키우기: 큰 감정을 고르면 더 꼭 맞는 말 세 개를 보여 준다(3학년 눈높이)
export const NUANCE: Record<string, string[]> = {
  기뻐요: ["뿌듯해요", "즐거워요", "행복해요"],
  신나요: ["설레요", "들떠요", "짜릿해요"],
  고마워요: ["감동했어요", "든든해요", "따뜻해요"],
  편안해요: ["후련해요", "느긋해요", "홀가분해요"],
  "그저 그래요": ["심심해요", "멍해요", "무덤덤해요"],
  피곤해요: ["지쳤어요", "졸려요", "기운 없어요"],
  걱정돼요: ["불안해요", "긴장돼요", "조마조마해요"],
  무서워요: ["겁나요", "깜짝 놀랐어요", "오싹해요"],
  슬퍼요: ["서운해요", "외로워요", "그리워요"],
  속상해요: ["실망했어요", "아쉬워요", "창피해요"],
  억울해요: ["답답해요", "분해요", "서러워요"],
  화나요: ["짜증 나요", "약 올라요", "부글부글해요"],
};
export const NUANCE_WORDS = Object.values(NUANCE).flat();

export const DEFAULT_VOCAB = ["뿌듯해요", "서운해요", "후련해요", "설레요"];
export const DEFAULT_RISK_WORDS = [
  "죽고 싶", "죽을래", "죽어버", "사라지고 싶", "없어지고 싶", "자해",
  "때렸", "때려", "맞고 있", "괴롭혀", "괴롭힘", "왕따", "집에 가기 싫", "다치게 하",
];

export function emotionOf(name: string) {
  return EMOTIONS.find((e) => e.name === name);
}
export function groupOf(name: string): Group {
  return emotionOf(name)?.group ?? "calm";
}
export function isHard(name: string) {
  const g = groupOf(name);
  return g === "sad" || g === "angry" || g === "fear";
}

export interface Student {
  no: number;
  alias: string;
  code: string;
}

export interface MoodRecord {
  id: string; // `${no}_${date}_${slot}` — 같은 시점에 다시 기록하면 덮어씀
  no: number;
  date: string; // YYYY-MM-DD (한국 시간)
  slot: Slot;
  method: "card" | "voice";
  emotion: string;
  intensity: number;
  reason: string;
  summary: string;
  question: string;
  answer: string;
  risk: boolean;
  riskHits: string[];
  riskChecked: string | null;
  createdAt: string;
  tone?: string | null; // 말투(목소리 기운) — 말하기로 남긴 기록만, 교사만 봄
  toneWhy?: string;
  voice?: VoiceFeatures | null; // 평소 목소리와 비교하려고 숫자만 남김(녹음은 남기지 않음)
  updatedAt?: number; // 마지막으로 바뀐 시각(ms) — 교사 화면이 바뀐 것만 다시 읽게
  demo?: boolean; // 시연(연습)용 가짜 기록
  word?: string; // 감정 단어 키우기에서 고른 더 꼭 맞는 말(NUANCE 중 하나)
  lang?: string; // 학생 화면 언어(ko·en·zh·vi·ja)
  summaryKo?: string; // 한국어가 아닌 말이면 선생님이 읽을 한국어 정리
  toneBy?: "device" | "gemini" | null;
  calm?: CalmUse[]; // 마음 다스리기 도구를 써 본 뒤 학생이 고른 느낌
}

// 마음 다스리기 도구 상자: 숨 고르기 · 꼭 쥐었다 펴기 · 5-4-3-2-1 찾기 · 마음 그리기
export const CALM_TOOLS = ["breathe", "squeeze", "senses", "draw"] as const;
export const FELT = ["better", "same", "unsure"] as const;
export type CalmTool = (typeof CALM_TOOLS)[number];
export type Felt = (typeof FELT)[number];
export interface CalmUse { tool: CalmTool; felt: Felt; at: string }
export const CALM_KO: Record<CalmTool, string> = { breathe: "숨 고르기", squeeze: "꼭 쥐었다 펴기", senses: "5-4-3-2-1 찾기", draw: "마음 그리기" };
export const FELT_KO: Record<Felt, string> = { better: "조금 나아졌어요", same: "그대로예요", unsure: "잘 모르겠어요" };

export interface Cheer {
  id: string;
  no: number;
  text: string;
  createdAt: string;
}

// 면담 메모: 교사만 보고 AI에는 보내지 않는다
export type Note = Cheer;

// 말투: 기기 분석은 앞의 셋, Gemini는 넷 중 하나
export const TONES = ["들떠 있음", "차분함", "가라앉음", "떨림"] as const;
export type VoiceMode = "off" | "device" | "gemini";

// 먼저 살펴볼 학생 규칙 숫자(교사가 설정에서 바꿈)
export interface Rules {
  streakDays: number; // 힘든 마음이 기록한 날 n번 이어지면
  dropDays: number; // 아침→하교 전 크게 가라앉은 날이 n번이면
  reasonTimes: number; // 같은 까닭으로 힘든 마음이 n번이면
  absentDays: number; // 반 기록이 있던 최근 n일 동안 기록이 없으면 「기록 없음」
}
export const DEFAULT_RULES: Rules = { streakDays: 3, dropDays: 2, reasonTimes: 3, absentDays: 2 };

export const PROVIDERS = {
  upstage: { label: "업스테이지 Solar", model: "solar-pro4", keyHint: "up_로 시작" },
  claude: { label: "Claude", model: "claude-opus-5-5", keyHint: "sk-ant-로 시작" },
  openai: { label: "ChatGPT", model: "gpt-5.4-mini", keyHint: "sk-로 시작" },
  gemini: { label: "Gemini", model: "gemini-3.6-flash", keyHint: "AI로 시작" },
} as const;
export type Provider = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as Provider[];

// 마음 친구 꾸미기: 몸 색(빈 값이면 감정 색을 따라감) · 모양 · 눈 · 볼 · 무늬 · 팔다리 · 꾸미개 · 이름(학생 화면에만 보임)
export const BUDDY_COLORS = ["", "#f6c445", "#ff9eb0", "#ffa45c", "#7cc88f", "#5cc8c0", "#7fb5f0", "#b79cf0", "#c9b8a6"] as const;
export const BUDDY_SHAPES = ["round", "squish", "bean"] as const;
export const BUDDY_EYES = ["dot", "sparkle", "big"] as const;
export const BUDDY_CHEEKS = ["none", "blush", "freckle"] as const;
export const BUDDY_PATTERNS = ["none", "spots", "belly"] as const;
export const BUDDY_LIMBS = ["none", "arms", "both"] as const;
export const BUDDY_ACCS = ["none", "sprout", "ribbon", "party", "crown", "glasses", "cat", "bunny", "flower", "headphones"] as const;
export type BuddyShape = (typeof BUDDY_SHAPES)[number];
export type BuddyEyes = (typeof BUDDY_EYES)[number];
export type BuddyCheek = (typeof BUDDY_CHEEKS)[number];
export type BuddyPattern = (typeof BUDDY_PATTERNS)[number];
export type BuddyLimbs = (typeof BUDDY_LIMBS)[number];
export type BuddyAcc = (typeof BUDDY_ACCS)[number];
export interface BuddyLook {
  color: string; shape: BuddyShape; eyes: BuddyEyes; cheek: BuddyCheek; pattern: BuddyPattern; limbs: BuddyLimbs; acc: BuddyAcc; name: string;
}
// 꾸미지 않은 친구도 밋밋하지 않게: 반짝 눈 · 발그레 볼 · 작은 팔
export const DEFAULT_LOOK: BuddyLook = { color: "", shape: "round", eyes: "sparkle", cheek: "blush", pattern: "none", limbs: "arms", acc: "none", name: "" };
const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
// 예전에 저장한 모습에 없는 항목은 기본값으로 채운다
export function cleanLook(x: unknown): BuddyLook {
  const o = (x ?? {}) as Record<string, unknown>;
  const d = DEFAULT_LOOK;
  return {
    color: oneOf(BUDDY_COLORS, o.color, d.color),
    shape: oneOf(BUDDY_SHAPES, o.shape, d.shape),
    eyes: oneOf(BUDDY_EYES, o.eyes, d.eyes),
    cheek: oneOf(BUDDY_CHEEKS, o.cheek, d.cheek),
    pattern: oneOf(BUDDY_PATTERNS, o.pattern, d.pattern),
    limbs: oneOf(BUDDY_LIMBS, o.limbs, d.limbs),
    acc: oneOf(BUDDY_ACCS, o.acc, d.acc),
    name: String(o.name ?? "").replace(/[<>{}]/g, "").trim().slice(0, 8),
  };
}
// 몸 색을 흰색 쪽으로 섞기(무늬·배)
export function lighten(hex: string, k = 0.5) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * k);
  return `#${[16, 8, 0].map((x) => ch(x).toString(16).padStart(2, "0")).join("")}`;
}

// 숨 고르기: 4초 들이쉬고 4초 내쉬기. 화면 글자와 3D 친구가 같은 값을 쓴다.
export const BREATH_MS = 8000;
export function breathOf(ms: number) {
  const p = (ms % BREATH_MS) / BREATH_MS;
  const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;
  return p < 0.5 ? ease(p * 2) : 1 - ease((p - 0.5) * 2); // 0(내쉼) ~ 1(들이쉼)
}

// 공감 쪽지: 친구에게 쓰고, 선생님이 읽고 허락한 것만 친구에게 간다(선생님은 언제나 보낸 사람을 안다)
export interface Letter {
  id: string; from: number; to: number; text: string; showName: boolean;
  status: "wait" | "ok" | "no"; createdAt: string; checkedAt?: string; readAt?: string;
  risk?: boolean; lang?: string; demo?: boolean;
}

// 한 주 돌아보기: 학생이 이번 주(월요일부터)를 돌아보며 쓴 한 줄과 마음 친구의 답
export interface Reflect {
  id: string; no: number; weekStart: string; text: string; reply: string; createdAt: string;
  lang?: string; risk?: boolean; demo?: boolean;
}

// 마음 친구 성장: 서로 다른 감정 단어를 몇 개 써 봤는지에 따라 꾸미개가 열린다(기록 횟수가 아니라 새 단어로)
export const ACC_UNLOCK: Record<BuddyAcc, number> = {
  none: 0, sprout: 0, ribbon: 0, glasses: 1, flower: 2, cat: 3, party: 4, bunny: 5, headphones: 6, crown: 8,
};
