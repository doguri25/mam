// 학급 역량 진단(학생 화면 이름: 「마음 점검」): 학생이 스스로 32문장(4개 영역 × 8)에 5단계로 답한다.
// 한국형 사회정서교육 교육과정의 성취기준·내용체계와 한국교육과정평가원 사회정서역량 검사도구(KICE, 2024)를 근거로
// 마음빛이음 교사연구회가 만든 교육적 참고도구(표준화·신뢰도 검증 전). 점수는 선생님만 보고, 학생에게는 영역별 이야기와 해 볼 일만 보인다.
// 회차는 meta/selfRounds 문서 하나, 학생 답은 학생마다 meta/self_<회차>_<번호>, 선생님 관찰·메모·피드백은 meta/selnote_<회차>_<번호>
// (여럿이 동시에 내도 서로 덮지 않고, 선생님만 보는 메모가 학생 답 문서에 섞이지 않게 따로 둔다).
import type { Lang } from "./i18n.ts";

type Text = Record<Lang, string>;
export type Tier = "high" | "mid" | "low";

export const DOMAINS = [
  { key: "self", name: "자기인식·관리", color: "#5a4cc4", icon: "sprout", text: { ko: "자기인식·관리", en: "Knowing and managing myself", zh: "认识和管理自己", vi: "Hiểu và làm chủ bản thân", ja: "じぶんを 知って ととのえる" } },
  { key: "talk", name: "소통·협력", color: "#1f66b0", icon: "friends", text: { ko: "소통·협력", en: "Talking and working together", zh: "沟通与合作", vi: "Giao tiếp và hợp tác", ja: "つたえあい・きょうりょく" } },
  { key: "resp", name: "책임", color: "#b5431f", icon: "star", text: { ko: "책임", en: "Responsibility", zh: "责任", vi: "Trách nhiệm", ja: "せきにん" } },
  { key: "care", name: "마음돌봄", color: "#17775a", icon: "heart", text: { ko: "마음돌봄", en: "Caring for my heart", zh: "照顾心灵", vi: "Chăm sóc tâm hồn", ja: "こころを たいせつに" } },
] as const;
export const PER = 8; // 영역마다 문장 수(1~8 자기인식·관리, 9~16 소통·협력, 17~24 책임, 25~32 마음돌봄)

