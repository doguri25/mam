// 위험 표현 찾기(matchRisk)와 기본 목록 판 올리기. 실행: node --test lib/
// 선생님이 고른 「넓게 찾기」: 잘못 거는 것은 괜찮지만 놓치면 안 된다. 다만 평범한 말이 터무니없이 걸리지는 않게.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { matchRisk } from "./rules.ts";
import { DEFAULT_RISK_WORDS, RISK_CORE, RISK_WORDS_BY_V, RISK_WORDS_V, riskWordsAfter } from "./shared.ts";

// 설정 판 올리기 시험은 임시 폴더의 로컬 저장소(.data/db.json)만 쓴다
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-risk-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];

const check = (rows: [string, string[]][], words = DEFAULT_RISK_WORDS) => {
  for (const [text, want] of rows) assert.deepEqual(matchRisk(text, words), want, text);
};

test("한국어 말 꼴이 바뀌어도 찾는다(끝 글자 받침, 두 글자 줄기)", () => {
  check([
    ["엄마가 맨날 때린다", ["때린"]],
    ["나를 때린 친구", ["때린"]],
    ["때릴까 봐 무서워요", ["때릴"]],
    ["때림", ["때림"]],
    ["친구들이 괴롭혔어요", ["괴롭혀"]],
    ["괴롭히는 애가 있어요", ["괴롭히"]],
    ["괴롭힘을 당해요", ["괴롭힘"]],
    ["형이 나를 다치게 했어요", ["다치게 해"]],
    ["다치게 함", ["다치게 하"]],
    ["애들이 나만 따돌려요", ["따돌"]],
    ["따돌림을 당했어요", ["따돌"]],
  ]);
});

test("글자 사이에 문장부호·기호·이모지·ㅠㅜ가 끼어도 찾는다", () => {
  for (const text of ["죽고~싶어", "죽고.싶다", "죽고...싶어", "죽고ㅠㅠ싶어", "죽고!싶어", "죽💀고 싶어", "죽고 ㅜㅜ 싶어", "죽 고 싶 어"]) {
    assert.deepEqual(matchRisk(text, DEFAULT_RISK_WORDS), ["죽고 싶"], text);
  }
  assert.deepEqual(matchRisk("사라지고…싶다", DEFAULT_RISK_WORDS), ["사라지고 싶"]);
});

test("아이들이 흔히 쓰는 맞춤법도 찾는다", () => {
  check([
    ["죽구 싶어", ["죽구 싶"]],
    ["죽고시퍼", ["죽고 시퍼"]],
    ["죽구시퍼", ["죽구 시퍼"]],
    ["죽고십어", ["죽고 십"]],
    ["집에 가기 시러", ["집에 가기 시러"]],
    ["살기 시러", ["살기 시러"]],
    ["살고 싶지 않아", ["살고 싶지 않"]],
    ["ㅈㄱㅅㅇ", ["ㅈㄱㅅㅇ"]],
    ["그냥 ㅈ ㄱ ㅅ ㅇ ㅠㅠ", ["ㅈㄱㅅㅇ"]],
  ]);
});

test("일본어는 히라가나·가타카나·반각으로 써도 찾는다", () => {
  check([
    ["しにたい", ["しにたい"]],
    ["もうシニタイ", ["しにたい"]],
    ["ｼﾆﾀｲ", ["しにたい"]],
    ["しんじゃいたい", ["しんじゃいたい"]],
    ["きえたい", ["きえたい"]],
    ["いなくなりたい", ["いなくなりたい"]],
    ["おにいちゃんになぐられた", ["なぐられ"]],
    ["たたかれた", ["たたかれ"]],
    ["ともだちにけられた", ["にけられ"]],
    ["じさつ", ["じさつ"]],
    ["いえにかえりたくない", ["にかえりたくない"]],
    ["うちにかえりたくない", ["にかえりたくない"]],
    ["家に帰りたくない", ["に帰りたくない"]],
    ["イジメられた", ["いじめ"]],
    ["もう死にたい", ["死にたい"]],
  ]);
});

