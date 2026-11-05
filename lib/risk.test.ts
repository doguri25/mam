// 위험 표현 찾기(matchRisk)와 기본 목록 판 올리기. 실행: node --test lib/
// 선생님이 고른 「넓게 찾기」: 잘못 거는 것은 괜찮지만 놓치면 안 된다. 다만 평범한 말이 터무니없이 걸리지는 않게.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { matchRisk } from "./rules.ts";
import { DEFAULT_RISK_WORDS, RISK_CORE, RISK_WORDS_BY_V, RISK_WORDS_MAX, RISK_WORD_LEN, RISK_WORDS_V, riskWordsAfter } from "./shared.ts";

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

test("중국어: 때린 사람이 끼어도(被…打, 여덟 글자까지)·죽음·집에 가기 싫은 말", () => {
  check([
    ["爸爸打了我", ["打了我"]],
    ["他们打了我", ["打了我"]],
    ["我被爸爸打了", ["被打"]],
    ["我被他们狠狠打了", ["被打"]],
    ["我被打了", ["被打"]],
    ["我被班里的男生打了", ["被打"]],
    ["我被爸爸用皮带打了", ["被打"]],
    ["我被妈妈用衣架打了", ["被打"]],
    ["我被高年级的同学打了", ["被打"]],
    ["我又挨打了", ["挨打"]],
    ["我挨揍了", ["挨揍"]],
    ["爸爸揍我", ["揍我"]],
    ["我被爸爸揍了", ["被揍"]],
    ["我想跳楼", ["想跳楼"]],
    ["我想去死", ["去死"]],
    ["你去死吧", ["去死"]],
    ["死了算了", ["死了算了"]],
    ["活着没意思", ["活着没意思"]],
    ["我不要回家", ["不要回家"]],
    ["我想杀了他", ["想杀"]],
  ]);
  // 문장·마디가 끊기거나, 「打」 뒤가 청소·공놀이·전화·주사·지다처럼 다른 뜻이면 찾지 않는다
  check([
    ["我被老师批评了，然后打扫教室", []],
    ["我被叫去打扫教室", []],
    ["我被邀请去打羽毛球", []],
    ["我被选上了打篮球", []],
    ["我被妈妈叫去打电话", []],
    ["我被带去打针了", []],
    ["我们被三班打败了", []],
    ["我被表扬了。打完球回家", []],
  ]);
});