const T = (ko: string, en: string, zh: string, vi: string, ja: string): Text => ({ ko, en, zh, vi, ja });
export const SELF_ITEMS: readonly Text[] = [
  T("나는 내가 잘하는 것과 잘 못하는 것을 알고 있다.", "I know what I am good at and what I am not so good at.", "我知道自己擅长什么、不擅长什么。", "Em biết mình giỏi điều gì và chưa giỏi điều gì.", "じぶんが とくいな ことと にがてな ことを 知って います。"),
  T("나는 내가 소중하게 생각하는 것이 무엇인지 알고 있다.", "I know what is important to me.", "我知道什么对自己来说很珍贵。", "Em biết điều gì là quý giá với mình.", "じぶんが たいせつに して いる ことが なにか 知って います。"),
  T("나는 내 감정에 이름을 붙이고 말할 수 있다. (예: 기쁨, 슬픔, 화남, 걱정)", "I can name my feelings and say them. (e.g., happy, sad, angry, worried)", "我能说出自己心情的名字。（例如：开心、难过、生气、担心）", "Em có thể gọi tên cảm xúc của mình và nói ra. (Ví dụ: vui, buồn, giận, lo lắng)", "じぶんの きもちに 名前を つけて 言えます。(れい: うれしい、かなしい、おこっている、しんぱい)"),
  T("나는 내가 화가 나거나 속상할 때 그 마음을 알아차린다.", "I notice when I am angry or upset.", "我生气或难过的时候，能察觉到自己的心情。", "Em nhận ra khi mình đang giận hay buồn.", "おこったり かなしかったり する とき、その きもちに 気づきます。"),
  T("나는 화가 날 때 마음을 가라앉히는 방법을 사용한다. (예: 깊게 숨 쉬기, 잠시 자리 피하기)", "When I am angry, I use ways to calm down. (e.g., deep breaths, stepping away for a moment)", "生气时，我会用让自己平静下来的方法。（例如：深呼吸、暂时离开一下）", "Khi giận, em dùng cách để bình tĩnh lại. (Ví dụ: hít thở sâu, tạm tránh ra một chút)", "おこった とき、きもちを おちつける ほうほうを つかいます。(れい: ふかく いきを する、すこし その ばを はなれる)"),
  T("나는 화가 나도 친구에게 상처 주는 말이나 행동을 참으려 노력한다.", "Even when I am angry, I try not to say or do hurtful things to my friends.", "即使生气，我也努力忍住，不说伤害朋友的话、不做伤害朋友的事。", "Dù đang giận, em cố gắng không nói hay làm điều làm bạn tổn thương.", "おこっても、ともだちを きずつける ことばや こうどうを がまん しようと します。"),
  T("나는 이루고 싶은 목표가 있으면 무엇을 할지 계획을 세운다.", "When I have a goal, I make a plan for what to do.", "有想实现的目标时，我会计划要做些什么。", "Khi có mục tiêu muốn đạt, em lập kế hoạch cần làm gì.", "かなえたい もくひょうが あると、なにを するか けいかくを 立てます。"),
  T("나는 내가 세운 계획대로 잘 되고 있는지 중간에 확인한다.", "Along the way, I check whether my plan is going well.", "我会在中途检查计划进行得顺不顺利。", "Giữa chừng, em kiểm tra xem kế hoạch của mình có đang ổn không.", "立てた けいかくの とおりに できて いるか、とちゅうで たしかめます。"),

  T("나는 친구가 말할 때 끝까지 귀 기울여 듣는다.", "When a friend is talking, I listen carefully until they finish.", "朋友说话时，我会认真听到最后。", "Khi bạn nói, em chăm chú lắng nghe đến hết.", "ともだちが はなす とき、さいごまで よく ききます。"),
  T("나는 친구의 마음을 이해하려고 노력한다.", "I try to understand how my friends feel.", "我努力去理解朋友的心情。", "Em cố gắng hiểu cảm xúc của bạn.", "ともだちの きもちを わかろうと します。"),
  T("나는 내 생각과 감정을 친구들에게 적절하게 표현한다.", "I share my thoughts and feelings with my friends in a good way.", "我能恰当地向朋友表达自己的想法和感受。", "Em bày tỏ suy nghĩ và cảm xúc của mình với bạn một cách phù hợp.", "じぶんの かんがえや きもちを ともだちに ちょうど よく つたえます。"),
  T("나는 친구와 생각이 달라도 친구의 생각을 존중한다.", "Even when a friend thinks differently, I respect their ideas.", "即使和朋友想法不同，我也尊重朋友的想法。", "Dù suy nghĩ khác bạn, em vẫn tôn trọng ý kiến của bạn.", "ともだちと かんがえが ちがっても、ともだちの かんがえを たいせつに します。"),
  T("나는 친구와 다투었을 때 서로의 이야기를 듣고 해결 방법을 찾으려 한다.", "When I argue with a friend, we listen to each other and try to find a way to solve it.", "和朋友吵架时，我会听听彼此的想法，努力找到解决的办法。", "Khi cãi nhau với bạn, em lắng nghe nhau và cố tìm cách giải quyết.", "ともだちと けんか した とき、おたがいの はなしを きいて、かいけつの ほうほうを さがそうと します。"),
  T("나는 나와 다른 점(생김새, 말투, 생각, 생활 방식 등)이 있는 친구도 존중한다.", "I respect friends who are different from me (looks, way of talking, ideas, way of life, and more).", "对和我不一样（长相、说话方式、想法、生活方式等）的朋友，我也会尊重。", "Em tôn trọng cả những bạn khác mình (ngoại hình, cách nói, suy nghĩ, cách sống...).", "じぶんと ちがう ところ(見た目、話し方、かんがえ、くらし方 など)が ある ともだちも たいせつに します。"),
  T("나는 모둠 활동에서 역할을 나누어 함께 활동한다.", "In group work, we share the jobs and work together.", "在小组活动中，我会和大家分工合作。", "Trong hoạt động nhóm, em chia việc và cùng làm với các bạn.", "グループ かつどうで、やくわりを 分けて いっしょに かつどう します。"),
  T("나는 모둠이나 학급 활동에서 친구들과 의견을 나누며 함께 결정한다.", "In group or class activities, I share ideas with my friends and we decide together.", "在小组或班级活动中，我会和同学交流意见，一起做决定。", "Trong hoạt động nhóm hay của lớp, em trao đổi ý kiến với các bạn và cùng quyết định.", "グループや クラスの かつどうで、ともだちと いけんを 出しあって いっしょに きめます。"),

  T("나는 다른 사람과 한 약속을 지키려 한다.", "I try to keep the promises I make to others.", "我会努力遵守和别人的约定。", "Em cố gắng giữ lời hứa với người khác.", "ほかの 人と した やくそくを まもろうと します。"),
  T("나는 학급에서 정한 규칙을 스스로 지키려 한다.", "I try to follow our class rules on my own.", "我会主动遵守班级定下的规则。", "Em tự giác giữ những quy định của lớp.", "クラスで きめた きまりを じぶんから まもろうと します。"),
  T("나는 행동하기 전에 그 행동이 나와 다른 사람에게 어떤 영향을 줄지 생각한다.", "Before I act, I think about how it will affect me and others.", "行动之前，我会想一想这样做会给自己和别人带来什么影响。", "Trước khi làm, em nghĩ việc đó sẽ ảnh hưởng thế nào đến mình và người khác.", "こうどう する まえに、それが じぶんや ほかの 人に どう えいきょう するか かんがえます。"),
  T("나는 잘못한 일이 있을 때 바로잡으려고 노력한다.", "When I do something wrong, I try to make it right.", "做错事时，我会努力改正。", "Khi làm sai, em cố gắng sửa lại.", "まちがえた ことが ある とき、なおそうと します。"),
  T("나는 맡은 일을 다른 사람이 시키지 않아도 스스로 한다.", "I do my jobs by myself, even when no one tells me to.", "即使没人叫我，我也会主动做好自己负责的事。", "Em tự làm việc được giao mà không cần ai nhắc.", "まかされた ことは、だれかに 言われなくても じぶんで します。"),
  T("나는 내 선택이나 행동의 결과를 받아들이고 책임지려 한다.", "I accept the results of my choices and actions and take responsibility for them.", "我会接受自己的选择和行为带来的结果，并承担责任。", "Em chấp nhận kết quả của lựa chọn và việc làm của mình, và chịu trách nhiệm.", "じぶんで えらんだ ことや した ことの けっかを うけとめて、せきにんを もとうと します。"),
  T("나는 우리 반을 위해 필요한 일에 스스로 참여한다.", "I join in on my own when something needs to be done for our class.", "为了我们班，需要做的事我会主动参与。", "Em tự nguyện tham gia những việc cần làm cho lớp mình.", "クラスの ために ひつような ことに、じぶんから さんか します。"),
  T("나는 주변에 도움이 필요한 사람이 있으면 내가 할 수 있는 방법으로 돕는다.", "When someone near me needs help, I help in the ways I can.", "身边有人需要帮助时，我会用自己能做到的方式帮忙。", "Khi có người xung quanh cần giúp, em giúp theo cách mình có thể.", "まわりに こまって いる 人が いたら、じぶんに できる ほうほうで たすけます。"),

  T("나는 슬프거나 속상한 마음도 소중한 내 마음이라고 생각한다.", "I think my sad or upset feelings are also precious parts of me.", "我觉得难过或伤心的心情，也是我珍贵的心情。", "Em nghĩ cảm xúc buồn hay tủi thân cũng là cảm xúc quý giá của mình.", "かなしい きもちや つらい きもちも、たいせつな じぶんの きもちだと 思います。"),
  T("나는 속상한 일이 있어도 시간이 지나면 다시 괜찮아진다.", "Even when something upsets me, I feel okay again after a while.", "即使遇到伤心的事，过一段时间我也会好起来。", "Dù có chuyện buồn, sau một thời gian em lại thấy ổn.", "いやな ことが あっても、じかんが たつと また げんきに なります。"),
  T("나는 어려운 일이 생겨도 잘 해낼 수 있다고 믿는다.", "Even when something is hard, I believe I can do it.", "即使遇到困难，我也相信自己能做好。", "Dù gặp việc khó, em tin mình có thể làm tốt.", "むずかしい ことが あっても、うまく できると しんじて います。"),
  T("나는 힘들 때 믿을 수 있는 어른이나 친구에게 도움을 요청할 수 있다.", "When things are hard, I can ask a grown-up or a friend I trust for help.", "遇到困难时，我能向信任的大人或朋友求助。", "Khi gặp khó khăn, em có thể nhờ người lớn hoặc bạn mà em tin tưởng giúp đỡ.", "つらい とき、しんじられる 大人や ともだちに 「たすけて」と 言えます。"),
  T("나는 나 자신을 소중하게 생각한다.", "I treat myself as someone precious.", "我很珍惜自己。", "Em trân trọng bản thân mình.", "じぶんの ことを たいせつに 思って います。"),
  T("나는 친구가 힘들어 보이면 먼저 다가가 위로의 말을 건넨다.", "When a friend seems to be having a hard time, I go to them first and say kind words.", "朋友看起来很难受时，我会主动走过去说安慰的话。", "Khi thấy bạn có vẻ buồn hay mệt mỏi, em chủ động đến gần và nói lời an ủi.", "ともだちが つらそうな とき、じぶんから ちかづいて やさしい ことばを かけます。"),
  T("나는 마음이 힘들 때 나를 스스로 위로할 수 있다. (예: 나에게 '괜찮아'라고 말해 주기)", "When my heart feels heavy, I can comfort myself. (e.g., telling myself \"It's okay\")", "心里难受时，我能自己安慰自己。（例如：对自己说“没关系”）", "Khi lòng thấy nặng nề, em có thể tự an ủi mình. (Ví dụ: tự nói với mình \"Không sao đâu\")", "こころが つらい とき、じぶんで じぶんを なぐさめられます。(れい: じぶんに 「だいじょうぶ」と 言う)"),
  T("나는 마음을 건강하게 지키는 생활 습관이 있다. (예: 푹 자기, 몸 움직이기, 쉬는 시간 갖기)", "I have habits that keep my heart healthy. (e.g., sleeping well, moving my body, taking breaks)", "我有让心情保持健康的生活习惯。（例如：睡好觉、活动身体、留出休息时间）", "Em có thói quen giúp tâm hồn khỏe mạnh. (Ví dụ: ngủ ngon, vận động, dành thời gian nghỉ ngơi)", "こころを げんきに たもつ せいかつの しゅうかんが あります。(れい: よく ねる、からだを うごかす、休む じかんを とる)"),
];
export const domainOfItem = (i: number) => Math.floor(i / PER);