test("영어는 둥근 따옴표·' 없이·전각으로 써도 찾는다", () => {
  check([
    ["I don’t want to go home", ["don't want to go home"]],
    ["I dont want to go home", ["don't want to go home"]],
    ["I DON'T WANT TO GO HOME", ["don't want to go home"]],
    ["I feel suicidal", ["suicid"]],
    ["suicide", ["suicid"]],
    ["i want to kill my self", ["kill my self"]],
    ["ｋｉｌｌ ｍｙｓｅｌｆ", ["kill myself"]],
    ["I want to disappear", ["want to disappear"]],
    ["I don't want to live", ["don't want to live"]],
    ["i dont want to live anymore", ["don't want to live"]],
    ["My brother keeps hitting me", ["hitting me"]],
    ["i want 2 die", ["want 2 die"]],
    ["I want to unalive myself", ["unalive"]],
    ["나bully당했어", ["bully"]],
  ]);
});

test("베트남어는 성조 없이 써도 찾는다(「tu tu」는 빼고)", () => {
  check([
    ["bi danh", ["bị đánh"]],
    ["con bi bat nat", ["bắt nạt"]],
    ["con khong muon ve nha", ["không muốn về nhà"]],
    ["con muon bien mat", ["muốn biến mất"]],
    ["con muon chet", ["muốn chết"]],
    ["Con muon chet, mẹ ơi", ["muốn chết"]], // 한 글에 성조를 친 낱말이 섞여 있어도
    ["con khong muon song nua", ["không muốn sống"]],
    ["Con bị bắt nạt", ["bắt nạt"]],
    ["Con muốn tự tử", ["tự tử"]],
  ]);
});

test("한국어: 남을 해치려는 말·집에 가기 싫은 말·맞은 말·스스로 사라지려는 말(4판)", () => {
  check([
    ["죽이고 싶어", ["죽이고 싶"]],
    ["죽인다", ["죽인다"]],
    ["집 가기 싫어", ["집 가기 싫"]],
    ["집가기싫어", ["집 가기 싫"]],
    ["집에 들어가기 싫어", ["집에 들어가기 싫"]],
    ["집에 가고 싶지 않아", ["집에 가고 싶지 않"]],
    ["집에 안 가고 싶어", ["집에 안 가고 싶"]],
    ["집에 가기 무서워요", ["집에 가기 무서"]],
    ["아빠가 발로 찼어", ["발로 차"]],
    ["형이 발로 차요", ["발로 차"]],
    ["뺨을 맞았어", ["뺨을 맞"]],
    ["매를 맞았어", ["매를 맞"]],
    ["주먹으로 맞았어", ["주먹으로 맞"]],
    ["사는 게 싫어", ["사는 게 싫"]],
    ["살고 싶지가 않아", ["살고 싶지가 않"]],
    ["살기 실어", ["살기 실"]],
    ["집에 가기 실타", ["집에 가기 실"]],
    ["뒤지고 싶어", ["뒤지고 싶"]],
    ["너 뒤질래", ["뒤질래"]],
    ["디지고 싶어", ["디지고 싶"]],
    ["그냥 없어졌으면 좋겠어", ["없어졌으면 좋겠"]],
    ["태어나지 않았으면 좋겠어", ["태어나지 않았으면"]],
    ["반에서 은따 당해요", ["은따"]],
    ["떄려서 아파", ["떄려"]],
  ]);
  // 스스로 해치려는 말은 선생님이 목록을 비워도 찾는다
  for (const text of ["사는 게 싫어", "뒤지고 싶어", "디지고 싶어", "살고 싶지가 않아"]) {
    assert.ok(matchRisk(text, []).length > 0, text);
  }
  // 「없어졌으면 좋겠어」「태어나지 않았으면」은 「숙제가 없어졌으면」 같은 흔한 말에도 걸려 선생님이 뺄 수 있는 기본 목록에 둔다
  for (const text of ["숙제가 없어졌으면 좋겠어", "태어나지 않았으면"]) assert.deepEqual(matchRisk(text, []), [], text);
});

test("중국어: 때린 사람이 끼어도(被…打, 네 글자까지)·죽음·집에 가기 싫은 말", () => {
  check([
    ["爸爸打了我", ["打了我"]],
    ["他们打了我", ["打了我"]],
    ["我被爸爸打了", ["被打"]],
    ["我被他们狠狠打了", ["被打"]],
    ["我被打了", ["被打"]],
    ["我想去死", ["去死"]],
    ["你去死吧", ["去死"]],
    ["死了算了", ["死了算了"]],
    ["活着没意思", ["活着没意思"]],
    ["我不要回家", ["不要回家"]],
    ["我想杀了他", ["想杀"]],
  ]);
  assert.deepEqual(matchRisk("我被老师批评了，然后打扫教室", DEFAULT_RISK_WORDS), []); // 被와 打 사이가 네 글자보다 멀다
});