test("베트남어: bị와 đánh 사이 네 낱말까지, 문장을 넘지 않고, 성조를 일부만 쳐도 찾는다", () => {
  check([
    ["Con bị bố đánh", ["bị đánh"]],
    ["Em bị bạn đánh", ["bị đánh"]],
    ["con bi bo danh", ["bị đánh"]],
    ["Con bị các bạn đánh", ["bị đánh"]],
    ["Con bị bố mẹ hay đánh", ["bị đánh"]],
    ["Em bị bạn cùng lớp đánh", ["bị đánh"]],
    ["Con bị bố lấy roi đánh", ["bị đánh"]],
    ["Em bị mấy bạn lớp trên đánh", ["bị đánh"]],
    ["Con bị bố đánh đau lắm", ["bị đánh"]], // 「đau(아파)」는 「dấu」가 아니다
    ["con bi bo danh roi", ["bị đánh"]], // 「roi」는 「rồi(벌써)」일 수 있다
    ["Bố đánh đòn con", ["đánh đòn"]],
    ["con muốn chet", ["muốn chết"]],
    ["con muon chết", ["muốn chết"]],
    ["Con muốn chêt", ["muốn chết"]],
    ["con mún chết", ["mún chết"]],
    ["Con chán sống", ["chán sống"]],
    ["con muốn tu tử", ["tự tử"]], // 「tu tu」는 빼도 성조를 하나라도 쳤으면 찾는다
    ["con khong muon ve nhà", ["không muốn về nhà"]],
  ]);
  check([
    ["Con bị cảm nên hôm nay mẹ không đánh", []], // 네 낱말 넘게 떨어지면 찾지 않는다
    ["Hôm nay con bị ốm. Đánh răng xong con đi ngủ", []], // 문장이 끊긴 자리는 넘지 않는다
    ["Em bị đau bụng, đánh răng rồi đi ngủ", []],
    ["Con bị mẹ đánh thức lúc sáu giờ", []], // 깨우기·이 닦기·악기는 때린 말이 아니다
    ["con bi me danh rang cho", []],
    ["Em bị cô bắt đánh đàn", []],
    ["Con bí đánh", []], // 다른 성조를 친 「bí」는 「bị」가 아니다
    ["con từ tự", []],
    ["me bao con lam tu tu", []],
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
  // 제어·서식 글자(\p{Cc}·\p{Cf})도 지운다
  for (const gap of [0x01, 0x08, 0x1f, 0x7f, 0x85, 0x9f, 0x0600, 0xfff9, 0xfffb, 0x1d173, 0x1d17a]) {
    assert.deepEqual(matchRisk(`죽${c(gap)}고 싶어`, []), ["죽고 싶"], gap.toString(16));
  }
  assert.deepEqual(matchRisk(`con bị bố đ${c(1)}ánh`, []), ["bị đánh"]);
  assert.deepEqual(matchRisk(`ki${c(0x85)}ll myself`, []), ["kill myself"]);
  // 탭·줄바꿈은 지우지 않고 낱말을 나누는 빈칸으로 둔다
  assert.deepEqual(matchRisk("my dad\thit\nme", []), ["hit me"]);
  assert.deepEqual(matchRisk("죽고\n싶어", []), ["죽고 싶"]);
});

test("일본어 평범한 말이 「しにたい」에 걸리지 않는다(にたいよう+토씨, いっしょにたい…)", () => {
  check([
    ["わたしにたいようがあたった", []],
    ["ほしにたいようがみえた", []],
    ["いっしょにたいいくをした", []],
    ["ともだちといっしょにたいこをたたいた", []],
    ["いっしょにしにたい", ["しにたい"]],
    // 「たいこ(북)」「たいやき」「たいいく(체육)」「たいかい(대회)」, 낱말마다 띄어 쓴 「わたしに たいせつな」도
    ["おかあさんがわたしにたいこをかってくれた", []],
    ["おばあちゃんがわたしにたいやきをくれた", []],
    ["わたしにたいいくのせんせいがほめてくれた", []],
    ["わたしにたいかいのしょうじょうがとどいた", []],
    ["わたしに たいせつな ともだち", []],
    ["いっしょに たいいくを した", []],
  ]);
});

test("일본어: 평범한 말을 가릴 때 문장이 끊긴 자리를 넘지 않는다(다음 문장 첫 글자로 「しにたい」를 가리지 않게)", () => {
  for (const text of [
    "しにたいよう。もういやだ", "しにたいよう、がっこういきたくない", "しにたい。せつない", "しにたい。へんなきもち",
    "しにたい。するとなみだがでる", "シニタイヨウ。モウヤダ", "しにたいよう もう いやだ", "しにたいよう！",
  ]) assert.deepEqual(matchRisk(text, []), ["しにたい"], text);
  for (const text of ["死にたいよう。もうむり", "死にたい、せつない"]) assert.deepEqual(matchRisk(text, []), ["死にたい"], text);
  // 「いじめ」도 문장이 끊긴 자리·평범한 낱말(じめん 땅, じめじめ 눅눅)에 걸리지 않는다
  check([
    ["きょうはむしあつい。じめじめする", []],
    ["さむい。じめんがこおってた", []],
    ["あついじめんをはだしであるいた", []],
    ["かたいじめんにころんだ", []],
    ["いじめられた", ["いじめ"]],
    ["いじめんなよ", ["いじめ"]],
  ]);
});

test("일본어: 나를 때리는 말(능동)·살고 싶지 않은 말·リスカ", () => {
  check([
    ["おとうさんがぼくをたたく", ["ぼくをたたく"]],
    ["ママがわたしをける", ["ぼくをたたく"]],
    ["おにいちゃんがおれをけった", ["ぼくをたたく"]],
    ["わたしを叩いた", ["ぼくをたたく"]],
    ["おにいちゃんがいもうとをなぐった", ["をなぐっ"]],
    ["もう生きたくない", ["生きたくない"]],
    ["リスカした", ["リスカ"]],
    ["飛び降りたい", ["飛び降りたい"]],
    ["とびおりたい", ["とびおりたい"]], // 「ブランコからとびおりたい」에도 걸려 뺄 수 있는 기본 목록에
  ]);
  assert.ok(matchRisk("パパがぼくをなぐった", []).includes("ぼくをたたく"));
  check([
    ["たいこをたたいた", []],
    ["ボールをける", []],
    ["ともだちをなぐさめた", []],
    ["せんせいがわたしをたたえてくれた", []],
    ["おねえちゃんがわたしをけっこんしきによんでくれた", []],
    ["みんなぐっすりねた", []],
    ["りすかわいかった", []],
    ["がっこういきたくない", []],
  ]);
});

test("영어: 맞는 말(beats me·hurts me·kick me…)·흔한 맞춤법·띄어 쓴 글자도 찾는다", () => {
  check([
    ["my dad beats me", ["beats me"]],
    ["dad is beating me", ["beating me"]],
    ["my dad hurts me", ["hurts me"]],
    ["they kick me", ["kick me"]],
    ["they punch me", ["punch me"]],
    ["she slap me", ["slap me"]],
    ["he chokes me", ["chokes me"]],
    ["they push me", ["push me"]],
    ["kids are bulling me", ["bulling"]],
    ["they bulied me", ["bulied"]],
    ["i feel sucidal", ["sucid"]],
    ["suiside", ["suisid"]],
    ["i wana die", ["wana die"]],
    ["i wont to die", ["wont to die"]],
    ["I wish I was never born", ["wish i was never born"]],
    ["I wish I wasn't born", ["wish i wasn't born"]],
    ["they told me to kill yourself", ["kill yourself"]],
    ["kys", ["kys"]],
    ["k i l l m y s e l f", ["killmyself"]],
    ["w a n t t o d i e", ["wanttodie"]],
    ["I want to jump off the roof", ["jump off"]],
  ]);
  check([
    ["I want to diet", []],
    ["My mom is on a diet", []],
    ["kysa is my cat", []], // kys는 낱말 하나일 때만
    ["kick me the ball please", []], // 공을 차 달라는 말
    ["I learned a b c today", []],
    ["My dad was pushing me on the swing", []], // 기본 목록에서 「pushing me」를 뺀 반
    ["I don't want to go back home yet, the party is fun", []],
  ], DEFAULT_RISK_WORDS.filter((w) => !["pushing me", "don't want to go back home"].includes(w)));
});

test("한국어: 토씨·꾸밈말이 끼거나 맞춤법이 달라도 스스로 해치려는 말을 찾는다(늘 살피는 말)", () => {
  const rows: [string, string[]][] = [
    ["살기가 싫어", ["살기 싫"]],
    ["살기가 너무 싫어요", ["살기 싫"]],
    ["살기 정말 싫어", ["살기 싫"]],
    ["사는게 너무 싫어", ["사는 게 싫"]],
    ["사는 게 시러", ["사는 게 싫"]],
    ["사는 거 진짜 싫어", ["사는 거 싫"]],
    ["사라져 버리고 싶어", ["사라져 버리고 싶"]],
    ["없어져 버리고 싶어", ["없어져 버리고 싶"]],
    ["뒤져버리고 싶어", ["뒤져 버리고 싶"]],
    ["사라지구 시퍼", ["사라지구 시퍼"]],
    ["없어지구 싶어", ["없어지구 싶"]],
    ["사라지고 십어", ["사라지고 십"]],
    ["죽고시프다", ["죽고 시프"]],
    ["주그고 싶어", ["주그고 싶"]],
    ["죽꼬 싶어", ["죽꼬 싶"]],
    ["주거버리고 싶어", ["주거버"]],
    ["내가 죽었으면 좋겠어", ["내가 죽었으면 좋겠"]],
    ["내가 사라지면 좋겠어", ["내가 사라지면 좋겠"]],
    ["차라리 죽는 게 나아", ["차라리 죽", "죽는 게 나아"]],
    ["죽는 게 나을 것 같아", ["죽는 게 나을"]],
    ["옥상에서 뛰어내리고 싶어", ["옥상에서 뛰어내리고 싶"]],
    ["손목을 긋고 싶어", ["손목을 긋"]],
  ];
  for (const [text, want] of rows) assert.deepEqual(matchRisk(text, []), want, text);
  // 평범한 말에도 걸리는 것은 뺄 수 있는 기본 목록에(5판)
  check([
    ["모기가 죽었으면 좋겠어", ["죽었으면 좋겠"]],
    ["다이빙대에서 뛰어내리고 싶어", ["뛰어내리고 싶"]],
    ["아빠한테 두들겨 맞았어", ["두들겨 맞"]],
    ["형한테 얻어맞았어", ["얻어맞"]],
    ["아빠한테 마자써", ["한테 마자"]],
    ["형한테 마졌어", ["한테 마져"]],
  ]);
  for (const text of ["모기가 죽었으면 좋겠어", "다이빙대에서 뛰어내리고 싶어"]) assert.deepEqual(matchRisk(text, []), [], text);
  // 꾸밈말 목록에 없는 말이 끼면 잇지 않는다
  check([["살기 위해 싫은 음식도 먹어요", []], ["우리가 사는 곳이 싫지 않아요", []]]);
});

test("한국어: 받침 ㅆ을 ㅅ으로 친 꼴, 두 글자 말 사이의 문장부호·기호", () => {
  check([
    ["아빠가 때렷어", ["때렸"]],
    ["엄마가 날 때렷다", ["때렸"]],
    ["괴롭혓어", ["괴롭혀"]],
    ["자.살 하고 싶어", ["자살"]],
    ["자*해 했어", ["자해"]],
    ["자ㅠㅠ해", ["자해"]],
    ["왕~따 당했어", ["왕따"]],
  ]);
  // 빈칸은 말에 빈칸이 있던 자리만 건넌다
  check([
    ["남자 해적이 나왔어요", []],
    ["우리 놀자. 해 보자!", []],
    ["가자. 살 거 있어", []],
    ["과자살래", []],
    ["모자살거야", []],
    ["과자 사러 가자", []],
    // 앞 낱말의 끝 글자(「가자」「남자」「열매」)에서는 문장부호를 건너지 않는다
    ["우리 가자,해바라기 보러", []],
    ["남자,해적,여자", []],
    ["이건 열매. 맞아?", []],
  ]);
  // 중국어 두 글자 말은 쉼표·마침표를 건너지 않는다(마디가 나뉜다)
  check([["我们去，死守球门", []], ["他打，我哭了", []]]);
});

test("한국어: 평범한 수업 말이 기본 목록에 걸리지 않는다(작은따옴표·발로 차기·열매·맛이 죽인다·남이 싫어함)", () => {
  check([
    ["국어 시간에 큰따옴표와 작은따옴표를 배웠어요", []],
    ["태권도에서 발로 차는 연습을 했어요", []],
    ["축구공을 발로 찼어요", []],
    ["공을 발로 찼어요", []],
    ["맨발로 차가운 모래를 밟았어요", []],
    ["두 발로 착지했어요", []],
    ["열매를 맞혀 보는 퀴즈를 했어요", []],
    ["열매 맞히기 놀이를 했어요", []],
    ["우리 남매 맞춤 티셔츠를 입었어요", []],
    ["떡볶이 맛이 죽인다", []],
    ["맛이 진짜 죽인다", []],
    ["엄마는 내가 장난감 사는 거 싫어해요", []],
    ["엄마는 내가 과자 사는 거 너무 싫어해요", []],
    ["배가 아파서 차라리 죽을 먹을래요", []],
  ]);
  // 같은 말이 실제로 때리거나 해치는 뜻이면 그대로 찾는다
  check([
    ["친구가 나를 공처럼 발로 찼어", ["발로 차"]],
    ["형이 발로 차요", ["발로 차"]],
    ["엄마한테 매를 맞았어", ["매를 맞"]],
    ["너 죽인다", ["죽인다"]],
    ["반에서 은따 당해요", ["은따"]],
    ["나는 사는 거 싫어", ["사는 거 싫"]],
    ["엄마는 내가 사는 거 싫어해", ["사는 거 싫"]], // 「내가 ○○ 사는」처럼 산 물건이 있을 때만 남의 말로 본다
  ]);
});

test("번역한 한국어 정리는 늘 살피는 말로만 살핀다(학생 화면 analyze: 「I hit a home run」→「홈런을 때렸어요」)", () => {
  // analyze는 한국어가 아닌 글의 AI 한국어 정리(koHits)를 matchRisk(정리, [])로 본다: 선생님 목록의 평범한 말에는 걸리지 않고
  assert.deepEqual(matchRisk("야구에서 홈런을 때렸어요", []), []);
  assert.deepEqual(matchRisk("엄마가 나에게 맞는 신발을 사 줬어요", []), []);
  assert.deepEqual(matchRisk("친구랑 공을 발로 차며 축구했어요", []), []);
  // 스스로 해치려는 말은 여전히 찾는다
  assert.deepEqual(matchRisk("죽고 싶다고 했어요", []), ["죽고 싶"]);
  assert.deepEqual(matchRisk("살기가 싫다고 했어요", []), ["살기 싫"]);
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
    // 6판: 작은 모음, 「자.」「자~」, 「나 …」「죽 고 …」(사이 글자를 건너는 말), 「사는 게 너무…」, 띄어 쓴 영어 덩어리, 「bị … vì」
    "ぃ".repeat(2000), `し${"ぃ".repeat(2000)}`, "しにたぃ".repeat(500), "자.".repeat(1000), "자~".repeat(1000), `자${"*".repeat(2000)}`,
    ("나" + "ㅠ".repeat(30)).repeat(65), `나${" ".repeat(2000)}`, ("죽" + "ㅠ".repeat(30) + "고").repeat(60), `죽 고${" ".repeat(2000)}`,
    "사는게너무".repeat(400), "살기가너무정말".repeat(280), "a ".repeat(1000), "i w a n t t o ".repeat(140), "bị a vì đánh ".repeat(150),
    "손목".repeat(1000), "被被打".repeat(660),
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

test("두 글자 말은 말에 없던 빈칸을 건너지 않고 받침도 늘리지 않는다", () => {
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
  assert.equal(RISK_WORDS_V, 6);
  for (const v of Object.keys(RISK_WORDS_BY_V).map(Number)) {
    for (const g of RISK_WORDS_BY_V[v]) {
      for (const w of g.add) assert.ok(DEFAULT_RISK_WORDS.includes(w), w);
      // 줄기는 그 판보다 앞에 있던 기본 말이다
      for (const p of g.from ?? []) assert.ok(DEFAULT_RISK_WORDS.includes(p) && !addsOf(v).includes(p), `${v}: ${p}`);
    }
  }
  assert.equal(new Set(DEFAULT_RISK_WORDS).size, DEFAULT_RISK_WORDS.length);
  assert.deepEqual(riskWordsAfter(5), addsOf(6));
  assert.deepEqual(riskWordsAfter(4), [...addsOf(5), ...addsOf(6)]);
  assert.deepEqual(riskWordsAfter(3), [...addsOf(4), ...addsOf(5), ...addsOf(6)]);
  assert.deepEqual(riskWordsAfter(2), [...addsOf(3), ...addsOf(4), ...addsOf(5), ...addsOf(6)]);
  assert.deepEqual(riskWordsAfter(1), [...addsOf(2), ...addsOf(3), ...addsOf(4), ...addsOf(5), ...addsOf(6)]);
  assert.deepEqual(riskWordsAfter(RISK_WORDS_V), []);
  // 기본 목록으로 옮긴 말·뺄 수 있게 더한 말은 늘 살피는 말에 없다(선생님이 빼면 정말 빠지게)
  for (const w of [...addsOf(5), ...addsOf(6)]) assert.ok(!RISK_CORE.includes(w), w);
});

test("기본 목록 판: 선생님이 지운 줄기의 다른 꼴은 다시 넣지 않는다(줄기 없는 말은 늘 넣는다)", () => {
  const v3 = DEFAULT_RISK_WORDS.filter((w) => !addsOf(4).includes(w) && !addsOf(5).includes(w) && !addsOf(6).includes(w));
  // 고치지 않은 v3 목록은 v4·v5·v6 말을 모두 받는다
  assert.deepEqual(riskWordsAfter(3, v3), [...addsOf(4), ...addsOf(5), ...addsOf(6)]);
  // 「한테 맞」을 지운 v4 반은 「한테 마자」「한테 마져」를 받지 않고, 줄기 없는 v5 말은 받는다
  const v4 = DEFAULT_RISK_WORDS.filter((w) => !addsOf(5).includes(w) && !addsOf(6).includes(w) && w !== "한테 맞");
  const got5 = riskWordsAfter(4, v4);
  assert.ok(!got5.includes("한테 마자") && !got5.includes("한테 마져"));
  for (const w of ["죽었으면 좋겠", "두들겨 맞", "don't want to go home", "pushing me", "不想回家", "không muốn về nhà", "にかえりたくない"]) assert.ok(got5.includes(w), w);
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
      "없어졌으면 좋겠", "사라졌으면 좋겠", "태어나지 않았으면", "안 태어났으면", "태어나지 말", ...addsOf(5), ...addsOf(6),
    ]);
    assert.equal(s.riskWordsV, 6);
    // 선생님이 설정을 저장하면 판도 같이 남아, 그 뒤에 지운 말은 다시 들어오지 않는다
    await saveSettings({ ...s, riskWords: s.riskWords.filter((w) => w !== "발로 차") });
    assert.ok(!(await getSettings()).riskWords.includes("발로 차"));
  });
  await inSpace("crisk3", async () => {
    const v3List = DEFAULT_RISK_WORDS.filter((w) => !addsOf(4).includes(w) && !addsOf(5).includes(w) && !addsOf(6).includes(w));
    await db().set("meta", "settings", { riskWords: v3List, riskWordsV: 3 });
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [...v3List, ...addsOf(4), ...addsOf(5), ...addsOf(6)]);
    assert.equal(s.riskWordsV, 6);
  });
  await inSpace("crisk1", async () => {
    await db().set("meta", "settings", { riskWords: ["죽고 싶", "왕따", "때렸"] }); // 판이 없던 예전 저장
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [
      "죽고 싶", "왕따", "때렸", "자살", "살기 싫", "때리", "한테 맞", "에게 맞", "죽여", "죽일", "때린", "때릴", "때림", "따돌",
      "죽이고 싶", "죽인다", "은따", "떄리", "떄려", "떄렸",
      "집에 가기 무서", "발로 차", "뺨을 맞", "뺨 맞", "매를 맞", "매 맞", "주먹으로 맞", "주먹으로 쳤",
      "없어졌으면 좋겠", "사라졌으면 좋겠", "태어나지 않았으면", "안 태어났으면", "태어나지 말", ...addsOf(5), ...addsOf(6),
    ]);
    assert.equal(s.riskWordsV, 6);
  });
  await inSpace("crisk0", async () => {
    const s = await getSettings(); // 설정을 한 번도 저장하지 않은 반
    assert.deepEqual(s.riskWords, DEFAULT_RISK_WORDS);
    assert.equal(s.riskWordsV, 6);
  });
});