// 답: 1 전혀 그렇지 않아요 ~ 5 매우 그래요
export const SELF_SCALE: readonly Text[] = [
  T("전혀 그렇지 않아요", "Not at all", "完全不是这样", "Hoàn toàn không đúng", "ぜんぜん そうじゃない"),
  T("그렇지 않아요", "Not really", "不是这样", "Không đúng", "あまり そうじゃない"),
  T("보통이에요", "In between", "一般", "Bình thường", "ふつう"),
  T("그래요", "Yes", "是这样", "Đúng", "そうだよ"),
  T("매우 그래요", "Very much", "非常是这样", "Rất đúng", "とても そうだよ"),
];

export interface SelfRound {
  id: string;
  title: string; // 학기 초 · 학기 말 · 선생님이 쓴 이름
  openedAt: string; // YYYY-MM-DD
  closedAt: string | null; // 닫으면 학생 화면에서 사라진다(보내 놓은 피드백을 아직 안 읽었으면 그것만 보인다)
  teacherOnly?: boolean; // 학생 화면에 열지 않고 선생님 관찰 검사만 하려고 만든 회차(닫힌 채로 만든다 — 「학생 화면에도 열기」를 누르면 지운다)
  demo?: boolean;
}
export interface SelfAnswer {
  kind: "selfAnswer";
  round: string;
  no: number;
  answers: number[]; // 32개, 1~5
  at: string;
  demo?: boolean;
}
// 선생님 관찰(간이 16 · 심층 32문항, 5단계)
export interface SelObs { mode: 16 | 32; answers: number[] }
// 선생님 쪽 기록: 관찰 · 종이로 한 학생 점수 · 선생님만 보는 메모 · 학생에게 보낸 피드백(학생이 읽은 시각)
export interface SelNote {
  kind: "selNote";
  round: string;
  no: number;
  obs?: SelObs | null;
  paper?: number[] | null; // 종이 검사지로 한 학생: 영역별 점수 4개(8~40)
  memo?: string; // 선생님만 — 학생 화면·AI로 보내지 않는다
  feedback?: { text: string; at: string } | null;
  seenAt?: string | null; // 학생이 피드백을 읽은 시각
  at: string; // 선생님이 마지막으로 고친 시각
  demo?: boolean;
}
export const selfDocId = (round: string, no: number) => `self_${round}_${no}`;
export const selNoteId = (round: string, no: number) => `selnote_${round}_${no}`;

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);
export function cleanSelfAnswers(x: unknown): number[] | null {
  const a = Array.isArray(x) ? x.map(int) : [];
  return a.length === SELF_ITEMS.length && a.every((v) => v >= 1 && v <= 5) ? a : null;
}
export function cleanObs(x: unknown): SelObs | null {
  const o = x as { mode?: unknown; answers?: unknown } | null;
  const mode = o?.mode === 16 || o?.mode === 32 ? o.mode : null;
  const a = Array.isArray(o?.answers) ? o.answers.map(int) : [];
  return mode && a.length === mode && a.every((v) => v >= 1 && v <= 5) ? { mode, answers: a } : null;
}
export function cleanPaper(x: unknown): number[] | null {
  const a = Array.isArray(x) ? x.map(int) : [];
  return a.length === DOMAINS.length && a.every((v) => v >= PER && v <= PER * 5) ? a : null;
}

