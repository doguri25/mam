// 화면과 서버가 함께 쓰는 감정·까닭·자료 모양
import type { VoiceFeatures } from "./tone.ts";

export type Group = "joy" | "calm" | "sad" | "angry" | "fear";
export type Slot = "am" | "pm";

export const EMOTIONS = [
  { name: "기뻐요", group: "joy" },
  { name: "신나요", group: "joy" },
  { name: "고마워요", group: "joy" },
  { name: "편안해요", group: "calm" },
  { name: "그저 그래요", group: "calm" },
  { name: "피곤해요", group: "sad" },
  { name: "걱정돼요", group: "fear" },
  { name: "무서워요", group: "fear" },
  { name: "슬퍼요", group: "sad" },
  { name: "속상해요", group: "sad" },
  { name: "억울해요", group: "angry" },
  { name: "화나요", group: "angry" },
] as const satisfies readonly { name: string; group: Group }[];

export type EmotionName = (typeof EMOTIONS)[number]["name"];
export const EMOTION_NAMES = EMOTIONS.map((e) => e.name) as string[];

export const REASONS = [
  { name: "친구" },
  { name: "공부" },
  { name: "집" },
  { name: "몸" },
  { name: "그냥" },
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

// 마음 남기기 카드에 더한 낱말 24개. 큰 감정 아래로 묶여 기록·선생님 화면·규칙은 큰 감정 12가지 그대로다.
export const MORE_WORDS: Record<string, string[]> = {
  기뻐요: ["흐뭇해요", "자신 있어요", "반가워요"],
  신나요: ["신기해요", "기대돼요"],
  편안해요: ["다행이에요", "포근해요", "개운해요"],
  "그저 그래요": ["궁금해요", "헷갈려요", "어색해요", "지루해요", "차분해요", "생각이 많아요", "괜찮아요", "평범해요", "낯설어요", "집중돼요", "귀찮아요", "바빠요", "정신없어요", "조용히 있고 싶어요"],
  피곤해요: ["나른해요", "쉬고 싶어요"],
};
// 큰 감정 밑의 낱말(더 꼭 맞는 말 + 더한 낱말): 기록의 word로 받을 수 있는 말
export const SUB_WORDS: Record<string, string[]> = Object.fromEntries(Object.keys(NUANCE).map((e) => [e, [...NUANCE[e], ...(MORE_WORDS[e] ?? [])]]));
export const ALL_SUB_WORDS = Object.values(SUB_WORDS).flat();
const PARENT_OF: Record<string, string> = Object.fromEntries(Object.entries(SUB_WORDS).flatMap(([p, ws]) => ws.map((w) => [w, p])));
// 낱말 → 큰 감정(큰 감정이면 그대로)
export const parentEmotion = (word: string) => PARENT_OF[word] ?? word;
export const isWordOf = (emotion: string, word: string) => !!SUB_WORDS[emotion]?.includes(word);

// 카드 뽑기: 긍정·보통·부정을 같은 수만큼 무작위로(고를 때마다 다른 카드). 한 큰 감정에서는 두 장까지만 → 색이 고르게.
export type Polarity = "pos" | "mid" | "neg";
export const POLARITY: Record<string, Polarity> = {
  기뻐요: "pos", 신나요: "pos", 고마워요: "pos", 편안해요: "pos", "그저 그래요": "mid", 피곤해요: "mid",
  걱정돼요: "neg", 무서워요: "neg", 슬퍼요: "neg", 속상해요: "neg", 억울해요: "neg", 화나요: "neg",
};
export const CARD_WORDS: { word: string; parent: string; polarity: Polarity }[] = Object.entries(SUB_WORDS).flatMap(([p, ws]) =>
  [p, ...ws].map((word) => ({ word, parent: p, polarity: POLARITY[p] })),
);
// avoid: 방금 본 카드(다시 뽑을 때 겹치지 않게)
export function drawCards(per = 4, rand = Math.random, avoid: readonly string[] = []): string[] {
  const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const out: string[] = [];
  for (const pol of ["pos", "mid", "neg"] as Polarity[]) {
    const taken = new Map<string, number>();
    const picked: string[] = [];
    for (const c of shuffle(CARD_WORDS.filter((x) => x.polarity === pol && !avoid.includes(x.word)))) {
      if (picked.length >= per) break;
      const n = taken.get(c.parent) ?? 0;
      // 큰 감정이 둘뿐인 「보통」은 낱말이 한쪽에 몰려 있어 한도를 넉넉히
      if (n >= (pol === "mid" ? 3 : 2)) continue;
      taken.set(c.parent, n + 1);
      picked.push(c.word);
    }
    out.push(...picked);
  }
  return shuffle(out);
}

export const DEFAULT_VOCAB = ["뿌듯해요", "서운해요", "후련해요", "설레요"];
export const DEFAULT_RISK_WORDS = [
  "죽고 싶", "죽을래", "죽어버", "사라지고 싶", "없어지고 싶", "자해", "자살", "살기 싫",
  "때렸", "때려", "때리", "맞고 있", "한테 맞", "에게 맞", "괴롭혀", "괴롭힘", "왕따", "집에 가기 싫", "다치게 하", "죽여", "죽일",
  "때린", "때릴", "때림", "괴롭히", "괴롭혔", "다치게 해", "따돌", "집에 가기 시러",
  "죽이고 싶", "죽인다", "집 가기 싫", "집에 들어가기 싫", "집 들어가기 싫", "집에 가고 싶지 않", "집에 안 가고 싶", "집에 가기 실",
  "뒤질래", "디질래", "은따", "떄리", "떄려", "떄렸", "집에 가기 무서", "발로 차", "뺨을 맞", "뺨 맞", "매를 맞", "매 맞", "주먹으로 맞", "주먹으로 쳤",
];
// 예전 기본 목록에 나중에 더한 말(판마다) — 선생님이 목록을 고친 적이 있어도 그 판 뒤에 더한 말만 한 번 더해 준다(riskWordsV).
// add는 더할 말, from은 그 말의 줄기(먼저 있던 말). from이 있으면 선생님 목록에 줄기가 하나라도 남아 있을 때만 더한다:
// 선생님이 「때렸」「때려」「때리」를 지웠다면 「때린」도 넣지 않는다. from이 없는 말은 늘 더한다.
// 새 말을 더할 때는 판을 하나 올리고 DEFAULT_RISK_WORDS에도 넣는다.
export const RISK_WORDS_BY_V: Record<number, { add: string[]; from?: string[] }[]> = {
  2: [
    { add: ["자살", "살기 싫"] },
    { add: ["때리"], from: ["때렸", "때려"] },
    { add: ["한테 맞", "에게 맞", "죽여", "죽일"] },
  ],
  // 두 글자 줄기는 받침을 늘려 찾지 않으므로 꼴마다 넣는다(「때린다」「때릴까」「따돌려요」)
  3: [
    { add: ["때린", "때릴", "때림"], from: ["때리", "때렸", "때려"] },
    { add: ["괴롭히", "괴롭혔"], from: ["괴롭혀", "괴롭힘"] },
    { add: ["다치게 해"], from: ["다치게 하"] },
    { add: ["따돌"] },
    { add: ["집에 가기 시러"], from: ["집에 가기 싫"] },
  ],
  4: [
    { add: ["죽이고 싶", "죽인다"], from: ["죽여", "죽일"] },
    { add: ["집 가기 싫", "집에 들어가기 싫", "집 들어가기 싫", "집에 가고 싶지 않", "집에 안 가고 싶", "집에 가기 실"], from: ["집에 가기 싫", "집에 가기 시러"] },
    { add: ["뒤질래", "디질래"], from: ["죽을래"] },
    { add: ["은따"], from: ["왕따", "따돌"] },
    { add: ["떄리", "떄려", "떄렸"], from: ["때리", "때렸", "때려"] }, // 아이들이 흔히 치는 「떄」
    { add: ["집에 가기 무서", "발로 차", "뺨을 맞", "뺨 맞", "매를 맞", "매 맞", "주먹으로 맞", "주먹으로 쳤"] },
  ],
};
export const RISK_WORDS_V = Math.max(...Object.keys(RISK_WORDS_BY_V).map(Number));
// 판 v에서 저장한 목록(saved)에 더해 줄 말: v보다 뒤 판에 더한 말 가운데 목록에 없고, 줄기가 남아 있는 것(앞 판에서 더한 말도 줄기로 친다).
// saved를 주지 않으면 v 뒤에 더한 말을 모두 돌려준다.
export function riskWordsAfter(v: number, saved?: string[]) {
  const key = (w: string) => String(w).replace(/\s+/g, "");
  const have = new Set((saved ?? []).map(key));
  const out: string[] = [];
  const later = Object.entries(RISK_WORDS_BY_V).filter(([k]) => Number(k) > v).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [, groups] of later) {
    for (const { add, from } of groups) {
      if (saved && from && !from.some((w) => have.has(key(w)))) continue;
      for (const w of add) {
        if (have.has(key(w))) continue;
        have.add(key(w));
        out.push(w);
      }
    }
  }
  return out;
}