test("베트남어: bị와 đánh 사이 두 낱말까지, 성조를 일부만 쳐도 찾는다", () => {
  check([
    ["Con bị bố đánh", ["bị đánh"]],
    ["Em bị bạn đánh", ["bị đánh"]],
    ["con bi bo danh", ["bị đánh"]],
    ["Con bị các bạn đánh", ["bị đánh"]],
    ["con muốn chet", ["muốn chết"]],
    ["con muon chết", ["muốn chết"]],
    ["Con muốn chêt", ["muốn chết"]],
    ["con khong muon ve nhà", ["không muốn về nhà"]],
  ]);
  check([
    ["Con bị bố mẹ hay đánh", []], // 세 낱말 넘게 떨어지면 찾지 않는다
    ["Con bí đánh", []], // 다른 성조를 친 「bí」는 「bị」가 아니다
    ["con từ tự", []],
  ]);
});

test("일본어: 늘임표·「〜てしまいたい」·맞은 말·남을 해치려는 말", () => {
  check([
    ["しにたーい", ["しにたい"]],
    ["死にたーい", ["死にたい"]],
    ["きえたーい", ["きえたい"]],
    ["しにたぁい", ["しにたい"]],
    ["もうしにたいよう", ["しにたい"]],
    ["死んじゃいたい", ["死んじゃいたい"]],
    ["ママにぶたれた", ["ぶたれ"]],
    ["しんでしまいたい", ["しんでしまいたい"]],
    ["きえてしまいたい", ["きえてしまいたい"]],
    ["生きていたくない", ["生きていたくない"]],
    ["ころしたい", ["ころしたい"]],
    ["しねっていわれた", ["しねって"]],
    ["おうちかえりたくない", ["うちかえりたくない"]],
    ["死にたくなる", ["死にたく"]],
    ["なかまはずれにされた", ["なかまはずれ"]],
  ]);
});

test("영어: 맞은 말·죽고 싶은 말, do not·wanna도 찾는다", () => {
  check([
    ["my dad punched me", ["punched me"]],
    ["he kicked me", ["kicked me"]],
    ["she slapped me", ["slapped me"]],
    ["they pushed me", ["pushed me"]],
    ["I want to be dead", ["want to be dead"]],
    ["I wish I was dead", ["wish i was dead"]],
    ["I hate my life", ["hate my life"]],
    ["I want to end my life", ["end my life"]],
    ["I don't want to be alive", ["don't want to be alive"]],
    ["i do not want to go home", ["don't want to go home"]],
    ["I don't wanna go home", ["don't want to go home"]],
    ["I DO NOT WANT TO LIVE", ["don't want to live"]],
    ["i wanna die", ["want to die"]],
    ["they make fun of me", ["make fun of me"]],
  ]);
});

test("보이지 않는 글자·한글 채움 문자가 끼어도 찾는다", () => {
  const c = String.fromCodePoint;
  for (const gap of [0x3164, 0xffa0, 0x115f, 0x1160, 0x2800, 0x200b, 0x200e, 0x200f, 0x061c, 0x202e, 0x2066, 0x2069, 0xfe0f, 0xe0041, 0xe007f]) {
    assert.deepEqual(matchRisk(`죽${c(gap)}고${c(gap)}싶어`, DEFAULT_RISK_WORDS), ["죽고 싶"], gap.toString(16));
  }
  assert.deepEqual(matchRisk(["i", "dont", "want", "to", "go", "home"].join(c(0x3164)), DEFAULT_RISK_WORDS), ["don't want to go home"]);
  assert.deepEqual(matchRisk(`ki${c(0x200e)}ll my${c(0x200b)}self`, DEFAULT_RISK_WORDS), ["kill myself"]);
  assert.deepEqual(matchRisk(`자${c(0x3164)}해`, DEFAULT_RISK_WORDS), ["자해"]);
});

test("일본어 평범한 말이 「しにたい」에 걸리지 않는다(にたいよう+토씨, いっしょにたい…)", () => {
  check([
    ["わたしにたいようがあたった", []],
    ["ほしにたいようがみえた", []],
    ["いっしょにたいいくをした", []],
    ["ともだちといっしょにたいこをたたいた", []],
    ["いっしょにしにたい", ["しにたい"]],
  ]);
});