// 영역별 합(8~40). 관찰은 간이 4문항(4~20)·심층 8문항(8~40)
export function domainScores(answers: number[]): number[] {
  return DOMAINS.map((_, d) => answers.slice(d * PER, d * PER + PER).reduce((s, v) => s + v, 0));
}
export function obsScores(o: SelObs): number[] {
  const per = o.mode / DOMAINS.length;
  return DOMAINS.map((_, d) => o.answers.slice(d * per, d * per + per).reduce((s, v) => s + v, 0));
}
export const obsMax = (o: SelObs) => (o.mode === 32 ? 40 : 20);

// 수준: 만점에 대한 비율 85% 이상 아주 잘함 · 65% 이상 잘함 · 45% 이상 자라나는 중 · 그 아래 도움 필요
export const LEVELS = [
  { min: 85, name: "아주 잘함", tier: "high", color: "#1d7144", bg: "#e3f4e8" },
  { min: 65, name: "잘함", tier: "mid", color: "#1f5fa8", bg: "#e4eefa" },
  { min: 45, name: "자라나는 중", tier: "mid", color: "#85560a", bg: "#fbefd6" },
  { min: 0, name: "도움 필요", tier: "low", color: "#b8352d", bg: "#fbe5e2" },
] as const;
export type Level = (typeof LEVELS)[number];
export const pctOf = (score: number, max = 40) => Math.round((score / max) * 100);
export const levelOf = (score: number, max = 40): Level => LEVELS.find((l) => (score / max) * 100 >= l.min) ?? LEVELS[3];
export const tierOf = (score: number, max = 40): Tier => levelOf(score, max).tier;

// 학생의 영역별 점수: 화면에서 답했으면 그 답, 아니면 선생님이 넣은 종이 검사 점수
export const scoresOf = (answer: SelfAnswer | null | undefined, note: SelNote | null | undefined) =>
  answer && cleanSelfAnswers(answer.answers) ? domainScores(answer.answers) : note?.paper && cleanPaper(note.paper) ? note.paper : null;
// 학생이 아직 읽지 않은 피드백인가
export const unread = (n: SelNote | null | undefined) => !!n?.feedback && (!n.seenAt || n.seenAt < n.feedback.at);

// 먼저 이야기 나눠 볼 학생(진단이 아닌 살펴보기 신호): 도움 필요 영역 · 견준 회차보다 6점 넘게 내려간 영역 ·
// 스스로 답한 것과 선생님 관찰이 크게(35%p 넘게) 다른 영역
export function selWatch(scores: number[], before: number[] | null, obs: SelObs | null | undefined): string[] {
  const why: string[] = [];
  const low = DOMAINS.filter((_, d) => levelOf(scores[d]).tier === "low").map((x) => x.name);
  if (low.length) why.push(`${low.join(" · ")} 도움 필요`);
  if (before) {
    const drop = DOMAINS.flatMap((x, d) => (before[d] - scores[d] > 6 ? [`${x.name} ${before[d] - scores[d]}점`] : []));
    if (drop.length) why.push(`견준 회차보다 내려감(${drop.join(", ")})`);
  }
  if (obs) {
    const o = obsScores(obs), max = obsMax(obs);
    const gap = DOMAINS.flatMap((x, d) => {
      const g = pctOf(scores[d]) - pctOf(o[d], max);
      return Math.abs(g) > 35 ? [`${x.name}(${g > 0 ? "학생이 더 높게" : "선생님 관찰이 더 높게"})`] : [];
    });
    if (gap.length) why.push(`스스로 본 모습과 관찰이 다름: ${gap.join(", ")}`);
  }
  return why;
}