// 선생님이 목록에서 지워도 늘 살피는 말: 스스로 해치려는 마음과, 한국어가 아닌 말로 쓴 위험 표현
// (학생 화면은 영어·중국어·베트남어·일본어로도 쓸 수 있다). 아이들이 흔히 쓰는 맞춤법(「죽구 싶」「시퍼」「시러」「실타」)도 넣는다.
// 성조 없이 친 베트남어(「muon chet」)와 가타카나(「シニタイ」), 「dont」「do not」「wanna」, 「被…打」「bị … đánh」는 matchRisk가 알아서 견준다.
export const RISK_CORE = [
  "죽고 싶", "사라지고 싶", "없어지고 싶", "자해", "자살", "살기 싫", "죽어버",
  "죽구 싶", "죽고 시퍼", "죽구 시퍼", "죽고 십", "사라지고 시퍼", "없어지고 시퍼", "살기 시러", "살고 싶지 않", "ㅈㄱㅅㅇ",
  "살고 싶지가 않", "살기 실", "사는 게 싫", "사는 거 싫", "뒤지고 싶", "디지고 싶", "없어졌으면 좋겠", "사라졌으면 좋겠",
  "태어나지 않았으면", "안 태어났으면", "태어나지 말",
  "kill myself", "kill my self", "want to die", "wanna die", "want 2 die", "suicid", "unalive", "hurt myself", "cut myself", "self harm",
  "disappear forever", "want to disappear", "don't want to live",
  "want to be dead", "wish i was dead", "wish i were dead", "hate my life", "end my life", "don't want to be alive",
  "want die", "wish i could disappear", "hate myself", "killmyself", "selfharm", "cut my self", "hurt my self",
  "bully", "bullied", "bullies", "beat me", "hit me", "hits me", "hitting me", "hurt me", "hurting me", "don't want to go home",
  "don't want to go back home",
  "punched me", "punches me", "punching me", "kicked me", "kicks me", "kicking me", "slapped me", "slaps me", "slapping me",
  "pushed me", "pushes me", "pushing me", "choked me", "make fun of me", "makes fun of me", "made fun of me", "making fun of me",
  "想死", "不想活", "活不下去", "自杀", "自殺", "伤害自己", "傷害自己", "被打", "打我", "欺负", "欺負", "霸凌", "不想回家", "想消失",
  "打了我", "去死", "死了算了", "活着没意思", "活着没有意思", "不要回家", "想杀", "恨自己", "恨我自己",
  "muốn chết", "không muốn sống", "tự tử", "tự sát", "tự làm đau", "bắt nạt", "bị đánh", "đánh con", "đánh em", "đánh tôi", "đánh mình",
  "không muốn về nhà", "muốn biến mất", "ghét bản thân",
  "死にたい", "しにたい", "しんじゃいたい", "消えたい", "きえたい", "いなくなりたい", "自殺", "じさつ", "自傷", "いじめ",
  "殴られ", "なぐられ", "叩かれ", "たたかれ", "蹴られ", "をけられ", "にけられ", "に帰りたくない", "にかえりたくない", "なかまはずれ", "仲間外れ",
  "死にたく", "しにたくな", "死んじゃいたい", "しんでしまいたい", "死んでしまいたい", "きえてしまいたい", "消えてしまいたい", "生きていたくない", "いきていたくない",
  "消えてなくなりたい", "きえてなくなりたい",
  "ぶたれ", "ころしたい", "殺したい", "ころしてやる", "殺してやる", "しねって", "死ね",
  "うちかえりたくない", "うち帰りたくない", "いえかえりたくない", "家帰りたくない",
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
  consent?: string; // 보호자 동의서를 받은 날(YYYY-MM-DD). 기록을 막지는 않고 명단에 표시만
  demo?: boolean; // 연습 데이터로 만든 가짜 학생(「연습 데이터만 지우기」로 지운다)
}