test("평범한 말에도 걸리는 다른 나라 말(집에 가기 싫은 말·pushing me)은 늘 살피는 말이 아니라 뺄 수 있는 기본 목록에 있다", () => {
  for (const text of [
    "我不要回家，我还想玩", "公园太好玩了，不想回家", "My dad was pushing me on the swing", "I don't want to go back home yet, the party is fun",
    "Con chơi vui quá, không muốn về nhà", "こうえんがたのしくて うちに かえりたくない", "まだ家に帰りたくない",
  ]) {
    assert.deepEqual(matchRisk(text, []), [], text);
    assert.equal(matchRisk(text, DEFAULT_RISK_WORDS).length, 1, text);
  }
});

test("설정 판 올리기(5판): 늘 살피던 다른 나라 말이 저장한 목록에 한 번 들어와 계속 찾고, 선생님이 빼면 더는 찾지 않는다", async () => {
  const { inSpace, db } = await import("./db.ts");
  const { getSettings, saveSettings } = await import("./data.ts");
  await inSpace("crisk4", async () => {
    const v4List = DEFAULT_RISK_WORDS.filter((w) => !addsOf(5).includes(w) && !addsOf(6).includes(w));
    await db().set("meta", "settings", { riskWords: v4List, riskWordsV: 4 });
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [...v4List, ...addsOf(5), ...addsOf(6)]);
    assert.equal(s.riskWordsV, 6);
    // 옮기기 전(늘 살피는 말)처럼 그대로 걸린다
    const swing = "My dad was pushing me on the swing";
    assert.deepEqual(matchRisk(swing, s.riskWords), ["pushing me"]);
    assert.deepEqual(matchRisk("公园太好玩了，不想回家", s.riskWords), ["不想回家"]);
    // 선생님이 빼고 저장하면 다시 들어오지 않고, 늘 살피는 말에도 없어 걸리지 않는다
    await saveSettings({ ...s, riskWords: s.riskWords.filter((w) => w !== "pushing me" && w !== "不想回家") });
    const after = await getSettings();
    assert.ok(!after.riskWords.includes("pushing me") && !after.riskWords.includes("不想回家"));
    assert.deepEqual(matchRisk(swing, after.riskWords), []);
    assert.deepEqual(matchRisk("公园太好玩了，不想回家", after.riskWords), []);
  });
});

