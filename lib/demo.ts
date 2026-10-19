// 시연용 가짜 반: 가명 25명 + 최근 7일 기록. 살펴볼 학생은 3번·11번·17번, 위험 표현은 22번만 나오게 짠다.
import { addDays, monday } from "./date.ts";
import { matchRisk } from "./rules.ts";
import { BUDDY_ACCS, BUDDY_CHEEKS, BUDDY_COLORS, BUDDY_EYES, BUDDY_LIMBS, BUDDY_PATTERNS, BUDDY_SHAPES, DEFAULT_RISK_WORDS, NUANCE, REASON_NAMES, groupOf, type BuddyLook, type CalmTool, type Felt, type Letter, type Reflect, type MoodRecord, type Slot, type Student } from "./shared.ts";

const ALIASES = [
  "햇살", "구름", "단풍", "별빛", "산들", "보리", "달콩", "초롱", "모래", "노을",
  "새싹", "다온", "도담", "가람", "하람", "여울", "라온", "소담", "온유", "마루",
  "나래", "이든", "한결", "윤슬", "푸름",
];
const CALM = ["기뻐요", "신나요", "고마워요", "편안해요", "그저 그래요"];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoStudents(makeCode: () => string): Student[] {
  return ALIASES.map((alias, i) => ({ no: i + 1, alias, code: makeCode() }));
}

export function demoRecords(today: string): MoodRecord[] {
  const rand = rng(20261018);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const out: MoodRecord[] = [];
  const wr = rng(7); // 감정 단어는 따로 뽑아 다른 연습 기록이 바뀌지 않게
  const add = (no: number, date: string, slot: Slot, emotion: string, intensity: number, reason: string, summary = "") => {
    const hits = matchRisk(summary, DEFAULT_RISK_WORDS);
    out.push({
      id: `${no}_${date}_${slot}`, no, date, slot, method: summary ? "voice" : "card",
      emotion, intensity, reason, summary, question: "", answer: "",
      ...(wr() < 0.6 && NUANCE[emotion] ? { word: NUANCE[emotion][Math.floor(wr() * 3)] } : {}),
      risk: hits.length > 0, riskHits: hits, riskChecked: null, demo: true,
      createdAt: `${date}T${slot === "am" ? "08:40" : "14:20"}:00+09:00`,
    });
  };

  for (let no = 1; no <= 25; no++) {
    // 보통 학생: 편안한 감정 위주, 힘든 감정은 일주일에 아침 한 번까지만(규칙에 걸리지 않게)
    const hardDay = rand() < 0.5 ? Math.floor(rand() * 6) : -1;
    for (let back = 6; back >= 0; back--) {
      const date = addDays(today, -back);
      if (back === 0 && (no === 5 || no === 15)) continue; // 오늘 아직 기록 전
      const amHard = back === hardDay;
      add(no, date, "am", amHard ? pick(["피곤해요", "걱정돼요", "속상해요"]) : pick(CALM), 1 + Math.floor(rand() * 3), pick(REASON_NAMES));
      if (back > 0) add(no, date, "pm", pick(CALM), 1 + Math.floor(rand() * 4), pick(REASON_NAMES));
    }
  }

  // 말투 비교용 「평소 목소리」: 보통 학생은 2~5일 전 하교 전 기록을 말하기로(목소리 숫자만, 녹음 없음)
  const vr = rng(7); // 위 순서를 흐트러뜨리지 않게 따로 뽑는다
  const SAY: Record<string, string[]> = {
    joy: ["친구랑 술래잡기 해서 신났어요", "급식에 좋아하는 반찬이 나왔어요", "발표를 잘해서 뿌듯했어요"],
    calm: ["오늘은 그냥 평범했어요", "책 읽는 시간이 좋았어요", "쉬는 시간에 그림을 그렸어요"],
  };
  for (const r of out) {
    const back = (Date.parse(today) - Date.parse(r.date)) / 864e5;
    if (r.slot !== "pm" || back < 2 || back > 5) continue;
    const pool = SAY[groupOf(r.emotion)] ?? SAY.calm;
    Object.assign(r, {
      method: "voice", summary: pool[Math.floor(vr() * pool.length)], tone: "차분함", toneBy: "device", toneWhy: "평소와 비슷하게",
      voice: { seconds: 2.5 + vr(), loud: 0.11 + vr() * 0.05, pitch: 240 + vr() * 40, pitchVar: 2.6 + vr() * 0.6, rate: 5 + vr() * 0.8 },
    });
  }

  const set = (no: number, date: string, slot: Slot, emotion: string, intensity: number, reason: string, summary = "") => {
    const i = out.findIndex((r) => r.id === `${no}_${date}_${slot}`);
    if (i >= 0) out.splice(i, 1);
    add(no, date, slot, emotion, intensity, reason, summary);
  };
  // 3번: 그제·어제·오늘 아침까지 힘든 마음만
  set(3, addDays(today, -2), "am", "피곤해요", 3, "몸");
  set(3, addDays(today, -2), "pm", "속상해요", 3, "공부", "수학 시간에 문제를 하나도 못 풀었어요");
  set(3, addDays(today, -1), "am", "걱정돼요", 3, "집");
  set(3, addDays(today, -1), "pm", "슬퍼요", 4, "그냥");
  set(3, today, "am", "속상해요", 4, "공부");
  // 11번: 아침엔 좋다가 하교 전에 가라앉은 날 두 번
  set(11, addDays(today, -4), "am", "신나요", 3, "친구");
  set(11, addDays(today, -4), "pm", "속상해요", 3, "친구");
  set(11, addDays(today, -2), "am", "기뻐요", 2, "공부");
  set(11, addDays(today, -2), "pm", "억울해요", 4, "친구", "피구할 때 내 차례를 자꾸 빼먹었어요");
  // 17번: 「친구」 때문에 힘든 마음 세 번
  set(17, addDays(today, -5), "am", "억울해요", 3, "친구");
  set(17, addDays(today, -3), "am", "화나요", 3, "친구");
  set(17, addDays(today, -1), "am", "속상해요", 2, "친구", "쉬는 시간에 혼자 있었어요");
  // 9번: 베트남어로 남긴 기록(선생님 화면엔 한국어 요약)
  set(9, today, "am", "슬퍼요", 3, "친구", "Em nhớ bạn bè ở Việt Nam");
  Object.assign(out[out.length - 1], { lang: "vi", word: "그리워요", summaryKo: "베트남에 있는 친구들이 보고 싶어요" });
  // 힘든 마음을 남긴 뒤 마음 다스리기 도구를 써 본 기록(선생님 화면에서 어떤 도구가 도움이 되는지 보이게)
  const calm = (no: number, date: string, slot: Slot, ...uses: [CalmTool, Felt][]) => {
    const r = out.find((x) => x.id === `${no}_${date}_${slot}`);
    if (r) r.calm = uses.map(([tool, felt], i) => ({ tool, felt, at: `${date}T${slot === "am" ? "08:4" : "14:2"}${i + 2}:00+09:00` }));
  };
  calm(3, addDays(today, -1), "pm", ["breathe", "better"]);
  calm(3, today, "am", ["breathe", "better"], ["draw", "same"]);
  calm(11, addDays(today, -2), "pm", ["senses", "unsure"]);
  calm(17, addDays(today, -3), "am", ["squeeze", "better"]);
  calm(17, addDays(today, -1), "am", ["squeeze", "better"]);
  // 22번: 오늘 아침 위험 표현
  set(22, today, "am", "슬퍼요", 5, "그냥", "요즘은 그냥 사라지고 싶어요");
  return out;
}

