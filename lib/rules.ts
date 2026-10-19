// 「먼저 살펴볼 학생」과 위험 표현 규칙 — AI가 아니라 코드로, 이유를 교사가 그대로 읽을 수 있게
import { addDays } from "./date.ts";
import { CALM_KO, CALM_TOOLS, DEFAULT_RULES, groupOf, isHard, type Group, type MoodRecord, type Rules } from "./shared.ts";

export function matchRisk(text: string, words: string[]) {
  const t = text.replace(/\s+/g, " ");
  return words.filter((w) => w.trim() && t.includes(w.trim()));
}

// 기쁨·평온은 +세기, 힘든 감정은 −세기
function score(r: MoodRecord) {
  return (isHard(r.emotion) ? -1 : 1) * r.intensity;
}

export interface Flag {
  no: number;
  reasons: string[];
}

export function watchFlags(records: MoodRecord[], today: string, rules: Rules = DEFAULT_RULES): Flag[] {
  const from = addDays(today, -6);
  const byNo = new Map<number, MoodRecord[]>();
  for (const r of records) {
    if (r.date < from || r.date > today) continue;
    byNo.set(r.no, [...(byNo.get(r.no) ?? []), r]);
  }

  const flags: Flag[] = [];
  for (const [no, list] of byNo) {
    const reasons: string[] = [];
    const days = [...new Set(list.map((r) => r.date))].sort().reverse();

    // ① 기록한 날 기준 최근 날부터, 그날 기록이 모두 힘든 감정인 날이 이어짐
    let streak = 0;
    for (const d of days) {
      if (list.filter((r) => r.date === d).every((r) => isHard(r.emotion))) streak++;
      else break;
    }
    if (streak >= rules.streakDays) reasons.push(`힘든 마음이 기록한 날 ${streak}번 이어졌어요`);

    // ② 아침보다 하교 전 마음이 크게(4 이상) 가라앉은 날
    const drops = days.filter((d) => {
      const am = list.find((r) => r.date === d && r.slot === "am");
      const pm = list.find((r) => r.date === d && r.slot === "pm");
      return am && pm && score(am) - score(pm) >= 4;
    }).length;
    if (drops >= rules.dropDays) reasons.push(`아침보다 하교 전 마음이 크게 가라앉은 날이 ${drops}번 있어요`);

    // ③ 같은 까닭으로 힘든 마음
    const count = new Map<string, number>();
    for (const r of list) if (isHard(r.emotion) && r.reason !== "그냥") count.set(r.reason, (count.get(r.reason) ?? 0) + 1);
    for (const [reason, n] of count) if (n >= rules.reasonTimes) reasons.push(`「${reason}」 때문에 힘든 마음이 ${n}번 있었어요`);

    if (reasons.length) flags.push({ no, reasons });
  }
  return flags.sort((a, b) => a.no - b.no);
}

// 반에서 누군가 기록한 최근 n일(수업한 날) 동안 한 번도 기록하지 않은 학생
export function absentStudents(records: MoodRecord[], nos: number[], today: string, days: number) {
  const classDays = [...new Set(records.filter((r) => r.date <= today).map((r) => r.date))].sort().reverse().slice(0, days);
  if (classDays.length < days) return [];
  const seen = new Set(records.filter((r) => classDays.includes(r.date)).map((r) => r.no));
  return nos.filter((no) => !seen.has(no));
}

// 응원 초안에서 아이에게 그대로 옮기면 안 되는 선생님용 표현(횟수·날수·기록 이름)
export function leaks(text: string) {
  return text.match(/(\d+|두|세|네|다섯)\s*(번|일|회|차례)(째)?|사흘|이틀|나흘|한\s?줄|기록|신호|규칙/g) ?? [];
}