test("다른 반이 낱말 안에 보이지 않는 글자를 넣어 기본 목록과 같은 열쇠를 꾸며도 기본 목록 찾기가 꺼지지 않는다", () => {
  const forged: string[] = [];
  for (let i = 0; i < DEFAULT_RISK_WORDS.length; i += 2) forged.push(DEFAULT_RISK_WORDS.slice(i, i + 2).join("\u0000"));
  matchRisk("아무 말", forged);
  assert.deepEqual(matchRisk("어제 아빠가 나를 때렸어", DEFAULT_RISK_WORDS), ["때렸"]);
});

// 기본 목록의 말이 선생님 화면·서버의 한도에 걸리면, 목록을 고치려 할 때마다 저장이 막히거나(화면) 말이 잘린다(서버)
test("기본 목록과 판마다 더한 말은 모두 한 낱말 한도(RISK_WORD_LEN)·개수 한도(RISK_WORDS_MAX) 안", () => {
  const added = Object.values(RISK_WORDS_BY_V).flatMap((gs) => gs.flatMap((g) => g.add));
  for (const w of [...DEFAULT_RISK_WORDS, ...added]) assert.ok(w.length <= RISK_WORD_LEN, `${w} (${w.length}자)`);
  assert.ok(DEFAULT_RISK_WORDS.length <= RISK_WORDS_MAX);
  assert.ok(new Set([...DEFAULT_RISK_WORDS, ...added]).size <= RISK_WORDS_MAX);
});