// 연습 반 학생들이 꾸민 마음 친구(절반쯤만 꾸민 것처럼)
export function demoLooks(): Record<number, BuddyLook> {
  const rand = rng(31);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const out: Record<number, BuddyLook> = {};
  for (let no = 1; no <= 25; no++) {
    if (rand() < 0.4) continue;
    out[no] = {
      color: pick(BUDDY_COLORS), shape: pick(BUDDY_SHAPES), eyes: pick(BUDDY_EYES), cheek: pick(BUDDY_CHEEKS),
      pattern: pick(BUDDY_PATTERNS), limbs: pick(BUDDY_LIMBS), acc: pick(BUDDY_ACCS), name: "",
    };
  }
  return out;
}

// 연습 반의 공감 쪽지(선생님 허락을 기다리는 것 포함)와 이번 주 돌아보기
export function demoExtras(today: string): { letters: Letter[]; reflects: Reflect[] } {
  const at = (d: number, hm: string) => `${addDays(today, d)}T${hm}:00+09:00`;
  const L = (id: number, from: number, to: number, text: string, showName: boolean, status: Letter["status"], d: number): Letter => ({
    id: `L${id}`, from, to, text, showName, status, createdAt: at(d, "12:10"), ...(status !== "wait" ? { checkedAt: at(d, "15:00") } : {}), demo: true,
  });
  const week = monday(today);
  const R = (no: number, text: string, reply: string): Reflect => ({
    id: `${no}_${week}`, no, weekStart: week, text, reply, createdAt: at(0, "14:30"), demo: true,
  });
  return {
    letters: [
      L(1, 5, 3, "수학 문제 어려웠지? 다음엔 같이 풀자!", true, "ok", -1),
      L(2, 12, 17, "쉬는 시간에 같이 그림 그리자. 너 그림 진짜 멋져.", true, "wait", 0),
      L(3, 8, 11, "피구할 때 속상했지? 다음엔 내가 공 줄게!", false, "wait", 0),
      L(4, 2, 9, "베트남 이야기 또 들려줘. 재미있었어!", true, "ok", -2),
    ],
    reflects: [
      R(1, "이번 주 나는 발표를 용기 내서 했다.", "용기 내서 발표한 너, 정말 멋졌어! 다음 주도 응원할게."),
      R(6, "이번 주 나는 친구랑 사이좋게 지냈다.", "친구와 사이좋게 지낸 한 주였구나. 그 다정함이 반을 따뜻하게 해."),
      R(14, "이번 주 나는 힘들었지만 잘 견뎠다.", "힘든 날에도 잘 견뎌 준 너에게 박수를 보내. 힘들 땐 선생님께 말해도 돼."),
    ],
  };
}
