// 시연용 가짜 반: 가명 25명 + 최근 7일 기록. 살펴볼 학생은 3번·11번·17번, 위험 표현은 22번만 나오게 짠다.
import { addDays } from "./date.ts";
import { matchRisk } from "./rules.ts";
import { DEFAULT_RISK_WORDS, REASON_NAMES, groupOf, type MoodRecord, type Slot, type Student } from "./shared.ts";

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
  const add = (no: number, date: string, slot: Slot, emotion: string, intensity: number, reason: string, summary = "") => {
    const hits = matchRisk(summary, DEFAULT_RISK_WORDS);
    out.push({
      id: `${no}_${date}_${slot}`, no, date, slot, method: summary ? "voice" : "card",
      emotion, intensity, reason, summary, question: "", answer: "",
      risk: hits.length > 0, riskHits: hits, riskChecked: null,
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
  // 22번: 오늘 아침 위험 표현
  set(22, today, "am", "슬퍼요", 5, "그냥", "요즘은 그냥 사라지고 싶어요");
  return out;
}
