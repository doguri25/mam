// 학생 자기진단(학생 화면 이름: 「마음 점검」): 학생이 스스로 10문항에 「그래요 · 가끔 그래요 · 아니에요」로 답한다.
// 선생님 학급 역량 진단과 같은 5개 역량 × 2문항이라, 학기 초·말 회차를 견주고 선생님 관찰과 나란히 볼 수 있다.
// 회차는 meta/selfRounds 문서 하나, 학생 답은 학생마다 meta/self_<회차>_<번호> 문서(여럿이 동시에 내도 서로 덮지 않게).
import type { Lang } from "./i18n.ts";
import { SEL_COMPS, type SelComp } from "./selcheck.ts";

type Text = Record<Lang, string>;
export const SELF_ITEMS: readonly { comp: SelComp["key"]; text: Text }[] = [
  { comp: "emotion", text: { ko: "내 기분이 어떤지 말로 말할 수 있어요.", en: "I can say in words how I feel.", zh: "我能用语言说出自己的心情。", vi: "Em có thể nói ra cảm xúc của mình bằng lời.", ja: "じぶんの きもちを ことばで 言えます。" } },
  { comp: "emotion", text: { ko: "화나거나 속상할 때 마음을 가라앉힐 수 있어요.", en: "When I'm angry or upset, I can calm myself down.", zh: "生气或难过时，我能让自己平静下来。", vi: "Khi tức giận hay buồn, em có thể tự bình tĩnh lại.", ja: "おこったり かなしかったり するとき、きもちを おちつけられます。" } },
  { comp: "self", text: { ko: "해야 할 일을 스스로 챙겨서 해요.", en: "I take care of my tasks by myself.", zh: "该做的事情我会自己主动去做。", vi: "Em tự giác làm những việc cần làm.", ja: "やるべき ことを じぶんで します。" } },
  { comp: "self", text: { ko: "어려운 일도 끝까지 해 보려고 해요.", en: "I keep trying even when something is hard.", zh: "遇到困难的事，我也会坚持做到最后。", vi: "Kể cả khi khó, em vẫn cố gắng đến cùng.", ja: "むずかしい ことでも、さいごまで がんばります。" } },
  { comp: "empathy", text: { ko: "친구가 슬퍼 보이면 괜찮은지 물어봐요.", en: "When a friend looks sad, I ask if they're okay.", zh: "朋友看起来难过时，我会问他还好吗。", vi: "Khi bạn trông buồn, em hỏi bạn có ổn không.", ja: "ともだちが かなしそうな とき、「だいじょうぶ?」と ききます。" } },
  { comp: "empathy", text: { ko: "친구가 말할 때 끝까지 들어요.", en: "I listen to my friends until they finish talking.", zh: "朋友说话时，我会听他说完。", vi: "Em lắng nghe bạn nói hết.", ja: "ともだちの はなしを さいごまで ききます。" } },
  { comp: "relation", text: { ko: "여러 친구와 사이좋게 지내요.", en: "I get along well with many classmates.", zh: "我和很多同学相处得很好。", vi: "Em chơi hòa thuận với nhiều bạn.", ja: "いろいろな ともだちと なかよく できます。" } },
  { comp: "relation", text: { ko: "친구와 다투면 다시 사이좋게 지내려고 해요.", en: "After a fight, I try to make up with my friend.", zh: "和朋友吵架后，我会努力和好。", vi: "Sau khi cãi nhau, em cố gắng làm lành với bạn.", ja: "けんかしたら、なかなおり しようと します。" } },
  { comp: "resp", text: { ko: "잘못했을 때 “미안해”라고 말해요.", en: "When I make a mistake, I say “I'm sorry.”", zh: "做错事时，我会说“对不起”。", vi: "Khi làm sai, em nói lời xin lỗi.", ja: "まちがえた とき、「ごめんね」と 言えます。" } },
  { comp: "resp", text: { ko: "우리 반 약속을 잘 지켜요.", en: "I keep our class promises.", zh: "我遵守班级的约定。", vi: "Em giữ đúng những điều lớp đã hứa với nhau.", ja: "クラスの やくそくを まもります。" } },
];

