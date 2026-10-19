// 시연용 가짜 반: 가명 25명 + 최근 7일 기록. 살펴볼 학생은 3번·11번·17번, 위험 표현은 22번만 나오게 짠다.
import { addDays, monday } from "./date.ts";
import { matchRisk } from "./rules.ts";
import { BUDDY_ACCS, BUDDY_CHEEKS, BUDDY_COLORS, BUDDY_EYES, BUDDY_LIMBS, BUDDY_PATTERNS, BUDDY_SHAPES, DEFAULT_RISK_WORDS, NUANCE, REASON_NAMES, groupOf, type BuddyLook, type CalmTool, type Felt, type Letter, type Reflect, type MoodRecord, type SheetItem, type SheetRun, type Slot, type Student } from "./shared.ts";

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

// 활동지 피드백 예시 한 회차: 예시 활동지 PDF(public/sample-sheets.pdf) 앞 5쪽을 4번을 건너뛰고 읽은 모습.
// 실제 AI(Solar·Claude)가 이 활동지에 쓴 피드백을 다듬은 것이다.
export const PRACTICE_SHEET = "practice";
export function demoSheetRun(today: string): SheetRun {
  const C = "감정을 날씨로 알맞게 나타냈는지, 그렇게 느낀 까닭을 함께 썼는지";
  const P = (area: SheetItem["strengths"][number]["area"], point: string, evidence: string) => ({ area, point, evidence });
  const I = (no: number, page: number, read: string, strengths: SheetItem["strengths"], grow: SheetItem["grow"], toStudent: string, why: string): SheetItem =>
    ({ no, pages: [page], read, topic: "내 마음 날씨 그리기", criteria: C, strengths, grow, toStudent, why, check: "", blank: false });
  return {
    id: PRACTICE_SHEET, file: "sample-sheets.pdf", topic: "내 마음 날씨 그리기",
    content: "오늘 내 마음을 날씨와 내 모습으로 그리고, 그렇게 그린 까닭을 써요.", criteria: C, pagesPer: 1, skip: [4],
    createdAt: `${addDays(today, -1)}T14:20:00+09:00`,
    items: [
      I(1, 1, "노란 해 아래에서 웃는 두 아이(빨강·파랑)를 그렸어요. 글에는 「오늘 친구랑 줄넘기를 했다. 50개나 넘어서 신났다. 내 마음은 맑음!」이라고 썼어요.",
        [P("자기감정 인식·관리", "신난 마음을 알아차리고 「맑음」이라는 날씨와 밝은 해 그림으로 잘 나타냈어요.", "「50개나 넘어서 신났다. 내 마음은 맑음!」, 크게 그린 노란 해"),
         P("관계 인식·관리", "친구와 함께한 시간이 즐거운 마음의 까닭이 되었음을 알아차렸어요.", "「친구랑 줄넘기를 했다」, 나란히 웃는 두 아이")],
        [P("관계 인식·관리", "함께 뛴 친구는 어떤 마음이었을지 떠올려 보는 한 걸음을 해 볼 수 있어요.", "친구가 그림에 있지만 친구의 마음은 아직 적지 않았어요.")],
        "줄넘기를 50개나 넘어서 정말 신났구나! 맑은 해로 마음을 환하게 잘 그렸어요. 같이 뛴 친구는 어떤 마음이었을지도 생각해 볼까요?",
        "「신났다」는 감정 낱말과 「맑음」 날씨, 해 그림이 서로 잘 이어져 있어 자기감정 인식·관리를 칭찬했어요. 즐거움의 까닭이 친구와 함께한 일이라 관계 인식·관리도 알아주고, 다음 걸음으로 친구 마음 헤아리기를 권했어요."),
      I(2, 2, "비가 내리는 먹구름 아래 눈물을 흘리는 아이를 그렸어요. 글에는 「동생이 내 색연필을 부러뜨려서 속상했다. 그래도 엄마한테 말하니까 조금 나아졌다.」라고 썼어요.",
        [P("자기감정 인식·관리", "속상한 마음을 비와 눈물로 나타내고, 마음이 조금 나아진 변화까지 알아차렸어요.", "「속상했다」「조금 나아졌다」, 비구름과 눈물 그림"),
         P("정신건강 인식·관리", "힘들 때 어른에게 이야기해 마음을 돌보는 방법을 썼어요.", "「엄마한테 말하니까 조금 나아졌다」")],
        [P("자기감정 인식·관리", "속상할 때 스스로 해 볼 수 있는 작은 방법(숨 고르기 등)을 하나 더 떠올려 보면 좋겠어요.", "도움을 청한 경험은 있지만 스스로 해 본 방법은 아직 적지 않았어요.")],
        "색연필이 부러져서 많이 속상했겠구나. 엄마께 마음을 이야기한 건 정말 좋은 방법이에요. 다음에 속상할 때 혼자서도 해 볼 수 있는 방법을 하나 더 찾아볼까요?",
        "속상한 감정을 알아차려 표현하고, 어른에게 말해 마음을 돌본 점이 드러나 자기감정 인식·관리와 정신건강 인식·관리에 비추어 칭찬했어요. 도움 청하기에 더해 스스로 마음을 다스리는 방법을 넓혀 보도록 권했어요."),
      I(3, 3, "회색 구름 아래 걱정스러운 표정으로 선 아이를 그렸어요. 글에는 「발표할 때 가슴이 콩닥콩닥 떨렸다. 숨을 크게 세 번 쉬었더니 끝까지 말할 수 있었다.」라고 썼어요.",
        [P("자기감정 인식·관리", "떨리는 마음을 「콩닥콩닥」으로 알아차리고, 숨쉬기로 스스로 다스렸어요.", "「숨을 크게 세 번 쉬었더니 끝까지 말할 수 있었다」"),
         P("정신건강 인식·관리", "긴장되는 순간에 자기만의 방법으로 마음을 돌보고 끝까지 해냈어요.", "구름 그림과 「끝까지 말할 수 있었다」")],
        [P("자기감정 인식·관리", "떨렸던 마음에 「긴장돼요」 같은 감정 낱말로 이름을 붙여 보면 더 잘 알아차릴 수 있어요.", "몸의 느낌(콩닥콩닥)은 썼지만 감정 이름은 쓰지 않았어요.")],
        "발표할 때 가슴이 콩닥콩닥했구나. 숨을 크게 세 번 쉬고 끝까지 말한 모습이 정말 멋져요. 그때 마음에 「긴장돼요」처럼 이름을 붙여 볼까요?",
        "몸의 신호로 긴장을 알아차리고 숨쉬기로 스스로 다스린 점이 분명해 자기감정 인식·관리와 정신건강 인식·관리를 칭찬했어요. 감정 낱말로 이름 붙이기가 다음 단계라 부드럽게 권했어요."),
      I(5, 4, "무지개 아래 웃는 아이와 아파하는 아이를 나란히 그렸어요. 글에는 「운동장에서 친구가 넘어졌다. 내가 일으켜 주고 보건실에 같이 갔다. 고맙다고 해서 뿌듯했다.」라고 썼어요.",
        [P("관계 인식·관리", "넘어진 친구의 마음을 헤아리고 직접 도와주었어요.", "「내가 일으켜 주고 보건실에 같이 갔다」, 아픈 친구 곁에 선 그림"),
         P("공동체 가치 인식·관리", "어려운 친구를 돕는 배려를 행동으로 실천했어요.", "보건실까지 함께 간 일")],
        [P("자기감정 인식·관리", "뿌듯한 마음을 무지개로 그린 까닭도 한 줄 써 보면 좋겠어요.", "무지개 그림과 뿌듯한 마음을 잇는 까닭은 글에 없어요.")],
        "넘어진 친구를 일으켜 주고 보건실까지 함께 갔구나. 친구를 아끼는 따뜻한 마음이 정말 고마워요. 뿌듯한 마음을 왜 무지개로 그렸는지도 들려줄래요?",
        "친구의 아픔을 알아차리고 행동으로 도운 점이 뚜렷해 관계 인식·관리와 공동체 가치 인식·관리에 비추어 칭찬했어요. 자기 감정과 그림을 잇는 표현을 넓히도록 질문으로 권했어요."),
      I(6, 5, "번개가 치는 먹구름 아래 화난 표정의 아이를 그렸어요. 글에는 「축구할 때 내가 반칙했다고 해서 화가 났다. 소리를 질렀다. 다음엔 말로 해야겠다.」라고 썼어요.",
        [P("자기감정 인식·관리", "화가 난 마음과 그 까닭을 솔직하게 알아차려 썼어요.", "「반칙했다고 해서 화가 났다」, 번개 그림"),
         P("관계 인식·관리", "소리를 지른 일을 돌아보고 다음에는 말로 하겠다고 스스로 다짐했어요.", "「다음엔 말로 해야겠다」")],
        [P("자기감정 인식·관리", "화가 날 때 말하기 전에 잠깐 멈추는 방법(숨 고르기, 열까지 세기)을 함께 연습해 보면 좋겠어요.", "번개처럼 갑자기 커진 마음을 그렸어요.")],
        "억울해서 많이 화가 났구나. 소리를 지른 일을 돌아보고 다음엔 말로 하겠다고 생각한 게 정말 멋져요. 화가 날 때 숨을 크게 쉬고 「나는 지금 화가 나」라고 말해 볼까요?",
        "화난 감정과 까닭을 정확히 알아차리고, 자기 행동을 돌아보며 더 나은 방법을 스스로 찾은 점을 자기감정 인식·관리와 관계 인식·관리에 비추어 칭찬했어요. 화를 다스리는 구체적인 방법을 다음 걸음으로 제안했어요."),
    ],
  };
}