// 위험 표현 조치 기록: 「살펴봤어요」를 누를 때와 그 뒤에 선생님이 한 일(선생님만 봄, AI에 보내지 않음)
export const RISK_ACTIONS = ["talk", "parent", "wee", "admin", "watch", "none"] as const;
export type RiskActionKind = (typeof RISK_ACTIONS)[number];
export const RISK_ACTION_KO: Record<RiskActionKind, string> = {
  talk: "학생과 이야기 나눔", parent: "보호자 연락", wee: "Wee클래스·상담교사 연계", admin: "관리자·담당 교사 보고", watch: "계속 지켜보기", none: "걱정할 내용이 아니었음",
};
export interface RiskAction {
  id: string;
  no: number;
  recordId: string; // 어떤 위험 표현 기록에 대한 일인지
  recordDate: string;
  date: string; // 한 날(YYYY-MM-DD)
  kinds: RiskActionKind[];
  note: string; // 짧은 메모(선생님만)
  createdAt: string;
  demo?: boolean;
  // 무엇을 살펴봤나(없으면 마음 기록). recordId 앞머리: 「draft:」 마치지 않은 기록 · 「reflect:」 돌아보기 · 「letter:」 쪽지
  kind?: "record" | "draft" | "reflect" | "letter";
  text?: string; // 살펴볼 때의 글(마치지 않은 기록·돌아보기·쪽지는 나중에 지워지거나 바뀌어도 조치 기록에 남게)
}
export const riskKinds = (x: unknown): RiskActionKind[] =>
  Array.isArray(x) ? RISK_ACTIONS.filter((k) => x.includes(k)) : [];

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
  riskSelf?: boolean; // 이 기록 자체에 위험 표현이 있었나(risk는 다시 남기기 전 기록의 살펴보지 않은 위험까지 이어받음)
  riskAt?: string; // 위험 내용이 마지막으로 바뀐 때(늦게 온 앞 기록·마치지 않은 글이 끼어들 때도) — 「살펴봤어요」 버전 확인에 쓴다(없으면 createdAt)
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
  prev?: PrevVersion[]; // 같은 칸에 다시 남기기 전의 기록(오래된 것부터, 최대 PREV_MAX개) — 선생님만 봄
}