// 위험 표현 찾기는 학생 글을 저장할 때마다 서버에서 돈다. 글이나 선생님 말이 짓궂어도 오래 붙잡히면 안 된다.
test("짓궂은 글·선생님 말에도 빨리 끝난다(2,000자, 한 번에 100ms보다 훨씬 짧게)", () => {
  const hostileWords = [
    "ㅠㅠㅠ싫", "ㅠㅠㅠㅠ싫", "ㅠㅠㅠㅠㅠ싫", "💀💀💀💀💀죽", "죽♡♡♡♡고", "죽ㅠㅠ고ㅠㅠ싶ㅠㅠ다", "ㅠ!ㅠ!ㅠ!ㅠ!싫어",
    `죽${"~".repeat(20)}고`, "ーーーーし", "ㅋㅋㅋㅋㅋㅋㅋㅋ싫", "!".repeat(20),
  ];
  const texts = [
    "ㅠ".repeat(2000), "💀".repeat(1000), "♡".repeat(2000), `죽${"ㅠ".repeat(2000)}`, `죽${"!".repeat(2000)}`,
    `죽${"♡".repeat(2000)}`, ("죽" + "ㅠ".repeat(30)).repeat(65), ("죽고" + "ㅠ".repeat(20)).repeat(90), "ㅠ!".repeat(1000),
    " ".repeat(2000), "ー".repeat(2000), `し${"ー".repeat(2000)}`, "被".repeat(2000), "bị bố ".repeat(330), "con muon ".repeat(220),
    `죽${String.fromCodePoint(0x301).repeat(2000)}`, ("죽" + String.fromCodePoint(0x3164)).repeat(1000), "ㅋ".repeat(2000),
  ];
  for (const words of [DEFAULT_RISK_WORDS, hostileWords]) {
    // 정규식을 처음 쓸 때 드는 시간은 빼고 잰다(한 바이트·두 바이트 글을 따로 익힌다)
    matchRisk("가나다 ".repeat(500), words);
    matchRisk("abc ".repeat(500), words);
    for (const text of texts) {
      const t0 = performance.now();
      matchRisk(text, words);
      const ms = performance.now() - t0;
      assert.ok(ms < 100, `${JSON.stringify(text.slice(0, 6))}… ${words === DEFAULT_RISK_WORDS ? "기본 목록" : "짓궂은 말"}: ${ms.toFixed(1)}ms`);
    }
  }
  // 짓궂은 말도 제 글자로 쓰면 걸린다
  assert.deepEqual(matchRisk("ㅠㅠㅠ싫어", ["ㅠㅠㅠ싫"]), ["ㅠㅠㅠ싫"]);
  assert.deepEqual(matchRisk("죽♡♡♡♡고", ["죽♡♡♡♡고"]), ["죽♡♡♡♡고"]);
  assert.ok(matchRisk("죽고 싶다", ["죽ㅠㅠ고ㅠㅠ싶ㅠㅠ다"]).includes("죽ㅠㅠ고ㅠㅠ싶ㅠㅠ다"));
  // 선생님 말이 자바스크립트 속 이름과 같아도 엉뚱하게 걸리지 않는다
  assert.deepEqual(matchRisk("hello", ["constructor", "__proto__", "toString", "hasOwnProperty"]), []);
});