// 6판: 돌아보기·쪽지는 AI 없이 matchRisk만으로 살피므로 늘 살피는 말(빈 목록)이 놓치면 그대로 「괜찮아」 답이 간다
const core = (rows: [string, string[]][]) => {
  for (const [text, want] of rows) assert.deepEqual(matchRisk(text, []), want, text);
};

test("한국어: 손목을 그은 말은 지난 일·띄어 쓴 꼴·칼로 그은 말도 늘 살피는 말로 찾는다(그을리다는 빼고)", () => {
  for (const text of [
    "손목을 그었어", "손목 그었어요", "칼로 손목을 그었어", "커터칼로 손목을 그었다", "손목을 칼로 그었다", "손목 긋고 싶다",
    "손목을 그어 버렸어", "손목을 그을 거야", "손목을 긋는 상상", "손목 그은 자국", "손목ㅠㅠ그었어",
  ]) assert.deepEqual(matchRisk(text, []), ["손목을 긋"], text);
  core([["손목이 햇볕에 그을렸어", []], ["햇볕에 손목을 그을렸어", []], ["손목시계를 샀어요", []], ["손목으로 선을 그었어", []]]);
  // 손목에 칼을 댄 말은 뺄 수 있는 기본 목록에(「손목에 칼라밴드」는 빼고)
  check([["손목에 칼을 댔어", ["손목에 칼"]], ["손목에 칼라밴드를 찼어", []]]);
});