// 같은 칸(아침·하교 전)에 다시 남기면 앞 기록은 지우지 않고 여기에 모아 둔다
export const PREV_MAX = 5;
export interface PrevVersion {
  method: "card" | "voice";
  emotion: string;
  intensity: number;
  reason: string;
  word?: string;
  summary: string;
  summaryKo?: string;
  question: string;
  answer: string;
  risk: boolean;
  riskHits: string[];
  lang?: string;
  createdAt: string;
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
  demo?: boolean; // 연습용 가짜 학생에게 쓴 것(메모도 같은 모양)
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

// 마음 친구 꾸미기: 몸 색 15(빈 값이면 감정 색을 따라감) · 모양 15 · 눈 5 · 볼 5 · 무늬 7 · 팔다리 5 · 꾸미개 20 · 이름(학생 화면에만 보임)
export const BUDDY_COLORS = ["", "#f6c445", "#ff9eb0", "#ffa45c", "#7cc88f", "#5cc8c0", "#7fb5f0", "#b79cf0", "#c9b8a6", "#ef7b6f", "#b5d96a", "#a7d8f5", "#6f86d6", "#ffc3a0", "#a9b4c2"] as const;
export const BUDDY_SHAPES = ["round", "squish", "bean", "drop", "cloud", "star", "mochi", "heart", "egg", "onigiri", "pear", "peanut", "capsule", "dumpling", "gem"] as const;
export const BUDDY_EYES = ["dot", "sparkle", "big", "tall", "lash"] as const;
export const BUDDY_CHEEKS = ["none", "blush", "freckle", "heart", "swirl"] as const;
export const BUDDY_PATTERNS = ["none", "spots", "belly", "stripes", "stars", "hearts", "patch"] as const;
export const BUDDY_LIMBS = ["none", "arms", "both", "wings", "tail"] as const;
export const BUDDY_ACCS = [
  "none", "sprout", "ribbon", "party", "crown", "glasses", "cat", "bunny", "flower", "headphones",
  "beret", "bear", "cap", "bowtie", "antenna", "scarf", "leaf", "chef", "wizard", "grad",
] as const;
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
  riskChecked?: string | null; // 위험 표현 쪽지를 선생님이 「살펴봤어요」한 시각
}