// 아이·선생님이 흔히 쓰는 평범한 말: 하나도 걸리면 안 된다
const CLEAN: Record<string, string[]> = {
  ko: [
    "받아쓰기 다 맞았어요!", "친구랑 놀아서 신났어요", "남자 해적이 나오는 책을 읽었어요", "왕딸기를 먹었어요",
    "과일을 다치지 않게 조심히 옮겼어요", "피구 시합에서 우리 편이 이겼어요", "엄마가 맛있는 김치찌개를 해 주셨어요",
    "동생이랑 같이 그림을 그렸어요", "오늘 급식에 떡볶이가 나왔어요", "체육 시간에 줄넘기를 했어요",
    "선생님께 칭찬을 받아서 기뻤어요", "선생님한테 칭찬받았어요", "수학 시험에서 백 점 맞았어요", "비를 맞아서 옷이 젖었어요",
    "짝꿍이 생일 선물을 줬어요", "학교 끝나고 집에 가기 전에 놀이터에 갔어요", "강아지랑 산책했어요",
    "축구하다가 넘어졌는데 안 다쳤어요", "할머니 댁에 가서 감을 땄어요", "할머니가 보시러 오셨어요", "시퍼런 바다를 봤어요",
    "피아노 학원에서 새 곡을 배웠어요", "친구가 나를 도와줘서 고마웠어요", "달리기에서 일등 했어요",
    "선생님이 다치지 않게 조심하라고 하셨어요", "가족과 캠핑을 가서 별을 봤어요", "숨바꼭질에서 술래가 됐어요",
    "때때로 조금 심심해요", "죽 먹고 싶어요", "사과를 따서 먹었어요", "소풍 가기 싫지 않아요", "놀이공원에 또 가고 싶어요",
    "엄마 아빠랑 집에서 쉬고 싶어요", "고양이가 귀여워서 계속 보고 싶어요", "오늘은 그냥 평범했어요",
    "마음은따뜻해요", "물은따뜻했어요", "매일 맞춤법 공부를 해요", "집에 가고 싶어요", "집에 가서 쉬고 싶어요", "우리가 사는 곳이 좋아요",
    "태어나서 처음으로 바다를 봤어요", "주먹밥을 먹었어요", "발로 공을 굴렸어요", "뺨이 빨개졌어요", "집에 가기 전에 숙제했어요",
  ],
  en: [
    "I had fun with my friend", "I ate white meat for dinner", "We played soccer at recess", "My mom made pancakes",
    "I read a book about dinosaurs", "My sister is so funny", "We went to the park after school", "I got a gold star today",
    "I learned how to tie my shoes", "I feel calm and happy", "My dog chased the ball", "I want to go home and play games",
    "I'm excited for the field trip!", "Today was a normal day", "I made a new friend", "The teacher said I did a great job",
    "I drew a picture of my family", "We sang songs in music class", "I won the race!", "It's sunny and warm today",
    "My brother helped me with my homework", "I'm a little tired", "I don’t want to go to bed yet", "I saw a white bear at the zoo",
    "My cat sleeps all day", "I like math class", "I cut my paper into shapes", "We rolled the dice in a board game",
    "The magician made the coin disappear", "My friend lives near my house", "Self portraits were fun to draw",
    "I want to live in a big house someday", "I wish I could fly", "I do not like carrots", "I wanna play outside",
    "We made a fun game", "I kicked the ball", "I pushed the swing", "I hate my homework", "My life is fun",
  ],
  zh: [
    "今天很开心", "我和朋友一起玩", "我打篮球了", "我吃了苹果", "妈妈做了饺子", "我喜欢画画", "我们去公园了", "老师表扬我了",
    "我想回家吃饭", "我想睡觉", "下雨了，我带了伞", "我的狗很可爱", "今天考试考得很好", "我们唱歌了", "我读了一本书",
    "打扫教室很累", "我给妈妈打电话", "我很平静", "我们一起做游戏", "弟弟哭了，我安慰他", "今天天气很好", "我学会了游泳",
    "我想快点长大", "我想吃冰淇淋", "我们班赢了比赛", "爸爸带我去动物园", "我帮奶奶打扫房间", "我们在操场上跑步",
    "我画了一只猫", "明天要去旅行，我很期待", "我被老师表扬了", "我们一起去打篮球", "我想去公园玩", "我不要吃青菜",
    "我被选为班长", "死去的金鱼让我想起了它", "活着的小鸟飞走了",
  ],
  ja: [
    "きょうはたのしかった", "ともだちとあそんだ", "おかあさんがケーキをつくってくれた", "がっこうでえをかいた", "先生にほめられた",
    "かぎをみつけられた", "せんせいにたすけられた", "わたしにたいしてやさしい", "わたしにたいせつなともだち",
    "わたしにたいへんなことがあったけど、だいじょうぶ", "いえにかえってしゅくだいをした", "はやくうちにかえりたい",
    "きのうはあめだった", "サッカーをした", "イチゴをたべた", "ドッジボールでかった", "ともだちがなぐさめてくれた",
    "たたかいごっこをした", "ゆきがきえた", "ねこににげられた", "今日は楽しかったです", "友だちと公園で遊びました",
    "おにごっこをしました", "本をよみました", "ねこがかわいい", "あしたもがっこうにいきたい", "しゅくだいをおわらせた",
    "えんそくがたのしみ", "いぬとさんぽした", "おとうとがわらった", "きゅうしょくがおいしかった", "いちじさつまいもほりをした",
    "わたしにたいようがあたった", "ほしにたいようがみえた", "いっしょにたいそうをした", "ぶたのえをかいた", "ころころころがった",
    "うちにかえりたい", "いきていくちからをまなんだ",
  ],
  vi: [
    "Hôm nay con rất vui", "Con chơi với bạn", "Mẹ bảo con làm từ từ", "me bao con lam tu tu", "Con thích ăn phở",
    "Con được điểm mười", "Con đi công viên với bố", "Bí danh của con là Mèo", "Con muốn về nhà sớm", "con muon ve nha choi",
    "Con đánh răng rồi", "con danh rang roi", "Em học đánh đàn piano", "Con chơi đánh cầu lông", "Hôm nay trời đẹp",
    "Con học bài xong rồi", "bat dau hoc bai", "Con muốn biết thêm", "con muon choi", "Tự làm bài tập", "tu lam bai tap",
    "con tu sap xep do choi", "Em bị đau bụng", "em bi dau bung", "Con thích vẽ tranh", "Con giúp mẹ nấu cơm",
    "Bạn con rất tốt bụng", "Con muốn đi biển", "con muon song o day", "Con không muốn ngủ trưa", "con khong muon ngu trua",
    "Con chơi trốn tìm với em", "Con bị ốm", "Con bị điểm thấp", "Bí danh của con là Bi",
  ],
};

