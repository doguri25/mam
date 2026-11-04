// 「먼저 살펴볼 학생」과 위험 표현 규칙 — AI가 아니라 코드로, 이유를 교사가 그대로 읽을 수 있게
import { addDays } from "./date.ts";
import { CALM_KO, CALM_TOOLS, DEFAULT_RULES, RISK_CORE, groupOf, isHard, type Group, type MoodRecord, type Rules } from "./shared.ts";

// 위험 표현 찾기. 놓치는 것보다 잘못 거는 편이 낫다(선생님이 고른 「넓게 찾기」). 다만 터무니없이 걸리지는 않게.
// 견주기 전에 글과 말을 똑같이 고른다(norm): NFKC(반각 「ｼﾆﾀｲ」·전각 「ｋｉｌｌ」), 작은 글자, 둥근 따옴표 → ', 가타카나 → 히라가나.
// · 한글·한자·가나 말
//   - 세 글자 이상(「죽고 싶」): 글자 사이에 빈칸·문장부호·기호·이모지·ㅠㅜ가 끼어도 찾는다(「죽고ㅠㅠ싶어」「죽💀고 싶어」).
//     끝 글자가 받침 없는 한글이면 받침이 붙은 꼴도 찾는다(「괴롭혀」→「괴롭혔어요」, 「다치게 하」→「다치게 함」).
//   - 두 글자 말(「자해」「왕따」)은 말에 빈칸이 있던 자리만 빈칸을 건너고, 받침도 늘리지 않는다(「남자 해적」「왕딸기」가 걸리지 않게).
// · 영어·베트남어처럼 빈칸으로 낱말을 나누는 말은 낱말 앞머리부터 견준다(「hit me」가 「white meat」에 걸리지 않게).
//   '는 빼고 견준다(「don't」=「dont」=「don’t」). 성조가 붙은 말은 성조 없이 친 낱말과도 견준다(「bi danh」=「bị đánh」).
// · 글자·숫자가 없는 말(「💀」「!!」)은 글에 그대로 들어 있을 때만 찾는다.
// 선생님 목록(words)에 RISK_CORE를 늘 더한다. 돌려주는 것은 걸린 말(선생님이 쓴 모양이 먼저, 같은 말·같은 자리에 걸린 말은 한 번만).
const CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/;
const CJK_RUN = new RegExp(`${CJK.source}+`, "g");
// 한글 낱자(ㅈㄱㅅㅇ·ㅠㅠ)는 NFKC에 넣지 않는다: NFKC는 「ㅇㅠ」를 「유」로 붙여 버린다
const norm = (s: string) =>
  s.replace(/[’‘ʼ＇`´′]/g, "'")
    .replace(/[\u00ad\u200b-\u200d\u2060\ufe0e\ufe0f\ufeff]/g, "")
    .replace(/[^\u3130-\u318f]+/g, (m) => m.normalize("NFKC"))
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
// 고른 글을 낱말 사이 빈칸 하나로(한글·한자·가나 덩어리도 낱말 하나로 떼어 「나bully당했어」의 bully도 찾게)
const spaced = (s: string) => ` ${s.replace(CJK_RUN, " $& ").replace(/'/g, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim()} `;
// 성조·모음 표시를 뗀 꼴(베트남어): muốn chết → muon chet
const bare = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").normalize("NFC");
// 같은 말 거르기: 한글·한자·가나 말은 빈칸·문장부호를 빼고, 다른 말은 낱말만 남겨 견준다(「hit-me」=「hit me」, 「kill my self」≠「kill myself」).
// 기호만 있는 말은 기호 그대로.
const keyOf = (w: string) => {
  const n = norm(w).trim();
  if (!/[\p{L}\p{N}]/u.test(n)) return n.replace(/\s+/g, "");
  return CJK.test(n) ? n.replace(/[\s\p{P}]+/gu, "") : spaced(n).trim();
};
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GAP = "[\\s\\p{P}\\p{S}\\p{M}ㅠㅜ]*";
const openSyllable = (c: string) => c >= "가" && c <= "힣" && (c.charCodeAt(0) - 0xac00) % 28 === 0;
// 성조 없이는 견주지 않는 말: 「tu tu」는 「từ từ(천천히)」로 흔히 쓴다
const NO_BARE = new Set(["tu tu"]);
// 위험 표현과 글자가 겹치는 평범한 말: 「わたしにたいして(나에게)」「わたしにたいせつ(나에게 소중한)」에 「しにたい」가,
// 「いちじさつまいもほり(한 시 고구마 캐기)」에 「じさつ」가 걸리지 않게
const INNOCENT = /にたい(?:して|する|へん|せつ)|さつまいも/g;

interface Texts { plain: string; loose: string; plainOnly: string; flat: string }
// 걸리면 글의 어디에 걸렸는지(같은 자리에 걸린 다른 말을 거르려고), 아니면 null
type Find = (t: Texts) => string | null;

function cjkPattern(w: string) {
  const core = [...w.replace(/[\s\p{P}]+/gu, "")];
  if (core.length >= 3) {
    const last = core.pop()!;
    const tail = openSyllable(last) ? `[${last}-${String.fromCharCode(last.charCodeAt(0) + 27)}]` : esc(last);
    return new RegExp([...core.map(esc), tail].join(GAP), "u");
  }
  return new RegExp(w.split(/[\s\p{P}]+/u).filter(Boolean).map((p) => [...p].map(esc).join("")).join("\\s*"), "u");
}

function compile(raw: string): Find | null {
  const w = norm(raw).trim();
  if (!w) return null;
  if (!/[\p{L}\p{N}]/u.test(w)) {
    const lit = w.replace(/\s+/g, "");
    return (t) => {
      const i = t.flat.indexOf(lit);
      return i < 0 ? null : `s${i}:${lit.length}`;
    };
  }
  if (CJK.test(w)) {
    const re = cjkPattern(w);
    return (t) => {
      const m = re.exec(t.plain);
      return m ? `c${m.index}:${m[0].length}` : null;
    };
  }
  const p = spaced(w).trimEnd();
  const b = spaced(bare(w)).trimEnd();
  const useBare = b !== p && !NO_BARE.has(b.trim());
  return (t) => {
    let i = t.loose.indexOf(p);
    if (i >= 0) return `l${i}:${p.length}`;
    if (useBare && (i = t.plainOnly.indexOf(b)) >= 0) return `l${i}:${b.length}`;
    return null;
  };
}

// 목록마다 한 번만 만들어 둔다(기록을 저장할 때마다 부르므로)
const compiled = new Map<string, { word: string; find: Find }[]>();
function matchersFor(words: string[]) {
  const id = words.join("\u0000");
  let list = compiled.get(id);
  if (list) return list;
  list = [];
  const seen = new Set<string>();
  for (const raw of [...words, ...RISK_CORE]) {
    const word = String(raw).trim();
    const key = keyOf(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const find = compile(word);
    if (find) list.push({ word, find });
  }
  if (compiled.size >= 32) compiled.delete(compiled.keys().next().value!);
  compiled.set(id, list);
  return list;
}

export function matchRisk(text: string, words: string[]) {
  const n = norm(text);
  const loose = spaced(n);
  const t: Texts = {
    plain: n.replace(INNOCENT, (m) => "\u0001".repeat(m.length)),
    loose,
    // 성조 없는 꼴과 견줄 때는 성조를 제대로 친 낱말을 가린다(「bí danh(별명)」이 「bi danh」으로 걸리지 않게)
    plainOnly: loose.replace(/\S+/g, (x) => (bare(x) === x ? x : "#".repeat(x.length))),
    flat: n.replace(/\s+/g, ""),
  };
  const at = new Set<string>();
  const out: string[] = [];
  for (const { word, find } of matchersFor(words)) {
    const where = find(t);
    if (where && !at.has(where)) {
      at.add(where);
      out.push(word);
    }
  }
  return out;
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

// 응원 초안·한 주 돌아보기 답에서 아이에게 그대로 옮기면 안 되는 선생님용 표현(횟수·날수·기록 이름).
// 「네 일처럼 기뻤구나」「규칙을 잘 지켰구나」「다음엔 네 차례야」「마음이 보내는 신호」 같은 평범한 말은 지나간다.
const LEAK = new RegExp([
  String.raw`\d+\s*(?:번(?!호)|일|회|차례)(?:째)?`, // 3번, 2일, 4회째
  String.raw`\d+\s*(?:times?|days?|次|天|回|日|lần|ngày)`, // 다른 언어로 쓴 답의 횟수·날수
  String.raw`(?<![가-힣])(?:두|세|네|다섯|여섯)\s*번(?!호)(?:째)?`, // 두 번, 세 번째(「네 번호」는 빼고)
  String.raw`(?<![가-힣])(?:두|세|다섯|여섯)\s*차례`, // 「네 차례」는 「너의 차례」로 흔히 쓰여 뺀다
  "이틀|사흘|나흘|닷새|며칠째|며칠 동안",
  String.raw`한\s?줄`, // 기록 칸 이름 「한줄」
  String.raw`(?<!신|최고\s?|달리기\s?|줄넘기\s?)기록`, // 「신기록」「달리기 기록」은 평범한 말
  String.raw`선생님이\s?본\s?신호|되묻기`, // 응원 초안에 넘긴 칸 이름
].join("|"), "g");
export function leaks(text: string) {
  return text.match(LEAK) ?? [];
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
  const ranked = (Object.entries(groups) as [Group, number][]).sort((a, b) => b[1] - a[1]);
  const [top, topN] = ranked[0];
  const tie = ranked[1][1] === topN; // 반반으로 갈리면 한쪽 날씨로 정하지 않는다(기쁨 5·슬픔 5가 「맑음」이 되지 않게)
  const light = (groups.joy + groups.calm) / (n || 1);
  const weather: Weather =
    n === 0 ? "partly"
    : topN / n >= 0.5 && !tie ? ({ joy: "sunny", calm: "warm", sad: "rain", angry: "storm", fear: "fog" } as const)[top]
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
