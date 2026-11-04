// 감정 단어 놀이 문제(상황 → 알맞은 감정 단어)와 감정 단어 사전의 쉬운 뜻풀이.
// 정답은 모두 NUANCE(더 꼭 맞는 말) 안의 단어라 마음 카드에서 바로 써 볼 수 있다.
import type { Lang } from "./i18n.ts";
import { NUANCE, groupOf } from "./shared.ts";

type Text = Record<Lang, string>;
export interface Situation { answer: string; text: Text }

const S = (answer: string, ko: string, en: string, zh: string, vi: string, ja: string): Situation => ({ answer, text: { ko, en, zh, vi, ja } });

export const SITUATIONS: Situation[] = [
  S("뿌듯해요", "친구가 내 그림을 보고 멋지다고 칭찬해 줬어요.", "A friend said my drawing was amazing.", "朋友看了我的画，夸我画得真棒。", "Bạn khen bức tranh của em thật đẹp.", "ともだちが わたしの えを みて すごいと ほめてくれた。"),
  S("설레요", "내일은 기다리던 소풍 가는 날이에요.", "Tomorrow is the field trip I've been waiting for.", "明天就是我期待已久的郊游。", "Ngày mai là chuyến dã ngoại em mong chờ.", "あしたは まちに まった えんそくの ひ。"),
  S("아쉬워요", "재미있는 놀이가 한창일 때 쉬는 시간이 끝났어요.", "Break time ended right in the middle of a fun game.", "正玩得开心时，课间休息结束了。", "Giờ ra chơi kết thúc khi trò chơi đang vui.", "たのしい あそびの さいちゅうに やすみじかんが おわった。"),
  S("긴장돼요", "발표하려고 앞에 섰는데 가슴이 콩닥콩닥해요.", "I stood up to present and my heart is pounding.", "站到前面准备发言，心怦怦直跳。", "Em đứng lên thuyết trình và tim đập thình thịch.", "はっぴょうしようと まえに たったら どきどきする。"),
  S("답답해요", "내 말을 아무도 끝까지 들어 주지 않아요.", "Nobody listens to me until I finish talking.", "没有人听我把话说完。", "Không ai nghe em nói hết câu.", "だれも さいごまで はなしを きいてくれない。"),
  S("그리워요", "가장 친한 친구가 멀리 전학을 갔어요.", "My best friend moved to a school far away.", "最好的朋友转学去了很远的地方。", "Bạn thân nhất của em đã chuyển trường đi xa.", "いちばんの ともだちが とおくへ てんこうした。"),
  S("감동했어요", "친구가 내 생일을 기억하고 편지를 써 줬어요.", "A friend remembered my birthday and wrote me a letter.", "朋友记得我的生日，还给我写了信。", "Bạn nhớ sinh nhật em và viết thư cho em.", "ともだちが たんじょうびを おぼえていて てがみを くれた。"),
  S("후련해요", "미루던 숙제를 다 끝냈어요.", "I finally finished the homework I kept putting off.", "终于写完了一直拖着的作业。", "Em đã làm xong bài tập cứ để dành mãi.", "あとまわしに していた しゅくだいが ぜんぶ おわった。"),
  S("짜증 나요", "동생이 내가 만든 블록을 또 무너뜨렸어요.", "My little brother knocked down my blocks again.", "弟弟又把我搭的积木弄倒了。", "Em trai lại làm đổ khối xếp hình của em.", "おとうとが わたしの ブロックを また こわした。"),
  S("겁나요", "어두운 복도를 혼자 걸어가야 해요.", "I have to walk down a dark hallway alone.", "我得一个人走过黑黑的走廊。", "Em phải đi một mình qua hành lang tối.", "くらい ろうかを ひとりで あるかなきゃ いけない。"),
  S("외로워요", "놀이 시간에 아무도 같이 놀자고 하지 않았어요.", "Nobody asked me to play at playtime.", "游戏时间没有人邀请我一起玩。", "Giờ chơi không ai rủ em chơi cùng.", "あそびの じかんに だれも さそってくれなかった。"),
  S("심심해요", "비 오는 날, 할 일이 없어 창밖만 보고 있어요.", "It's raining and there's nothing to do but look outside.", "下雨天没事做，只能看着窗外。", "Trời mưa, không có gì làm nên em chỉ nhìn ra cửa sổ.", "あめの ひ、することが なくて まどの そとばかり みている。"),
  S("창피해요", "체육 시간에 넘어졌는데 친구들이 다 봤어요.", "I fell in PE class and everyone saw.", "体育课上我摔倒了，大家都看到了。", "Em bị ngã trong giờ thể dục và mọi người đều thấy.", "たいいくで ころんで みんなに みられた。"),
  S("따뜻해요", "할머니가 오랜만에 꼭 안아 주셨어요.", "Grandma gave me a big hug after a long time.", "好久不见的奶奶紧紧抱住了我。", "Bà ôm chặt em sau một thời gian dài.", "ひさしぶりに おばあちゃんが ぎゅっと だきしめてくれた。"),
  S("졸려요", "늦게 잤더니 아침에 눈이 잘 안 떠져요.", "I went to bed late and can't keep my eyes open this morning.", "睡得太晚，早上眼睛都睁不开。", "Em ngủ muộn nên sáng nay mắt cứ díu lại.", "おそく ねたので あさ めが あかない。"),
];