for (const [lang, rows] of Object.entries(CLEAN)) {
  test(`평범한 말은 걸리지 않는다(${lang}, ${rows.length}문장)`, () => {
    for (const text of rows) assert.deepEqual(matchRisk(text, DEFAULT_RISK_WORDS), [], text);
  });
}

test("넓게 찾기로 받아들인 것: 위험하지 않을 수도 있지만 걸린다(선생님이 읽고 판단)", () => {
  check([
    ["야구공을 때렸어요", ["때렸"]],
    ["엄마한테 맞춤법을 물어봤어요", ["한테 맞"]],
    ["가위는 친구를 다치게 할 수 있어요", ["다치게 하"]],
    ["我想死你了", ["想死"]], // 「보고 싶어 죽겠다」는 뜻으로도 쓴다
    ["My brother beat me at chess", ["beat me"]],
  ]);
});

test("두 글자 말은 빈칸·문장부호를 건너지 않고 받침도 늘리지 않는다", () => {
  assert.deepEqual(matchRisk("왕딸기", ["왕따"]), []);
  assert.deepEqual(matchRisk("왕따 당했어", ["왕따"]), ["왕따"]);
  assert.deepEqual(matchRisk("남자, 해적", ["자해"]), []);
  assert.deepEqual(matchRisk("왕 따", ["왕 따"]), ["왕 따"]);
});

test("글자·숫자가 없는 선생님 말(이모지·기호)은 그대로 들어 있을 때만 걸린다", () => {
  const words = ["💀", "🔪", "!!", "-_-"];
  for (const text of ["오늘은 기뻐요", "I'm fine", "今天很开心", "Hôm nay con rất vui", "きょうはたのしかった", "하하!"]) {
    assert.deepEqual(matchRisk(text, words), [], text);
  }
  assert.deepEqual(matchRisk("오늘 💀 기뻐요!!", words), ["💀", "!!"]);
  assert.deepEqual(matchRisk("🔪🔪", words), ["🔪"]);
  assert.deepEqual(matchRisk("-_- 짜증나", words), ["-_-"]);
});

test("같은 말·같은 자리에 걸린 말은 한 번만, 선생님이 쓴 모양이 먼저", () => {
  assert.deepEqual(matchRisk("he said hit me", ["hit-me", "hit me"]), ["hit-me"]);
  assert.deepEqual(matchRisk("hit-me", ["hit me"]), ["hit me"]);
  assert.deepEqual(matchRisk("괴롭혔어요", ["괴롭혀", "괴롭혔"]), ["괴롭혀"]);
  assert.deepEqual(matchRisk("괴롭힘을 당했어요", ["괴롭힘", "괴롭히"]), ["괴롭힘"]);
  assert.deepEqual(matchRisk("죽고 싶어", ["죽고싶"]), ["죽고싶"]);
  assert.deepEqual(matchRisk("いじめられた", ["イジメ"]), ["イジメ"]);
  assert.deepEqual(matchRisk("bi danh", ["bi danh"]), ["bi danh"]); // 핵심 목록의 「bị đánh」은 같은 자리라 다시 넣지 않음
  // 띄어쓰기가 다른 영어 말은 다른 말(「kill my self」가 「kill myself」에 먹히지 않게)
  assert.deepEqual(matchRisk("kill my self", ["kill myself"]), ["kill my self"]);
});

