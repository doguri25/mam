// 감정 단어 놀이 문제(상황 → 알맞은 감정 단어)와 감정 단어 사전의 쉬운 뜻풀이.
// 정답은 모두 NUANCE(더 꼭 맞는 말) 안의 단어라 마음 카드에서 바로 써 볼 수 있다.
import type { Lang } from "./i18n.ts";
import { NUANCE, POLARITY, groupOf } from "./shared.ts";

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
  // 이 단어가 속한 감정 무리(기쁨·평온·슬픔·화남·불안) — 헷갈리지 않게 다른 무리 단어만 보기로.
  // 「피곤해요」(슬픔 무리)와 「그저 그래요」(평온 무리) 낱말은 무리는 달라도 마음 카드에서 함께 「보통」 줄에 놓일 만큼
  // 가까워서(졸려요 ↔ 멍해요, 심심해요 ↔ 기운 없어요) 서로의 보기로도 내지 않는다.
  const parent = (w: string) => Object.keys(NUANCE).find((k) => NUANCE[k].includes(w)) ?? "";
  const near = (a: string, b: string) => {
    const [pa, pb] = [parent(a), parent(b)];
    return groupOf(pa) === groupOf(pb) || (POLARITY[pa] === "mid" && POLARITY[pb] === "mid");
  };
  return [...first, ...rest].slice(0, 5).map((s) => {
    const other = shuffle(all.filter((w) => !near(w, s.answer))).slice(0, 2);
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

// 뜻풀이를 다른 언어로(이주배경학생). 한국어 뜻풀이와 같은 길이로, 그 나라 3학년이 읽을 쉬운 말로.
type Tr = Record<Exclude<Lang, "ko">, string>;
const M = (en: string, zh: string, vi: string, ja: string): Tr => ({ en, zh, vi, ja });
export const MEANING_TR: Record<string, Tr> = {
  뿌듯해요: M("Proud and full inside because you did it", "为自己做到的事骄傲，心里满满的", "Tự hào vì việc mình làm được, lòng thấy đầy ắp", "じぶんが できた ことが じまんで、こころが いっぱいに なる きもち"),
  즐거워요: M("Having fun and laughing a lot", "好玩又开心，忍不住笑出来", "Vui và thú vị đến mức bật cười", "たのしくて おもしろくて わらいが でる きもち"),
  행복해요: M("Very glad and peaceful inside", "心里非常开心又安稳", "Trong lòng rất vui và bình yên", "こころが とても うれしくて おだやかな きもち"),
  설레요: M("Heart racing while waiting for something good", "等着好事发生，心里怦怦跳", "Tim đập rộn ràng khi chờ điều vui", "いいことを まって どきどきする きもち"),
  들떠요: M("So excited it's hard to sit still", "心情飘起来，很难安静坐着", "Háo hức đến mức khó ngồi yên", "きもちが ふわふわして じっと していられない きもち"),
  짜릿해요: M("So excited you tingle all over", "特别兴奋，全身麻酥酥的", "Vui sướng đến rần rần cả người", "とても わくわくして からだじゅう びりびりする きもち"),
  감동했어요: M("Your heart is moved by something kind", "因为暖心的事，心里一阵感动", "Lòng rưng rưng vì một điều tốt đẹp", "うれしい ことに むねが じーんと する きもち"),
  든든해요: M("Strong because someone is by your side", "有人在身边，心里有了力量", "Có người bên cạnh nên thấy vững lòng", "そばに だれかが いて ちからが わく きもち"),
  따뜻해요: M("Your heart feels warm and snug", "心里被暖暖地包围着", "Lòng được sưởi ấm dịu dàng", "こころが ほかほか あたたまる きもち"),
  후련해요: M("Relieved because a worry is over", "担心的事结束了，心里一下子畅快", "Nhẹ người vì chuyện lo lắng đã xong", "しんぱいごとが おわって すっきりした きもち"),
  느긋해요: M("Relaxed, with no need to hurry", "不着急，慢慢悠悠的", "Thong thả, không cần vội", "いそがないで ゆったり している きもち"),
  홀가분해요: M("Light, like putting down a heavy bag", "像放下重担一样轻松", "Nhẹ nhõm như vừa đặt gánh nặng xuống", "おもい にもつを おろしたように かるい きもち"),
  심심해요: M("Nothing to do, so time goes slowly", "没事可做，时间过得好慢", "Không có gì làm nên thời gian trôi chậm", "することが なくて じかんが ゆっくり すぎる きもち"),
  멍해요: M("Your mind feels blank and empty", "什么都想不起来，脑袋空空的", "Đầu óc trống rỗng, không nghĩ được gì", "なにも かんがえられず あたまが からっぽな きもち"),
  무덤덤해요: M("Not really good, not really bad", "说不上喜欢，也说不上讨厌", "Không thích cũng không ghét", "とくに すきでも きらいでも ない きもち"),
  지쳤어요: M("You used so much energy there's none left", "用了太多力气，再也没劲了", "Dùng nhiều sức quá nên hết sức rồi", "ちからを たくさん つかって もう ちからが ない きもち"),
  졸려요: M("Your eyes keep closing and you want to sleep", "眼睛总想闭上，好想睡觉", "Mắt cứ díu lại, muốn đi ngủ", "めが とじてきて ねむりたい きもち"),
  "기운 없어요": M("No energy in your body or heart", "身体和心里都没有力气", "Cả người và lòng đều không còn sức", "からだも こころも ちからが ぬけた きもち"),
  불안해요: M("Can't relax, wondering what might happen", "怕会出什么事，心里放不下", "Không yên lòng, sợ có chuyện xảy ra", "なにか おきそうで おちつかない きもち"),
  긴장돼요: M("Your body is stiff and your heart pounds", "身体僵住，心怦怦直跳", "Người cứng lại, tim đập thình thịch", "からだが かたくなって むねが どきどきする きもち"),
  조마조마해요: M("Nervous that something might go wrong", "怕事情出错，心一直悬着", "Thấp thỏm sợ mọi việc không ổn", "うまく いかないかと はらはらする きもち"),
  겁나요: M("You shrink back, afraid of something scary", "怕有可怕的事，身体缩成一团", "Co người lại vì sợ điều đáng sợ", "こわい ことが おきそうで からだが ちぢこまる きもち"),
  "깜짝 놀랐어요": M("Your heart jumps at something sudden", "突然发生的事，让心猛地一跳", "Tim thót lại vì chuyện bất ngờ", "きゅうな ことに むねが どきっと する きもち"),
  오싹해요: M("A chill runs down your back", "后背一阵发凉", "Lạnh cả sống lưng", "せなかが ぞくっと ひえる きもち"),
  서운해요: M("Let down because someone didn't do what you hoped", "别人没像期待的那样对我，心里不是滋味", "Tủi vì người khác không làm như mình mong", "きたいした ように してもらえず さみしい きもち"),
  외로워요: M("Lonely, like you're all by yourself", "觉得只有自己一个人，冷冷清清的", "Buồn vì thấy như chỉ có một mình", "ひとりぼっちの ようで さみしい きもち"),
  그리워요: M("You keep thinking of someone or a time you miss", "总想起想见的人或从前的时光", "Cứ nhớ đến người hay lúc mình mong gặp lại", "あいたい ひとや むかしの ことを なんども おもいだす きもち"),
  실망했어요: M("Things didn't go as you hoped, so you feel low", "事情没像希望的那样，一下子泄了气", "Mọi việc không như mong đợi nên chán nản", "おもった とおりに ならなくて ちからが ぬける きもち"),
  아쉬워요: M("Wishing you could have had a little more", "心里还想再多一点点", "Vẫn muốn thêm một chút nữa", "もう すこし したかったなと おもう きもち"),
  창피해요: M("Your face gets hot when others see", "怕别人看见，脸上火辣辣的", "Mặt nóng bừng vì sợ người khác thấy", "ひとに みられて かおが かーっと あつくなる きもち"),
  답답해요: M("Your heart feels stuck and blocked up", "心里堵得慌，一点也不痛快", "Trong lòng nghẹn lại, không thoải mái", "こころが つまって すっきりしない きもち"),
  분해요: M("Boiling inside after an unfair loss", "输得不服气，心里直冒火", "Ấm ức sôi sục vì thua không công bằng", "ずるい やりかたで まけて くやしくて たまらない きもち"),
  서러워요: M("So hurt and sad you might cry", "又委屈又难过，快要哭出来", "Tủi thân và buồn đến muốn khóc", "くやしくて かなしくて なみだが でそうな きもち"),
  "짜증 나요": M("Things keep bugging you and you get snappy", "老是不顺心，脾气变得急躁", "Cứ thấy khó chịu nên dễ cáu", "なんども いやな ことが あって とげとげする きもち"),
  "약 올라요": M("Mad because someone is teasing you", "被人捉弄，气得不行", "Bực vì bị ai đó trêu chọc", "からかわれて むっと する きもち"),
  부글부글해요: M("Anger bubbling up inside", "怒气在心里咕嘟咕嘟往上冒", "Cơn giận sôi lên trong lòng", "いかりが おなかの なかで ぐつぐつ わきあがる きもち"),
  흐뭇해요: M("Smiling inside just from looking", "光是看着，心里就甜甜地笑", "Chỉ nhìn thôi cũng mỉm cười mãn nguyện", "みている だけで にっこり してしまう きもち"),
  "자신 있어요": M("Believing you can do it well", "相信自己能做好", "Tin rằng mình làm được", "じぶんは できると しんじる きもち"),
  반가워요: M("Glad to meet someone you wanted to see", "见到想见的人，好高兴", "Vui vì gặp được người mình mong gặp", "あいたかった ひとに あえて うれしい きもち"),
  신기해요: M("Amazed and curious about something new", "第一次见到，觉得又惊奇又有趣", "Ngạc nhiên và thích thú với điều mới", "はじめて みる ことに びっくりして おもしろい きもち"),
  기대돼요: M("Can't wait because something good is coming", "觉得接下来会有好事，很盼望", "Mong chờ vì điều sắp tới sẽ vui", "これからの ことが たのしみで まちきれない きもち"),
  다행이에요: M("Glad that a worry turned out okay", "担心的事平安结束，终于放心了", "Yên tâm vì chuyện lo lắng đã ổn", "しんぱいした ことが ぶじに おわって ほっとする きもち"),
  포근해요: M("Warm and comfy, like being under a blanket", "像在被窝里一样暖和舒服", "Ấm áp dễ chịu như nằm trong chăn", "おふとんの なかみたいに あたたかくて らくな きもち"),
  개운해요: M("Fresh and clean in body and mind", "身心都清爽干净", "Người và lòng đều sảng khoái, sạch sẽ", "からだも こころも さっぱり きれいな きもち"),
  궁금해요: M("Wanting to know more and ask questions", "很想知道更多，总想问问题", "Muốn biết thêm nên cứ muốn hỏi", "もっと しりたくて なんども ききたく なる きもち"),
  헷갈려요: M("Not sure if it's this or that", "分不清是这个还是那个", "Không biết là cái này hay cái kia", "これか あれか よく わからない きもち"),
  어색해요: M("Not used to it, so you feel stiff and shy", "不习惯，动作和说话都变得僵硬", "Chưa quen nên cử chỉ và lời nói cứng lại", "なれなくて からだも ことばも かたくなる きもち"),
  지루해요: M("The same thing goes on and on with no fun", "一直做同样的事，一点意思都没有", "Cứ lặp lại một việc nên chẳng vui", "おなじ ことが つづいて つまらない きもち"),
  차분해요: M("Your heart feels quiet and settled", "心里安安静静、稳稳的", "Lòng lặng yên và điềm tĩnh", "こころが しずかで おちついている きもち"),
  "생각이 많아요": M("Lots of thoughts floating in your head", "脑子里飘着好多想法", "Nhiều suy nghĩ cứ trôi trong đầu", "あたまの なかに いろんな かんがえが うかぶ きもち"),
  괜찮아요: M("Not great, not bad, just okay", "不算好也不算坏，还过得去", "Không tốt lắm cũng không tệ, vẫn ổn", "すごく いいでも わるいでも なく、まあ へいきな きもち"),
  평범해요: M("Just like any other day", "和平常的日子没什么两样", "Giống như mọi ngày", "いつもの ひと かわらない きもち"),
  낯설어요: M("Awkward because the place or people are new", "第一次见的地方或人，觉得不自在", "Ngại ngùng vì nơi chốn hay người còn lạ", "はじめての ばしょや ひとで おちつかない きもち"),
  집중돼요: M("Completely into one thing", "整个心思都投入在一件事上", "Chú tâm hết vào một việc", "ひとつの ことに むちゅうに なっている きもち"),
  귀찮아요: M("Not wanting to do it, putting it off","不想做，想往后拖", "Không muốn làm, muốn để sau", "やりたくなくて あとまわしに したい きもち"),
  바빠요: M("So much to do, no time to rest", "事情太多，没空休息", "Nhiều việc quá, không có lúc nghỉ", "やることが おおくて やすむ ひまが ない きもち"),
  정신없어요: M("Dizzy from too many things at once", "很多事一起来，乱成一团", "Rối tung vì nhiều việc dồn cùng lúc", "いろんな ことが いっぺんに きて あたまが ぐるぐるする きもち"),
  "조용히 있고 싶어요": M("Wanting to rest alone without talking", "不想说话，想一个人静静", "Muốn nghỉ một mình, không nói gì", "はなさないで ひとりで やすみたい きもち"),
  나른해요: M("Your body feels floppy and sleepy", "身体软绵绵的，有点困", "Người rã rời và buồn ngủ", "からだが ぐったりして ねむい きもち"),
  "쉬고 싶어요": M("Wishing you could stop and rest a bit", "希望停下来歇一会儿", "Mong được dừng lại nghỉ một chút", "ちょっと とまって やすみたい きもち"),
};

// 학생 언어의 뜻풀이(한국어 학생은 한국어). 뜻풀이가 없는 말(교과서에서 더한 말)은 빈 글자.
export function meaningOf(lang: Lang, word: string): string {
  return lang === "ko" ? MEANING[word] ?? "" : MEANING_TR[word]?.[lang] ?? "";
}