test("일본어: 작은 모음을 제 모음 자리에 쳐도(しにたぃ·シニタィ·ｼﾆﾀｨ) 찾는다", () => {
  core([
    ["しにたぃ", ["しにたい"]], ["死にたぃ", ["死にたい"]], ["もぅしにたぃ", ["しにたい"]], ["きえたぃ", ["きえたい"]], ["消えたぃ", ["消えたい"]],
    ["シニタィ", ["しにたい"]], ["ｼﾆﾀｨ", ["しにたい"]], ["いなくなりたぃ", ["いなくなりたい"]], ["しにたぃょ", ["しにたい"]],
    ["いきていたくなぃ", ["いきていたくない"]], ["しにたーぃ", ["しにたい"]],
    ["しにたぁい", ["しにたい"]], ["しにたいぃ", ["しにたい"]], // 늘임 모음은 그대로 건넌다
  ]);
  // 큰 모음으로 바꾼 글에서도 평범한 말은 가린다
  core([["わたしにたぃせつなともだち", []], ["ちぃさいねこ", []], ["おねぇちゃんとあそんだ", []]]);
});

test("한국어: 「사는 게 싫」「살기 싫」 사이에 꾸밈말이 세 개까지·「것도」「것 자체가」가 끼어도 찾는다", () => {
  core([
    ["사는 게 너무너무 싫어", ["사는 게 싫"]], ["사는 게 너무 너무 싫어", ["사는 게 싫"]], ["사는 게 너무나 싫어", ["사는 게 싫"]],
    ["사는 게 정말 너무 싫어", ["사는 게 싫"]], ["사는 게 진짜 너무너무 싫어", ["사는 게 싫"]], ["살기가 너무너무 싫어", ["살기 싫"]],
    ["살기 너무나 싫어", ["살기 싫"]], ["사는 것도 싫어", ["사는 게 싫"]], ["사는 것 자체가 싫어", ["사는 게 싫"]], ["살기시름", ["살기 싫"]],
    ["사는 거 시름", ["사는 거 싫"]],
  ]);
  // 꾸밈말이 아닌 말이 끼거나 싫지 않은 말은 그대로
  core([["사는 게 너무 좋아", []], ["살기 너무 좋은 동네", []], ["사는 게 너무 힘들지만 재밌어", []], ["살기 위해 싫은 음식도 먹어요", []]]);
  // 물건을 사는 곳(가게·마트·문구점…에서 사는) 말은 빼고, 사는 곳이 없는 「사는 건 싫어요」는 그대로 찾는다
  core([
    ["가게에서 사는 건 시러", []], ["문구점에서 사는 건 싫고 마트에서 살래", []], ["인터넷으로 사는 게 싫어", []],
    ["사는 건 싫어요", ["사는 거 싫"]],
  ]);
});