// 한 주 돌아보기: 학생이 이번 주(월요일부터)를 돌아보며 쓴 한 줄과 마음 친구의 답
export interface Reflect {
  id: string; no: number; weekStart: string; text: string; reply: string; createdAt: string;
  lang?: string; risk?: boolean; demo?: boolean;
  riskChecked?: string | null; // 선생님이 「살펴봤어요」를 누른 시각
  riskSelf?: boolean; // 지금 글 자체에 위험 표현이 있나(risk는 앞 글의 살펴보지 않은 위험까지 이어받음)
  prev?: { text: string; risk: boolean; createdAt: string }[]; // 고쳐 쓰기 전 글(risk는 그 글 자체의 위험, 선생님만 봄)
}

// 마치지 않은 위험 표현: 말로 쓴 문장에 위험 표현이 있었는데 학생이 기록을 마치지 않고 나간 것.
// 정리하기(analyze) 때 바로 남기고, 그 칸 기록을 저장하면 지운다(기록에 같은 글이 담기므로). 선생님 마음 지도 알림에 보인다.
export interface RiskDraft {
  id: string; // `${no}_${date}_${slot}` — 그 칸 기록과 같은 이름
  no: number;
  date: string;
  slot: Slot;
  text: string;
  summaryKo?: string;
  hits: string[];
  lang: string;
  at: string;
  checked: string | null;
  demo?: boolean;
  earlier?: { text: string; hits: string[]; at: string }[]; // 같은 칸에 앞서 쓴 위험한 글(새 글이 와도 지우지 않음)
}

// 마음 친구 성장: 서로 다른 감정 단어를 몇 개 써 봤는지에 따라 꾸미개가 열린다(기록 횟수가 아니라 새 단어로)
export const ACC_UNLOCK: Record<BuddyAcc, number> = {
  none: 0, sprout: 0, ribbon: 0, glasses: 1, flower: 2, cat: 3, party: 4, bunny: 5, headphones: 6, crown: 8,
  beret: 9, bear: 10, cap: 11, bowtie: 12, antenna: 14, scarf: 16, leaf: 18, chef: 21, wizard: 24, grad: 28,
};

// 활동지 피드백: 교육부 한국형 사회정서교육 4대 핵심역량(2026 교육부 안내)에 비추어 AI가 쓰고 선생님이 고친다
export const SEL_AREAS = ["자기감정 인식·관리", "관계 인식·관리", "공동체 가치 인식·관리", "정신건강 인식·관리"] as const;
export type SelArea = (typeof SEL_AREAS)[number];
export interface SheetPoint { area: SelArea; point: string; evidence: string }
export interface SheetItem {
  no: number; pages: number[]; // 스캔한 PDF의 몇째 쪽(1부터)
  read: string; topic: string; criteria: string; strengths: SheetPoint[]; grow: SheetPoint[];
  toStudent: string; why: string; check: string; blank: boolean;
  style?: string[]; // AI 글에 남은 번역투·기계식 표현(선생님이 다듬게)
}
export interface SheetRun {
  id: string; file: string; topic: string; content: string; criteria: string; pagesPer: number; skip: number[];
  createdAt: string; items: SheetItem[];
}