test("기본 목록·핵심 목록의 말은 모두 제 글자로 쓰면 걸린다", () => {
  for (const w of [...DEFAULT_RISK_WORDS, ...RISK_CORE]) assert.ok(matchRisk(w, []).length > 0 || matchRisk(w, [w]).length > 0, w);
  for (const w of RISK_CORE) assert.ok(matchRisk(w, []).length > 0, w);
});

test("기록을 저장할 때마다 불러도 빠르다", () => {
  const text = "오늘은 친구랑 운동장에서 놀았는데 정말 재미있었어요. 그런데 집에 와서 숙제를 하다가 조금 피곤했어요. I had fun. Hôm nay con vui. 今天很开心。きょうはたのしかった。";
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) matchRisk(text + i, DEFAULT_RISK_WORDS);
  assert.ok(performance.now() - t0 < 3000, `${Math.round(performance.now() - t0)}ms`);
});

const addsOf = (v: number) => RISK_WORDS_BY_V[v].flatMap((g) => g.add);

test("기본 목록 판: 판마다 더한 말은 기본 목록에도 있고, 저장한 판 뒤에 더한 말만 돌려준다", () => {
  assert.equal(RISK_WORDS_V, 4);
  for (const v of Object.keys(RISK_WORDS_BY_V).map(Number)) {
    for (const g of RISK_WORDS_BY_V[v]) {
      for (const w of g.add) assert.ok(DEFAULT_RISK_WORDS.includes(w), w);
      // 줄기는 그 판보다 앞에 있던 기본 말이다
      for (const p of g.from ?? []) assert.ok(DEFAULT_RISK_WORDS.includes(p) && !addsOf(v).includes(p), `${v}: ${p}`);
    }
  }
  assert.equal(new Set(DEFAULT_RISK_WORDS).size, DEFAULT_RISK_WORDS.length);
  assert.deepEqual(riskWordsAfter(3), addsOf(4));
  assert.deepEqual(riskWordsAfter(2), [...addsOf(3), ...addsOf(4)]);
  assert.deepEqual(riskWordsAfter(1), [...addsOf(2), ...addsOf(3), ...addsOf(4)]);
  assert.deepEqual(riskWordsAfter(RISK_WORDS_V), []);
});

test("기본 목록 판: 선생님이 지운 줄기의 다른 꼴은 다시 넣지 않는다(줄기 없는 말은 늘 넣는다)", () => {
  const v3 = DEFAULT_RISK_WORDS.filter((w) => !addsOf(4).includes(w));
  // 고치지 않은 v3 목록은 v4 말을 모두 받는다
  assert.deepEqual(riskWordsAfter(3, v3), addsOf(4));
  // 「죽여」「죽일」「집에 가기 싫」「집에 가기 시러」「죽을래」를 지운 반
  const trimmed = v3.filter((w) => !["죽여", "죽일", "집에 가기 싫", "집에 가기 시러", "죽을래"].includes(w));
  const got = riskWordsAfter(3, trimmed);
  for (const w of ["죽이고 싶", "죽인다", "집 가기 싫", "집에 들어가기 싫", "집에 가기 실", "뒤질래", "디질래"]) assert.ok(!got.includes(w), w);
  for (const w of ["은따", "떄려", "집에 가기 무서", "발로 차", "뺨을 맞", "매를 맞", "주먹으로 맞"]) assert.ok(got.includes(w), w);
  // 앞 판에서 함께 더한 말도 줄기로 친다: v1 목록에 「때렸」이 있으면 v2 「때리」 → v3 「때린」 → v4 「떄리」까지
  assert.deepEqual(riskWordsAfter(1, ["때렸"]).filter((w) => /때|떄/.test(w)), ["때리", "때린", "때릴", "때림", "떄리", "떄려", "떄렸"]);
  assert.deepEqual(riskWordsAfter(1, ["자해"]).filter((w) => /때|떄/.test(w)), []);
  // 이미 있는 말은 다시 넣지 않고, 빈칸만 다른 줄기도 줄기로 친다
  assert.deepEqual(riskWordsAfter(3, ["집에가기싫", "은따"]).filter((w) => w.startsWith("집") || w === "은따"), [
    "집 가기 싫", "집에 들어가기 싫", "집 들어가기 싫", "집에 가고 싶지 않", "집에 안 가고 싶", "집에 가기 실", "집에 가기 무서",
  ]);
});