// 주간 요약용 숫자 묶음: 학생 이름·번호는 넣지 않는다(AI로 가는 것)
export function weekStats(week: MoodRecord[], prev: MoodRecord[], rules: Rules, today: string) {
  const count = (xs: string[]) => Object.fromEntries([...new Set(xs)].map((k) => [k, xs.filter((x) => x === k).length]));
  const words = (rs: MoodRecord[]) => rs.map((r) => r.word).filter((w): w is string => !!w);
  const drops = week.filter((pm) => {
    if (pm.slot !== "pm") return false;
    const am = week.find((r) => r.no === pm.no && r.date === pm.date && r.slot === "am");
    return am && (isHard(am.emotion) ? -1 : 1) * am.intensity - (isHard(pm.emotion) ? -1 : 1) * pm.intensity >= 4;
  }).length;
  const thisWords = count(words(week));
  return {
    기록수: week.length,
    기록한학생수: new Set(week.map((r) => r.no)).size,
    날마다기록수: count(week.map((r) => r.date)),
    감정무리: count(week.map((r) => GROUP_LABEL[groupOf(r.emotion)])),
    힘든마음의까닭: count(week.filter((r) => isHard(r.emotion)).map((r) => r.reason)),
    하교전가라앉은날: drops,
    먼저살펴볼학생수: watchFlags(week, today, rules).length,
    위험표현수: week.filter((r) => r.risk).length,
    쓴감정단어: Object.entries(thisWords).sort((a, b) => b[1] - a[1]).slice(0, 8),
    쓴감정단어종류: Object.keys(thisWords).length,
    지난주감정단어종류: new Set(words(prev)).size,
    마음다스리기: calmStats(week),
  };
}

// 마음 다스리기 도구별로 몇 번 썼고, 그중 「조금 나아졌어요」가 몇 번인지(이름·번호 없이)
export function calmStats(records: MoodRecord[]) {
  const uses = records.flatMap((r) => r.calm ?? []);
  return Object.fromEntries(
    CALM_TOOLS.filter((t) => uses.some((u) => u.tool === t)).map((t) => {
      const mine = uses.filter((u) => u.tool === t);
      return [CALM_KO[t], { 횟수: mine.length, 나아짐: mine.filter((u) => u.felt === "better").length }];
    }),
  );
}

// 교실 TV 「우리 반 마음 날씨」: 이름·번호 없이 감정 무리 수와 감정 단어만. 위험 표현 여부는 넣지 않는다.
export type Weather = "sunny" | "warm" | "rain" | "storm" | "fog" | "partly" | "cloudy" | "rainbow";
export function classWeather(records: MoodRecord[]) {
  const groups: Record<Group, number> = { joy: 0, calm: 0, sad: 0, angry: 0, fear: 0 };
  for (const r of records) groups[groupOf(r.emotion)]++;
  const n = records.length;
  const words = Object.entries(
    records.reduce<Record<string, number>>((m, r) => (r.word ? { ...m, [r.word]: (m[r.word] ?? 0) + 1 } : m), {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const [top, topN] = (Object.entries(groups) as [Group, number][]).sort((a, b) => b[1] - a[1])[0];
  const light = (groups.joy + groups.calm) / (n || 1);
  const weather: Weather =
    n === 0 ? "partly"
    : topN / n >= 0.5 ? ({ joy: "sunny", calm: "warm", sad: "rain", angry: "storm", fear: "fog" } as const)[top]
    : light >= 0.6 ? "partly"
    : light <= 0.4 ? "cloudy"
    : "rainbow";
  return { n, groups, words, weather };
}
const GROUP_LABEL = { joy: "기쁨", calm: "평온", sad: "슬픔", angry: "화남", fear: "불안" } as const;

// 활동지 피드백: 스캔한 순서대로 쪽을 학생 번호에 붙인다. 전출·결석으로 활동지가 없는 번호는 건너뛴다.
export const parseNums = (text: string) => [...new Set((text.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100))].sort((a, b) => a - b);
export function sheetGroups(pageCount: number, pagesPer: number, skip: number[]) {
  const out: { no: number; pages: number[] }[] = [];
  let no = 0;
  for (let p = 1; p <= pageCount; p += pagesPer) {
    do no++; while (skip.includes(no));
    out.push({ no, pages: Array.from({ length: Math.min(pagesPer, pageCount - p + 1) }, (_, i) => p + i) });
  }
  return out;
}