test("한국어: 「죽고파」「사라지고파」처럼 「-고 싶어」를 줄인 말(파 뒤에 낱말이 이어지면 빼고)", () => {
  core([
    ["죽고파", ["죽고파"]], ["죽고파요", ["죽고파"]], ["죽고 파", ["죽고파"]], ["죽고팠어", ["죽고파"]], ["죽고퍼", ["죽고파"]],
    ["진짜 죽고파 ㅠㅠ", ["죽고파"]], ["죽구파", ["죽구파"]], ["사라지고파", ["사라지고파"]], ["없어지고파", ["없어지고파"]],
    ["사라지구파요", ["사라지고파"]],
  ]);
  core([
    ["구름이 없어지고 파란 하늘이 나왔어", []], ["무지개가 사라지고 파도가 쳤어", []], ["캐릭터가 죽고 파워업 했어", []],
    ["불이 꺼지고 파티가 시작됐어", []], ["놀고파", []], ["집에 가고파", []],
  ]);
});

test("한국어: 문장을 여는 「자,」「자!」「자~」 뒤의 말은 자해·자살로 보지 않는다(기호로 끊은 「자*해」「자.살」은 찾는다)", () => {
  core([
    ["자,해 보자", []], ["자!해봐", []], ["자~해보자", []], ["자.해볼까", []], ["자,해바라기 그리자", []], ["자,살펴보자", []],
    ["자...살금살금", []], ["자~살살 해", []], ["자!살펴볼까요", []], ["자.해가 졌어요", []], ["자~해야지", []], ["자?해볼래", []],
  ]);
  check([["왕!따라와", []], ["은,따뜻해", []], ["왕.따라 해", []]]);
  core([
    ["자.살", ["자살"]], ["자.살 하고 싶어", ["자살"]], ["자.살했어", ["자살"]], ["자·살", ["자살"]], ["자~해 했어", ["자해"]],
    ["자*해 했어", ["자해"]], ["자-해", ["자해"]], ["자/해", ["자해"]], ["자ㅠㅠ해", ["자해"]], ["자💀해", ["자해"]], ["자_살", ["자살"]],
  ]);
  check([["왕~따 당했어", ["왕따"]], ["왕*따", ["왕따"]]]);
});

test("베트남어: bị와 đánh 사이에 vì·nên·khi·để·mà가 오면 잇지 않고, đánh 뒤가 깨뜨리기·떨어뜨리기·북·타자·장기면 빼고", () => {
  core([
    ["Con bị mẹ mắng vì đánh vỡ cốc", []], ["Em bị muộn vì mải đánh trống", []], ["Em bị điểm kém môn đánh máy", []],
    ["Em bị lạc mất bút nên đánh rơi", []], ["Em bị dính mưa nên đánh rơi ô", []], ["Em bị thua khi đánh cờ với bố", []],
    ["Đội em bị đội bạn đánh bại", []], ["Em bị mẹ nhắc đánh giày", []], ["Con bị sốt nhẹ mẹ đánh cảm cho con", []],
    ["Em bị ốm nhưng vẫn đánh đàn", []], ["em bi thua danh bai", []],
  ]);
  core([
    ["Con bị bố lấy roi đánh", ["bị đánh"]], ["Em bị bạn cùng lớp đánh", ["bị đánh"]], ["con bi bo lay roi danh", ["bị đánh"]],
    ["Con bị bố đánh vì con làm vỡ cốc", ["bị đánh"]], // vì가 đánh 뒤에 오면 그대로
    ["Con bị điểm kém thì bố đánh", ["bị đánh"]],
  ]);
});

test("중국어: 「被…打」 뒤가 젖다·깨지다·엎지르다·방해·감동·하품·컴퓨터면 빼고, 「打断」은 그대로", () => {
  core([
    ["我的衣服被雨打湿了", []], ["花瓶被弟弟打碎了", []], ["牛奶被妹妹打翻了", []], ["我写作业被弟弟打扰了", []], ["我被这个故事打动了", []],
    ["我被老师的话深深打动了", []], ["我被闹钟吵醒了打了个哈欠", []], ["我被蚊子咬了打了一个喷嚏", []], ["我被他逗笑了打了个嗝", []],
    ["我被妈妈发现在打电脑游戏", []], ["杯子被我不小心打破了", []], ["我被老师表扬了打心底里高兴", []], ["我被爸爸叫去打酱油", []],
  ]);
  core([["我被打断了腿", ["被打"]], ["我被爸爸打了", ["被打"]], ["我被同学打得很疼", ["被打"]]]);
});

test("영어: 한 글자씩 띄어 쓴 말은 앞 낱말(i·my)이 붙거나 wanna로 써도 찾고, 붙인 글에서도 문장을 넘지 않는다", () => {
  core([
    ["i w a n t t o d i e", ["want to die"]], ["I W A N T T O D I E", ["want to die"]], ["w a n n a d i e", ["want to die"]],
    ["h i t m e", ["hit me"]], ["i k i l l m y s e l f", ["kill myself"]], ["I want to d.i.e", ["want to die"]],
    // 제 글자로 붙는 말은 그대로
    ["k i l l m y s e l f", ["killmyself"]], ["w a n t t o d i e", ["wanttodie"]], ["I will k i l l m y s e l f", ["killmyself"]],
  ]);
  // 한 글자씩 띄어 쓴 말을 붙여도 문장이 끊긴 자리는 그대로(「bị … đánh」이 마침표를 넘지 않게)
  core([["Em bị ốm. Đánh nhau là xấu.", []], ["Em bị ốm. Đánh nhau là xấu. Em học chữ a b c.", []], ["I learned a b c d today", []]]);
  assert.deepEqual(matchRisk("Em học chữ a b c. Con bị bố đánh", []), ["bị đánh"]);
});