test("설정 판 올리기: 뒤 판에 더한 말을 받되, 지운 줄기의 꼴은 받지 않는다. 처음 반은 새 기본 목록", async () => {
  const { inSpace, db } = await import("./db.ts");
  const { getSettings, saveSettings } = await import("./data.ts");
  const v2List = ["죽고 싶", "자해", "자살", "왕따", "한테 맞"]; // 선생님이 「때리」 「에게 맞」 「때렸」 「괴롭혀」 들을 지운 목록
  await inSpace("crisk2", async () => {
    await db().set("meta", "settings", { riskWords: v2List, riskWordsV: 2 });
    const s = await getSettings();
    // 때린·괴롭히·다치게 해·집에 가기 시러·죽이고 싶·뒤질래처럼 지운 줄기의 꼴은 들어오지 않는다
    assert.deepEqual(s.riskWords, [
      ...v2List, "따돌", "은따", "집에 가기 무서", "발로 차", "뺨을 맞", "뺨 맞", "매를 맞", "매 맞", "주먹으로 맞", "주먹으로 쳤",
      "없어졌으면 좋겠", "사라졌으면 좋겠", "태어나지 않았으면", "안 태어났으면", "태어나지 말",
    ]);
    assert.equal(s.riskWordsV, 4);
    // 선생님이 설정을 저장하면 판도 같이 남아, 그 뒤에 지운 말은 다시 들어오지 않는다
    await saveSettings({ ...s, riskWords: s.riskWords.filter((w) => w !== "발로 차") });
    assert.ok(!(await getSettings()).riskWords.includes("발로 차"));
  });
  await inSpace("crisk3", async () => {
    const v3List = DEFAULT_RISK_WORDS.filter((w) => !addsOf(4).includes(w));
    await db().set("meta", "settings", { riskWords: v3List, riskWordsV: 3 });
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [...v3List, ...addsOf(4)]);
    assert.equal(s.riskWordsV, 4);
  });
  await inSpace("crisk1", async () => {
    await db().set("meta", "settings", { riskWords: ["죽고 싶", "왕따", "때렸"] }); // 판이 없던 예전 저장
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [
      "죽고 싶", "왕따", "때렸", "자살", "살기 싫", "때리", "한테 맞", "에게 맞", "죽여", "죽일", "때린", "때릴", "때림", "따돌",
      "죽이고 싶", "죽인다", "은따", "떄리", "떄려", "떄렸",
      "집에 가기 무서", "발로 차", "뺨을 맞", "뺨 맞", "매를 맞", "매 맞", "주먹으로 맞", "주먹으로 쳤",
      "없어졌으면 좋겠", "사라졌으면 좋겠", "태어나지 않았으면", "안 태어났으면", "태어나지 말",
    ]);
    assert.equal(s.riskWordsV, 4);
  });
  await inSpace("crisk0", async () => {
    const s = await getSettings(); // 설정을 한 번도 저장하지 않은 반
    assert.deepEqual(s.riskWords, DEFAULT_RISK_WORDS);
    assert.equal(s.riskWordsV, 4);
  });
});

test("다른 반이 낱말 안에 보이지 않는 글자를 넣어 기본 목록과 같은 열쇠를 꾸며도 기본 목록 찾기가 꺼지지 않는다", () => {
  const forged: string[] = [];
  for (let i = 0; i < DEFAULT_RISK_WORDS.length; i += 2) forged.push(DEFAULT_RISK_WORDS.slice(i, i + 2).join("\u0000"));
  matchRisk("아무 말", forged);
  assert.deepEqual(matchRisk("어제 아빠가 나를 때렸어", DEFAULT_RISK_WORDS), ["때렸"]);
});
