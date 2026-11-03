// 학급 사회·정서역량 진단: 선생님이 우리 반 학생들 전체를 떠올리며 20문항에 5점으로 답한다(학생 이름·번호 없음).
// 5개 역량 × 4문항(1~4 정서인식 및 조절, 5~8 자기관리, 9~12 공감하기, 13~16 긍정적 관계맺기, 17~20 책임있는 행동).
// 회차마다 학급 저장 공간 meta/selChecks에 쌓아 두고, 회차끼리 견주어 변화를 본다.

export interface SelComp {
  key: "emotion" | "self" | "empathy" | "relation" | "resp";
  name: string;
  color: string;
  tip: string; // 보완 역량일 때 지도 방법
  app: string; // 마음빛 길잡이에서 함께 해 볼 것({이름}은 손그림 그림으로 보임)
}

export const SEL_COMPS: readonly SelComp[] = [
  {
    key: "emotion", name: "정서인식 및 조절", color: "#6F62D6",
    tip: "감정 단어 카드·감정 온도계로 지금 기분에 이름을 붙여 말하는 연습을 하고, 숨 고르기 같은 진정 방법을 함께 익혀 보세요.",
    app: "학생 화면의 감정 단어 키우기·{dice} 감정 단어 놀이, 힘든 마음 뒤 {calm} 마음 다스리기",
  },
  {
    key: "self", name: "자기관리", color: "#1E8E6A",
    tip: "하루 계획표·스스로 점검표로 준비와 마무리 습관을 만들고, 작은 목표를 해냈을 때 바로 알아봐 주세요.",
    app: "{memo} 한 주 돌아보기로 이번 주 나를 돌아보며 다음 주 다짐 적기",
  },
  {
    key: "empathy", name: "공감하기", color: "#B06A12",
    tip: "친구 입장이 되어 보는 역할극, 감정 읽기 그림책, 「괜찮아?」 한마디 연습으로 공감하는 말과 행동을 키워 보세요.",
    app: "{envelope} 공감 쪽지(선생님이 읽고 허락한 쪽지만 전해짐)",
  },
  {
    key: "relation", name: "긍정적 관계맺기", color: "#2F7FD1",
    tip: "모둠을 자주 바꾸는 협동 놀이, 칭찬 릴레이, 쉬는 시간 함께하는 놀이로 여러 친구와 두루 어울리는 경험을 늘려 보세요.",
    app: "{tv} 교실 화면의 우리 반 마음 날씨·단어 사전으로 아침마다 반 전체 이야기 나누기",
  },
  {
    key: "resp", name: "책임있는 행동", color: "#D2552F",
    tip: "잘한 행동을 바로 알아봐 주는 긍정 피드백, 함께 정한 행동 약속, 스스로 결과를 책임져 보는 경험으로 책임 있는 행동을 길러 보세요.",
    app: "{envelope} 공감 쪽지로 사과·고마움 전하기, {books} 교과서 연결로 약속·사과 차시를 주간 추천 활동에 잇기",
  },
];

export const SEL_ITEMS = [
  "자신이 어떤 상황에서 기분이 좋은지 말로 설명할 수 있다.",
  "속상하거나 화난 이유를 말로 설명할 수 있다.",
  "기분을 물었을 때 적절한 감정 단어로 설명할 수 있다.",
  "기분을 말이나 표정으로 표현한다.",
  "쉬는 시간에 다음 수업을 미리 준비한다.",
  "과제를 수행할 때 집중한다.",
  "과제를 미루지 않고 기한 내에 제출한다.",
  "끝내지 못한 과제를 쉬는 시간에 마무리한다.",
  "친구가 슬퍼할 때 위로하는 반응을 보인다.",
  "친구에게 좋은 일이 생겼을 때 말이나 행동으로 축하한다.",
  "친구와 대화할 때 상대방의 말에 적극적으로 호응한다.",
  "친구가 다쳤을 때 다가가서 살펴보고 걱정해 준다.",
  "학급에서 여러 친구들과 두루 잘 어울린다.",
  "학급 친구들과 어려움 없이 대화를 나눈다.",
  "쉬는 시간에 친구들과 어울리거나 활동한다.",
  "집단 구성이 달라져도 잘 어울린다.",
  "함께 사용하는 물건을 소중히 다룬다.",
  "자신의 실수를 인정하는 모습을 보인다.",
  "잘못했을 때 정중하게 사과한다.",
  "다른 사람의 물건을 사용할 때 허락을 구한다.",
] as const;

export const SEL_SCALE = ["전혀 그렇지 않다", "그렇지 않다", "보통이다", "그렇다", "매우 그렇다"] as const;
export const compOf = (i: number) => Math.floor(i / 4); // 문항 번호(0부터) → 역량 번호

export interface SelCheck {
  id: string;
  date: string; // 체크한 날 YYYY-MM-DD
  school: string;
  group: string; // 학년·반
  rater: string; // 작성자(담임·전담 등)
  answers: number[]; // 20개, 1~5
  memo: string;
  createdAt: string;
  updatedAt?: string;
  demo?: boolean; // 연습 데이터
}

const r2 = (x: number) => Math.round(x * 100) / 100;
export function compScores(answers: number[]) {
  return SEL_COMPS.map((_, c) => r2(answers.slice(c * 4, c * 4 + 4).reduce((a, b) => a + b, 0) / 4));
}
export function overall(answers: number[]) {
  return r2(answers.reduce((a, b) => a + b, 0) / SEL_ITEMS.length);
}
export type SelLevel = "상" | "중" | "하";
export function levelOf(v: number): SelLevel {
  return v >= 4 ? "상" : v >= 3 ? "중" : "하";
}
// 3.5 · 4 · 3.25처럼 필요한 만큼만
export const fmt = (v: number) => String(r2(v));

// 강점(가장 높은)·보완(가장 낮은) 역량 번호. 같은 점수면 모두. 모두 같으면 보완은 없음(고르게 나타남).
export function strongWeak(scores: number[]) {
  const hi = Math.max(...scores), lo = Math.min(...scores);
  const at = (v: number) => scores.flatMap((s, i) => (s === v ? [i] : []));
  return { strong: at(hi), weak: hi === lo ? [] : at(lo) };
}

// 담당 선생님께 보내는 한 줄 요약(원래 체크리스트와 같은 모양)
export function summaryText(c: SelCheck) {
  const s = compScores(c.answers);
  const d = `${Number(c.date.slice(0, 4))}. ${Number(c.date.slice(5, 7))}. ${Number(c.date.slice(8))}.`;
  const who = [c.school, c.group].filter(Boolean).join("/");
  return [
    `[${who}] 작성자:${c.rater || "-"} (${d})`,
    `전체평균:${overall(c.answers).toFixed(2)}`,
    SEL_COMPS.map((x, i) => `${x.name.replace(/\s/g, "")}:${fmt(s[i])}`).join(" "),
  ].join("\n");
}

// 서버에서 받은 값을 깨끗하게(모르는 칸은 버리고, 답은 1~5 정수 20개여야 함)
const str = (v: unknown, n: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
export function cleanCheck(x: unknown): Omit<SelCheck, "id" | "createdAt"> | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const answers = Array.isArray(o.answers) ? o.answers.map(Number) : [];
  if (answers.length !== SEL_ITEMS.length || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "";
  if (!date) return null;
  return { date, school: str(o.school, 30), group: str(o.group, 20), rater: str(o.rater, 20), answers, memo: str(o.memo, 1000) };
}