// ── 학생 화면: 영역별 이야기와 해 볼 일(점수·수준 이름은 보이지 않는다) ──
type Story = { desc: Text; tips: Text[] };
const S = (desc: Text, ...tips: Text[]): Story => ({ desc, tips });
export const STUDENT_GUIDE: readonly Record<Tier, Story>[] = [
  {
    high: S(
      T("나의 감정과 강점을 잘 알고, 힘든 상황에서도 스스로를 조절할 수 있어요. 목표를 세우고 꾸준히 실천하는 멋진 힘을 가지고 있어요!", "You know your feelings and strengths well, and you can calm yourself even in hard moments. You have a great power to set goals and keep working on them!", "你很了解自己的心情和长处，在困难的时候也能调节自己。你有设定目标并坚持去做的了不起的力量！", "Em hiểu rõ cảm xúc và điểm mạnh của mình, và tự điều chỉnh được ngay cả lúc khó khăn. Em có sức mạnh tuyệt vời để đặt mục tiêu và kiên trì thực hiện!", "じぶんの きもちや つよみを よく 知って いて、たいへんな ときも じぶんを ととのえられます。もくひょうを 立てて こつこつ がんばる すてきな 力を もって いますね!"),
      T("기쁨·슬픔·화남·걱정 외에 더 다양한 감정을 탐색해 보세요", "Explore more feelings beyond happy, sad, angry and worried.", "除了开心、难过、生气、担心，再去发现更多不同的心情吧。", "Hãy tìm hiểu thêm nhiều cảm xúc khác ngoài vui, buồn, giận, lo lắng.", "うれしい・かなしい・おこる・しんぱい いがいの いろいろな きもちも さがして みよう。"),
      T("어려운 목표를 세우고 중간에 점검하는 습관을 만들어 보세요", "Set a harder goal and make a habit of checking how it's going.", "试着定一个有挑战的目标，养成中途检查的习惯。", "Hãy đặt một mục tiêu khó hơn và tập thói quen kiểm tra giữa chừng.", "むずかしい もくひょうを 立てて、とちゅうで たしかめる しゅうかんを つくって みよう。"),
      T("친구에게 감정 조절 방법을 알려주는 역할을 해보세요", "Try showing a friend ways to calm down.", "试着教朋友调节心情的方法。", "Hãy thử chỉ cho bạn cách giữ bình tĩnh.", "ともだちに きもちを おちつける ほうほうを 教えて あげよう。"),
    ),
    mid: S(
      T("기본적인 감정 조절 능력은 갖추고 있어요. 가끔 힘든 상황에서 감정이 앞설 수 있지만, 조금씩 연습하면 더 잘할 수 있어요!", "You already know the basics of handling your feelings. Sometimes feelings rush ahead in hard moments, but a little practice will help you do even better!", "你已经有调节心情的基本能力。困难的时候，有时心情会抢先一步，但一点点练习就能做得更好！", "Em đã có khả năng cơ bản để điều chỉnh cảm xúc. Đôi khi lúc khó khăn cảm xúc có thể đi trước, nhưng luyện tập từng chút em sẽ làm tốt hơn!", "きもちを ととのえる きほんの 力は もって います。たいへんな とき、きもちが さきに 出て しまう ことも あるけど、すこしずつ れんしゅう すれば もっと できるように なるよ!"),
      T("하루에 한 번 \"오늘 나의 감정은?\" 적어보기", "Once a day, write down \"How do I feel today?\"", "每天写一次“我今天的心情是？”", "Mỗi ngày một lần, viết ra \"Hôm nay mình cảm thấy thế nào?\"", "1日 1かい 「きょうの わたしの きもちは?」と 書いて みよう。"),
      T("화가 날 때 10까지 세거나 깊게 숨 쉬어 보기", "When you get angry, count to 10 or take deep breaths.", "生气时，数到10或者深呼吸。", "Khi giận, hãy đếm đến 10 hoặc hít thở thật sâu.", "おこった ときは 10まで かぞえたり、ふかく いきを したり して みよう。"),
      T("작은 목표를 세우고 달성했을 때 스스로를 칭찬해 주세요", "Set a small goal, and praise yourself when you reach it.", "定一个小目标，做到了就表扬自己。", "Hãy đặt mục tiêu nhỏ và tự khen mình khi đạt được.", "小さな もくひょうを 立てて、できたら じぶんを ほめて あげよう。"),
    ),
    low: S(
      T("아직 감정을 알아차리거나 조절하는 게 어렵게 느껴질 수 있어요. 괜찮아요! 조금씩 연습하면 충분히 성장할 수 있어요.", "Noticing and handling your feelings may still feel hard. That's okay! With a little practice at a time, you can really grow.", "察觉和调节心情，现在可能还觉得有点难。没关系！一点一点练习，你一定能成长。", "Việc nhận ra và điều chỉnh cảm xúc có thể vẫn còn khó với em. Không sao đâu! Luyện tập từng chút, em hoàn toàn có thể lớn lên.", "きもちに 気づいたり ととのえたり するのは、まだ むずかしく かんじるかも しれません。だいじょうぶ! すこしずつ れんしゅう すれば ちゃんと そだって いけるよ。"),
      T("기쁨·슬픔·화남·걱정, 4가지 감정부터 천천히 익혀보기", "Start slowly with four feelings: happy, sad, angry, worried.", "先从开心、难过、生气、担心这4种心情慢慢学起。", "Hãy bắt đầu từ từ với 4 cảm xúc: vui, buồn, giận, lo lắng.", "うれしい・かなしい・おこる・しんぱい、4つの きもちから ゆっくり おぼえよう。"),
      T("화가 나면 선생님이나 부모님께 먼저 이야기해 보세요", "When you get angry, talk to your teacher or your family first.", "生气时，先和老师或爸爸妈妈说一说。", "Khi giận, hãy kể với thầy cô hoặc bố mẹ trước nhé.", "おこったら、まず 先生や おうちの 人に はなして みよう。"),
      T("오늘 잘한 것 1가지를 매일 찾아보는 습관 만들기", "Make a habit of finding one thing you did well every day.", "养成每天找一件今天做得好的事的习惯。", "Tập thói quen mỗi ngày tìm 1 điều mình đã làm tốt.", "まいにち 「きょう よく できた こと」を 1つ さがす しゅうかんを つくろう。"),
    ),
  },
  {
    high: S(
      T("친구의 말을 잘 듣고 내 생각도 잘 표현해요. 갈등이 생겨도 대화로 해결하려는 성숙한 모습이 멋져요!", "You listen well to friends and share your own ideas well, too. It's great how you try to solve conflicts by talking!", "你很会听朋友说话，也能好好表达自己的想法。有矛盾时也努力用对话解决，真棒！", "Em lắng nghe bạn rất tốt và cũng bày tỏ suy nghĩ của mình rất tốt. Em cố gắng giải quyết mâu thuẫn bằng cách trò chuyện, thật tuyệt!", "ともだちの はなしを よく きいて、じぶんの かんがえも じょうずに つたえられます。ぶつかった ときも はなしあいで かいけつ しようと する すがたが すてきです!"),
      T("토론이나 협동 프로젝트에 적극적으로 참여해 보세요", "Take an active part in discussions and team projects.", "积极参加讨论和合作项目吧。", "Hãy tích cực tham gia thảo luận và dự án nhóm.", "はなしあいや きょうりょく する かつどうに どんどん さんか しよう。"),
      T("다른 친구들이 의견을 말할 수 있도록 기회를 만들어 주세요", "Make chances for other friends to share their ideas.", "给其他同学创造说出意见的机会。", "Hãy tạo cơ hội để các bạn khác nói lên ý kiến.", "ほかの ともだちも いけんを 言えるように チャンスを つくって あげよう。"),
      T("친구들 사이에서 갈등을 도와주는 역할을 해보세요", "Try helping friends sort out their conflicts.", "试着在同学之间帮忙化解矛盾。", "Hãy thử giúp các bạn giải quyết mâu thuẫn.", "ともだちどうしの もめごとを たすける やくを して みよう。"),
    ),
    mid: S(
      T("친구와 대화하고 함께 활동하는 능력이 있어요. 가끔 의견이 다를 때 감정이 앞설 수 있는데, 조금만 더 연습해봐요!", "You can talk with friends and do things together. Sometimes feelings rush ahead when ideas differ, so let's practice a little more!", "你能和朋友交流、一起活动。有时意见不同，心情会抢先一步，再多练习一点吧！", "Em có khả năng trò chuyện và cùng hoạt động với bạn. Đôi khi ý kiến khác nhau thì cảm xúc có thể đi trước, mình luyện tập thêm một chút nhé!", "ともだちと はなしたり いっしょに かつどう したり する 力が あります。いけんが ちがう とき、きもちが さきに 出る ことも あるから、もう すこし れんしゅう して みよう!"),
      T("\"나는 ~할 때 ~한 기분이야\"라고 내 감정을 표현해 보세요", "Share your feelings like this: \"When ___, I feel ___.\"", "试着这样表达心情：“当……的时候，我觉得……”", "Hãy nói cảm xúc của mình như: \"Khi ___, mình cảm thấy ___.\"", "「〜の とき、〜な きもちに なるよ」と じぶんの きもちを つたえて みよう。"),
      T("친구 말을 듣고 한 문장으로 반복해 주는 연습을 해보세요", "Practice repeating what your friend said in one sentence.", "练习听完朋友的话，用一句话复述出来。", "Hãy tập nghe bạn nói rồi nhắc lại bằng một câu.", "ともだちの はなしを きいて、1つの 文で くりかえす れんしゅうを しよう。"),
      T("의견이 달라도 \"그렇구나~\" 하고 먼저 인정해 보세요", "Even if you disagree, first say \"I see.\"", "即使意见不同，也先说一句“原来是这样啊”。", "Dù ý kiến khác, hãy nói \"À, ra vậy\" trước nhé.", "いけんが ちがっても、まず 「そうなんだね」と うけとめて みよう。"),
    ),
    low: S(
      T("아직 친구와 대화하거나 협력하는 게 쉽지 않을 수 있어요. 하지만 조금씩 연습하면 분명히 좋아질 거예요!", "Talking or working with friends may not feel easy yet. But with a little practice at a time, it will surely get better!", "和朋友交流、合作，现在可能还不太容易。但是一点点练习，一定会越来越好！", "Trò chuyện hay hợp tác với bạn có thể vẫn chưa dễ với em. Nhưng luyện tập từng chút, chắc chắn sẽ tốt hơn!", "ともだちと はなしたり きょうりょく したり するのは、まだ かんたんじゃ ないかも しれません。でも すこしずつ れんしゅう すれば きっと よく なるよ!"),
      T("먼저 단 한 명의 친구와 짝 활동부터 시작해 보세요", "Start with a pair activity with just one friend.", "先从和一个朋友的两人活动开始吧。", "Hãy bắt đầu từ hoạt động theo cặp với chỉ một người bạn.", "まずは ともだち 1人と ペアの かつどうから はじめて みよう。"),
      T("친구가 말할 때 눈을 보고 고개를 끄덕여 주는 연습을 해보세요", "When a friend talks, practice looking at them and nodding.", "朋友说话时，练习看着他的眼睛点点头。", "Khi bạn nói, hãy tập nhìn bạn và gật đầu.", "ともだちが はなす とき、目を 見て うなずく れんしゅうを しよう。"),
      T("하고 싶은 말이 있으면 선생님께 먼저 말하는 연습을 해보세요", "If you have something to say, practice telling your teacher first.", "有想说的话，先练习跟老师说。", "Nếu có điều muốn nói, hãy tập nói với thầy cô trước.", "言いたい ことが あったら、まず 先生に 言う れんしゅうを しよう。"),
    ),
  },
  {
    high: S(
      T("약속을 잘 지키고 맡은 일을 스스로 해요. 내 행동의 결과를 책임지는 든든한 모습이에요!", "You keep your promises and do your jobs on your own. You take responsibility for what you do, and people can count on you!", "你很守约，自己负责的事会主动做好。为自己的行为负责，真让人放心！", "Em giữ lời hứa và tự làm việc được giao. Em chịu trách nhiệm về việc mình làm, thật đáng tin cậy!", "やくそくを まもって、まかされた ことを じぶんで します。じぶんの した ことに せきにんを もつ、たのもしい すがたです!"),
      T("더 큰 역할(학급 임원, 모둠장)에 도전해 보세요", "Try a bigger role, like class leader or group leader.", "挑战更大的角色吧（班干部、小组长）。", "Hãy thử đảm nhận vai trò lớn hơn (cán bộ lớp, nhóm trưởng).", "もっと 大きな やくわり(がっきゅう いいん、グループの リーダー)に ちょうせん しよう。"),
      T("주변 환경이나 다른 사람을 위해 할 수 있는 일을 찾아보세요", "Look for things you can do for your surroundings or for others.", "找一找能为周围环境或别人做的事。", "Hãy tìm việc em có thể làm cho môi trường xung quanh hoặc cho người khác.", "まわりや ほかの 人の ために できる ことを さがして みよう。"),
      T("친구들이 책임감을 가질 수 있도록 본보기가 되어 주세요", "Be a good example so friends can be responsible too.", "做个好榜样，让同学们也能有责任感。", "Hãy làm gương để các bạn cũng có tinh thần trách nhiệm.", "ともだちも せきにんを もてるように、お手本に なって あげよう。"),
    ),
    mid: S(
      T("기본적인 약속과 규칙은 잘 지켜요. 가끔 어려운 상황에서 흔들릴 수 있지만, 조금 더 노력하면 훨씬 잘할 수 있어요!", "You keep the basic promises and rules well. You might wobble a little in hard situations, but with a bit more effort you can do much better!", "基本的约定和规则你都能遵守。困难的时候有时会动摇，但再努力一点就能做得更好！", "Em giữ tốt những lời hứa và quy định cơ bản. Đôi khi gặp khó em có thể lung lay, nhưng cố gắng thêm một chút em sẽ làm tốt hơn nhiều!", "きほんの やくそくや きまりは よく まもれて います。むずかしい ときに ぐらっと する ことも あるけど、もう すこし がんばれば ずっと よく できるよ!"),
      T("나만의 약속 카드를 만들고 직접 서명해 보세요", "Make your own promise card and sign it yourself.", "做一张自己的约定卡，亲手签上名字。", "Hãy làm một tấm thẻ lời hứa của riêng em và tự ký tên.", "じぶんだけの やくそく カードを つくって、じぶんで サインして みよう。"),
      T("실수했을 때 \"내가 잘못했어, 고칠게\"라고 말하는 연습을 해보세요", "Practice saying \"I made a mistake. I'll fix it.\"", "练习做错时说“是我做错了，我会改正”。", "Hãy tập nói \"Mình làm sai rồi, mình sẽ sửa\" khi mắc lỗi.", "まちがえた とき、「まちがえちゃった、なおすね」と 言う れんしゅうを しよう。"),
      T("모둠 활동에서 맡은 역할을 끝까지 해보세요", "In group work, finish the job you took on.", "在小组活动中，把自己负责的事做到最后。", "Trong hoạt động nhóm, hãy làm vai trò của mình đến cùng.", "グループ かつどうで、まかされた やくわりを さいごまで やって みよう。"),
    ),
    low: S(
      T("아직 규칙을 지키거나 맡은 일을 꾸준히 하는 게 힘들 수 있어요. 아주 작은 것부터 시작하면 충분히 할 수 있어요!", "Following rules or keeping up with your jobs may still be hard. If you start with something very small, you can definitely do it!", "遵守规则、坚持做好负责的事，现在可能还有点难。从很小的事开始，你一定能做到！", "Việc giữ quy định hay làm đều đặn việc được giao có thể vẫn còn khó. Bắt đầu từ việc thật nhỏ, em hoàn toàn làm được!", "きまりを まもったり、まかされた ことを つづけたり するのは、まだ たいへんかも しれません。とても 小さな ことから はじめれば ちゃんと できるよ!"),
      T("아주 작은 역할(예: 창문 담당)부터 성공 경험을 쌓아보세요", "Build up success with a very small job (like being in charge of the windows).", "从很小的任务（比如负责关窗户）开始，积累成功的经验。", "Hãy tích lũy thành công từ việc rất nhỏ (ví dụ: phụ trách cửa sổ).", "とても 小さな やくわり(れい: まど がかり)から 「できた!」を ふやして いこう。"),
      T("잘못했을 때 솔직하게 말하면 오히려 더 용감한 거예요", "Being honest when you make a mistake is actually brave.", "做错时诚实说出来，其实更勇敢。", "Thành thật khi làm sai mới là dũng cảm đó.", "まちがえた ときに しょうじきに 言えるのは、とても ゆうきが ある ことだよ。"),
      T("매일 한 가지 약속(예: 숙제 하기)을 정하고 지켜보세요", "Choose one promise each day (like doing homework) and keep it.", "每天定一个约定（比如写作业），并做到。", "Mỗi ngày hãy chọn một lời hứa (ví dụ: làm bài tập) và giữ nó.", "まいにち 1つ やくそく(れい: しゅくだいを する)を きめて まもって みよう。"),
    ),
  },
  {
    high: S(
      T("나의 마음을 소중히 여기고, 힘든 일이 있어도 잘 회복해요. 친구도 잘 위로하는 따뜻한 마음을 가지고 있어요!", "You treasure your heart and bounce back well even after hard times. You have a warm heart that comforts friends, too!", "你很珍惜自己的心，遇到难过的事也能很好地恢复。你还有一颗会安慰朋友的温暖的心！", "Em trân trọng tâm hồn mình và hồi phục tốt dù gặp chuyện khó. Em còn có trái tim ấm áp biết an ủi bạn bè!", "じぶんの こころを たいせつに して、たいへんな ことが あっても よく 立ちなおれます。ともだちを なぐさめる あたたかい こころも もって いますね!"),
      T("매일 감사한 일 1가지를 적어보는 습관을 만들어 보세요", "Make a habit of writing down one thing you're thankful for each day.", "养成每天写下一件感恩的事的习惯。", "Hãy tập thói quen mỗi ngày viết ra 1 điều em biết ơn.", "まいにち 「ありがとう」と 思った ことを 1つ 書く しゅうかんを つくろう。"),
      T("힘들어하는 친구에게 먼저 다가가 위로해 주세요", "Go to a friend who is having a hard time and comfort them.", "主动去安慰难过的朋友吧。", "Hãy chủ động đến an ủi người bạn đang buồn.", "つらそうな ともだちに じぶんから ちかづいて、なぐさめて あげよう。"),
      T("나를 위한 휴식 방법을 찾아서 자주 활용해 보세요", "Find ways to rest that work for you, and use them often.", "找到适合自己的休息方法，经常用一用。", "Hãy tìm cách nghỉ ngơi phù hợp với mình và dùng thường xuyên.", "じぶんに あった 休み方を 見つけて、よく つかって みよう。"),
    ),
    mid: S(
      T("기본적인 마음 돌봄 능력이 있어요. 가끔 힘들 때 도움 요청이 어려울 수 있는데, 괜찮다는 걸 기억해요!", "You know the basics of caring for your heart. Sometimes it's hard to ask for help when things are tough. Remember, it's okay to ask!", "你有照顾自己心灵的基本能力。难受的时候，有时不好意思求助，记住，求助是没关系的！", "Em có khả năng cơ bản để chăm sóc tâm hồn mình. Đôi khi lúc khó khăn em ngại nhờ giúp đỡ, hãy nhớ là nhờ giúp cũng không sao cả!", "こころを たいせつに する きほんの 力が あります。つらい とき、「たすけて」と 言いにくい ことも あるけど、言っても だいじょうぶだって おぼえて いてね!"),
      T("\"이럴 수도 있어, 괜찮아\"라고 스스로에게 말해 보세요", "Tell yourself, \"This can happen. It's okay.\"", "对自己说：“这也是有可能的，没关系。”", "Hãy tự nói với mình: \"Chuyện này có thể xảy ra, không sao đâu.\"", "じぶんに 「こういう ことも あるよ、だいじょうぶ」と 言って みよう。"),
      T("힘들 때 선생님이나 부모님께 도움을 요청해 보세요", "When things are hard, ask your teacher or your family for help.", "难受的时候，向老师或爸爸妈妈求助吧。", "Khi khó khăn, hãy nhờ thầy cô hoặc bố mẹ giúp đỡ.", "つらい ときは 先生や おうちの 人に 「たすけて」と 言って みよう。"),
      T("내가 좋아하는 것(음악 듣기, 그림 그리기)으로 기분 전환해 보세요", "Lift your mood with things you like (listening to music, drawing).", "用自己喜欢的事（听音乐、画画）换换心情吧。", "Hãy đổi tâm trạng bằng điều em thích (nghe nhạc, vẽ tranh).", "すきな こと(音楽を きく、絵を かく)で きぶんを かえて みよう。"),
    ),
    low: S(
      T("아직 힘든 감정을 받아들이거나 스스로를 위로하는 게 어려울 수 있어요. 하지만 조금씩 연습하면 충분히 성장할 수 있어요.", "Accepting hard feelings or comforting yourself may still be difficult. But with a little practice at a time, you can really grow.", "接受难受的心情、自己安慰自己，现在可能还有点难。但一点一点练习，你一定能成长。", "Việc chấp nhận cảm xúc khó chịu hay tự an ủi mình có thể vẫn còn khó. Nhưng luyện tập từng chút, em hoàn toàn có thể lớn lên.", "つらい きもちを うけとめたり、じぶんを なぐさめたり するのは、まだ むずかしいかも しれません。でも すこしずつ れんしゅう すれば ちゃんと そだって いけるよ。"),
      T("매일 \"오늘 잘한 것\" 1가지를 찾아보세요", "Find one \"thing I did well today\" every day.", "每天找一件“今天做得好的事”。", "Mỗi ngày hãy tìm 1 \"điều hôm nay mình làm tốt\".", "まいにち 「きょう よく できた こと」を 1つ さがそう。"),
      T("힘들면 꼭 선생님이나 부모님께 말해요. 도움 요청은 용감한 행동이에요", "If things are hard, be sure to tell your teacher or your family. Asking for help is brave.", "难受时一定要告诉老师或爸爸妈妈。求助是勇敢的行为。", "Khi khó khăn, nhớ nói với thầy cô hoặc bố mẹ nhé. Nhờ giúp đỡ là việc làm dũng cảm.", "つらい ときは かならず 先生や おうちの 人に 言おうね。たすけを もとめるのは ゆうきの ある ことだよ。"),
      T("좋아하는 것을 하며 쉬는 시간을 만들어 보세요", "Make time to rest by doing something you like.", "做自己喜欢的事，给自己留出休息时间。", "Hãy dành thời gian nghỉ ngơi bằng việc em thích.", "すきな ことを して 休む じかんを つくって みよう。"),
    ),
  },
];