// 답: 3 그래요 · 2 가끔 그래요 · 1 아니에요 (얼굴 그림과 함께 고른다)
export const SELF_SCALE = [3, 2, 1] as const;
export const SELF_ANSWER: Record<1 | 2 | 3, Text & { face: string }> = {
  3: { ko: "그래요", en: "Yes", zh: "是的", vi: "Đúng vậy", ja: "そうだよ", face: "기뻐요" },
  2: { ko: "가끔 그래요", en: "Sometimes", zh: "有时候", vi: "Thỉnh thoảng", ja: "ときどき", face: "편안해요" },
  1: { ko: "아니에요", en: "Not really", zh: "不太是", vi: "Không hẳn", ja: "あまり ない", face: "멍해요" },
};

export interface SelfRound {
  id: string;
  title: string; // 학기 초 · 학기 말 · 선생님이 쓴 이름
  openedAt: string; // YYYY-MM-DD
  closedAt: string | null; // 닫으면 학생 화면에서 사라진다
  demo?: boolean;
}
export interface SelfAnswer {
  kind: "selfAnswer";
  round: string;
  no: number;
  answers: number[]; // 10개, 1~3
  at: string;
  demo?: boolean;
}
export const selfDocId = (round: string, no: number) => `self_${round}_${no}`;

export function cleanSelfAnswers(x: unknown): number[] | null {
  const a = Array.isArray(x) ? x.map(Number) : [];
  return a.length === SELF_ITEMS.length && a.every((v) => v === 1 || v === 2 || v === 3) ? a : null;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const mean = (xs: number[]) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// 한 학생(답 10개)의 역량별 점수(1~3)
export function selfComps(answers: number[]): number[] {
  return SEL_COMPS.map((c) => mean(SELF_ITEMS.flatMap((it, i) => (it.comp === c.key ? [answers[i]] : [])))!);
}
// 반 전체: 역량별 평균(답한 학생이 없으면 null)
export function classComps(list: number[][]): (number | null)[] {
  const per = list.map(selfComps);
  return SEL_COMPS.map((_, c) => mean(per.map((p) => p[c])));
}
// 문항별 [그래요, 가끔, 아니에요] 학생 수
export function itemCounts(list: number[][]): [number, number, number][] {
  return SELF_ITEMS.map((_, i) => [3, 2, 1].map((v) => list.filter((a) => a[i] === v).length) as [number, number, number]);
}
// 3점 만점·5점 만점 점수를 같은 눈금(0~100)으로: 선생님 관찰과 나란히 보려고
export const pctOf = (v: number, max: 3 | 5) => Math.round(((v - 1) / (max - 1)) * 100);

// 먼저 살펴볼 학생: 어느 역량이든 두 문항 모두 「아니에요」(1점)이거나, 지난 회차보다 평균이 0.5 넘게 내려간 학생
export function selfWatch(now: SelfAnswer[], before: SelfAnswer[]): { no: number; why: string[] }[] {
  const out: { no: number; why: string[] }[] = [];
  for (const a of now) {
    const why: string[] = [];
    const s = selfComps(a.answers);
    const low = SEL_COMPS.filter((_, c) => s[c] === 1).map((c) => c.name);
    if (low.length) why.push(`${low.join(" · ")}: 두 문항 모두 「아니에요」`);
    const b = before.find((x) => x.no === a.no);
    if (b) {
      const d = r2(mean(a.answers)! - mean(b.answers)!);
      if (d < -0.5) why.push(`지난 회차보다 평균 ${Math.abs(d)}점 내려감`); // 「0.5 넘게」: 딱 0.5는 넣지 않음
    }
    if (why.length) out.push({ no: a.no, why });
  }
  return out.sort((x, y) => x.no - y.no);
}