test("한국어: 수를 세는 「십 분」「십 년」, 「살기 실천」, 「죽치다」는 늘 살피는 말에 걸리지 않는다", () => {
  core([
    ["무지개가 사라지고 십 분 뒤에 비가 왔어", []], ["연기가 없어지고 십 분 있다가 들어갔어", []], ["게임에서 죽고 십 분 기다렸어", []],
    ["없어지고 십 년", []], ["사라지고 십 초 뒤에 나타났어", []], ["더불어 살기 실천 계획을 세웠어요", []], ["물고기 살기 실험을 했어요", []],
    ["함께 살기 실습", []], ["차라리 죽치고 앉아 있을래", []], ["게임 캐릭터가 죽고 시퍼런 화면이 나왔어", []],
  ]);
  core([
    ["죽고 십어", ["죽고 십"]], ["사라지고 십다", ["사라지고 십"]], ["없어지고 십음", ["없어지고 십"]], ["살기 실어", ["살기 실"]],
    ["살기 실타", ["살기 실"]], ["차라리 죽어 버릴래", ["죽어버", "차라리 죽"]], ["죽고 시퍼요", ["죽고 시퍼"]], ["죽고 시펐어", ["죽고 시퍼"]],
  ]);
});

test("다른 나라 말·한국어: 더 찾는 말(늘 살피는 말·6판 기본 목록)", () => {
  core([
    ["爸爸揍了我", ["揍了我"]], ["爸爸踢我", ["踢我"]], ["同学踢了我", ["踢了我"]], ["我被同学踢了", ["被踢"]],
    ["Bố tát con", ["tát con"]], ["Bạn đá con", ["đá con"]], ["Anh đá em", ["đá em"]], ["Bố mẹ đánh đập con", ["đánh đập"]],
    ["bo tat con", ["tát con"]], ["my dad hitted me", ["hitted me"]], ["my dad hurted me", ["hurted me"]], ["my mom beated me", ["beated me"]],
    ["I want to end it all", ["end it all"]], ["消えちゃいたい", ["消えちゃいたい"]], ["きえちゃいたい", ["きえちゃいたい"]],
    ["나 죽었으면 좋겠어", ["나 죽었으면 좋겠"]], ["그냥 나 죽었으면 좋겠어", ["나 죽었으면 좋겠"]],
  ]);
  // 평범한 말: 공 차기·피부(da con)·깨우기·축구·「끝내는 다 잘됐다」·나무가 죽은 말
  core([
    ["我被选去踢足球", []], ["我们一起踢球", []], ["Con thích đá bóng", []], ["Da con bị ngứa", []], ["da con bi kho", []],
    ["In the end it all worked out", []], ["나무가 죽었으면 좋겠어", []], ["모기나 죽었으면 좋겠다", []], ["I hitted the ball", []],
  ]);
  // 6판 기본 목록(선생님이 뺄 수 있다): 목을 조른 말·패다·처맞다·kms
  check([
    ["아빠가 목을 졸랐어", ["목을 졸"]], ["목 졸랐어", ["목 졸"]], ["아빠가 날 패", ["날 패"]], ["아빠가 날 팼어", ["날 팼"]],
    ["형이 나를 팼어", ["나를 패"]], ["아빠가 나를 패요", ["나를 패"]], ["아빠한테 처맞았어", ["처맞"]], ["gonna kms", ["kms"]],
    ["I want to kms", ["kms"]],
  ]);
  check([
    ["날 패스해 줘", []], ["친구가 나를 패스했어", []], ["다음 날 패션쇼에 갔어", []], ["그날 패배해서 속상했어", []],
    ["생일날 패밀리 레스토랑에 갔어", []], ["목 졸업식에서 노래했어", []], ["We ran 5 kms today", []], ["kmsa", []],
  ]);
  for (const w of ["목을 졸", "목 졸", "날 패", "날 팼", "나를 패", "처맞", "손목에 칼", "kms"]) {
    assert.ok(DEFAULT_RISK_WORDS.includes(w) && !RISK_CORE.includes(w), w);
  }
});

test("한 문구에 짧은 말과 그 말을 감싸는 긴 말이 함께 걸리면 긴 말 하나만 보여 준다", () => {
  check([
    ["옥상에서 뛰어내리고 싶어", ["옥상에서 뛰어내리고 싶"]],
    ["나 죽었으면 좋겠어", ["나 죽었으면 좋겠"]],
    ["パパがぼくをなぐった", ["ぼくをたたく"]],
  ]);
  // 선생님이 쓴 짧은 말이 먼저 걸려도 그 자리에 긴 말로 바꾼다(앞뒤 순서는 그대로)
  assert.deepEqual(matchRisk("아빠가 때렸어. 옥상에서 뛰어내리고 싶어", ["때렸", "뛰어내리고 싶"]), ["때렸", "옥상에서 뛰어내리고 싶"]);
  // 겹치기만 하는 말은 둘 다(「차라리 죽」「죽는 게 나아」)
  core([["차라리 죽는 게 나아", ["차라리 죽", "죽는 게 나아"]]]);
});