// 한 판 5문제: 반 감정 단어가 정답인 문제를 먼저, 나머지는 섞어서. 보기 3개(정답 + 다른 감정 무리 단어 2개).
export function makeRound(vocab: string[], seed: number) {
  let x = seed || 1;
  const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const shuffle = <T,>(xs: T[]) => xs.map((v) => [rand(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const first = shuffle(SITUATIONS.filter((s) => vocab.includes(s.answer)));
  const rest = shuffle(SITUATIONS.filter((s) => !vocab.includes(s.answer)));
  const all = Object.values(NUANCE).flat();
  // 이 단어가 속한 감정 무리(기쁨·평온·슬픔·화남·불안) — 헷갈리지 않게 다른 무리 단어만 보기로
  const group = (w: string) => groupOf(Object.keys(NUANCE).find((k) => NUANCE[k].includes(w)) ?? "");
  return [...first, ...rest].slice(0, 5).map((s) => {
    const other = shuffle(all.filter((w) => group(w) !== group(s.answer))).slice(0, 2);
    return { ...s, options: shuffle([s.answer, ...other]) };
  });
}

// 감정 단어 사전 뜻풀이(3학년이 읽을 쉬운 말)
export const MEANING: Record<string, string> = {
  뿌듯해요: "내가 해낸 일이 자랑스러워 마음이 꽉 찬 느낌", 즐거워요: "신나고 재미있어서 웃음이 나는 느낌", 행복해요: "마음이 아주 기쁘고 편안한 느낌",
  설레요: "좋은 일을 기다리며 두근두근하는 느낌", 들떠요: "기분이 붕 떠서 가만히 있기 어려운 느낌", 짜릿해요: "아주 신나서 온몸이 찌릿한 느낌",
  감동했어요: "고마운 일에 마음이 뭉클해지는 느낌", 든든해요: "곁에 누가 있어 힘이 나는 느낌", 따뜻해요: "마음이 포근하게 데워지는 느낌",
  후련해요: "걱정하던 일이 끝나 시원한 느낌", 느긋해요: "서두르지 않고 여유로운 느낌", 홀가분해요: "무거운 짐을 내려놓은 듯 가벼운 느낌",
  심심해요: "할 게 없어 시간이 느리게 가는 느낌", 멍해요: "아무 생각이 안 나고 머리가 빈 느낌", 무덤덤해요: "특별히 좋지도 싫지도 않은 느낌",
  지쳤어요: "힘을 많이 써서 더 할 힘이 없는 느낌", 졸려요: "눈이 자꾸 감기고 자고 싶은 느낌", "기운 없어요": "몸과 마음에 힘이 빠진 느낌",
  불안해요: "무슨 일이 생길까 마음이 놓이지 않는 느낌", 긴장돼요: "몸이 굳고 가슴이 콩닥거리는 느낌", 조마조마해요: "일이 잘못될까 봐 마음 졸이는 느낌",
  겁나요: "무서운 일이 생길까 몸이 움츠러드는 느낌", "깜짝 놀랐어요": "갑자기 생긴 일에 가슴이 철렁한 느낌", 오싹해요: "등골이 서늘해지는 느낌",
  서운해요: "기대한 만큼 해 주지 않아 마음이 섭섭한 느낌", 외로워요: "혼자인 것 같아 쓸쓸한 느낌", 그리워요: "보고 싶은 사람이나 때를 자꾸 떠올리는 느낌",
  실망했어요: "바라던 대로 되지 않아 힘이 빠지는 느낌", 아쉬워요: "조금만 더 했으면 하는 마음이 남는 느낌", 창피해요: "남이 볼까 얼굴이 화끈거리는 느낌",
  답답해요: "마음이 꽉 막혀 시원하지 않은 느낌", 분해요: "억울하게 져서 속이 끓는 느낌", 서러워요: "억울하고 슬퍼서 눈물이 날 것 같은 느낌",
  "짜증 나요": "자꾸 마음에 안 들어 날카로워지는 느낌", "약 올라요": "누가 놀려서 화가 나는 느낌", 부글부글해요: "화가 속에서 끓어오르는 느낌",
  // 마음 남기기 카드에 더한 낱말
  흐뭇해요: "보기만 해도 마음이 흐뭇하게 웃음 짓는 느낌", "자신 있어요": "나는 잘할 수 있다고 믿는 느낌", 반가워요: "보고 싶던 사람을 만나 기쁜 느낌",
  신기해요: "처음 보는 일이 놀랍고 재미있는 느낌", 기대돼요: "앞으로 올 일이 좋을 것 같아 기다려지는 느낌",
  다행이에요: "걱정했던 일이 괜찮게 끝나 마음이 놓이는 느낌", 포근해요: "이불 속처럼 따뜻하고 편한 느낌", 개운해요: "몸과 마음이 상쾌하고 깨끗한 느낌",
  궁금해요: "더 알고 싶어서 자꾸 묻고 싶은 느낌", 헷갈려요: "이것인지 저것인지 잘 모르겠는 느낌", 어색해요: "익숙하지 않아 몸과 말이 굳는 느낌",
  지루해요: "같은 일이 이어져 재미가 없는 느낌", 차분해요: "마음이 조용하고 가라앉아 있는 느낌", "생각이 많아요": "머릿속에 여러 생각이 떠다니는 느낌",
  괜찮아요: "크게 좋지도 나쁘지도 않고 견딜 만한 느낌", 평범해요: "여느 날과 다르지 않은 느낌", 낯설어요: "처음 보는 곳이나 사람이라 어색한 느낌",
  집중돼요: "한 가지에 마음이 쏙 빠져 있는 느낌", 귀찮아요: "하기 싫고 미루고 싶은 느낌", 바빠요: "할 일이 많아 쉴 틈이 없는 느낌",
  정신없어요: "이것저것 한꺼번에 생겨 어지러운 느낌", "조용히 있고 싶어요": "말하지 않고 혼자 쉬고 싶은 느낌",
  나른해요: "몸이 축 늘어지고 졸린 느낌", "쉬고 싶어요": "잠깐 멈추고 쉬면 좋겠는 느낌",
};
