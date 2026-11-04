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
    "I want to live in a big house someday",
  ],
  zh: [
    "今天很开心", "我和朋友一起玩", "我打篮球了", "我吃了苹果", "妈妈做了饺子", "我喜欢画画", "我们去公园了", "老师表扬我了",
    "我想回家吃饭", "我想睡觉", "下雨了，我带了伞", "我的狗很可爱", "今天考试考得很好", "我们唱歌了", "我读了一本书",
    "打扫教室很累", "我给妈妈打电话", "我很平静", "我们一起做游戏", "弟弟哭了，我安慰他", "今天天气很好", "我学会了游泳",
    "我想快点长大", "我想吃冰淇淋", "我们班赢了比赛", "爸爸带我去动物园", "我帮奶奶打扫房间", "我们在操场上跑步",
    "我画了一只猫", "明天要去旅行，我很期待",
  ],
  ja: [
    "きょうはたのしかった", "ともだちとあそんだ", "おかあさんがケーキをつくってくれた", "がっこうでえをかいた", "先生にほめられた",
    "かぎをみつけられた", "せんせいにたすけられた", "わたしにたいしてやさしい", "わたしにたいせつなともだち",
    "わたしにたいへんなことがあったけど、だいじょうぶ", "いえにかえってしゅくだいをした", "はやくうちにかえりたい",
    "きのうはあめだった", "サッカーをした", "イチゴをたべた", "ドッジボールでかった", "ともだちがなぐさめてくれた",
    "たたかいごっこをした", "ゆきがきえた", "ねこににげられた", "今日は楽しかったです", "友だちと公園で遊びました",
    "おにごっこをしました", "本をよみました", "ねこがかわいい", "あしたもがっこうにいきたい", "しゅくだいをおわらせた",
    "えんそくがたのしみ", "いぬとさんぽした", "おとうとがわらった", "きゅうしょくがおいしかった", "いちじさつまいもほりをした",
  ],
  vi: [
    "Hôm nay con rất vui", "Con chơi với bạn", "Mẹ bảo con làm từ từ", "me bao con lam tu tu", "Con thích ăn phở",
    "Con được điểm mười", "Con đi công viên với bố", "Bí danh của con là Mèo", "Con muốn về nhà sớm", "con muon ve nha choi",
    "Con đánh răng rồi", "con danh rang roi", "Em học đánh đàn piano", "Con chơi đánh cầu lông", "Hôm nay trời đẹp",
    "Con học bài xong rồi", "bat dau hoc bai", "Con muốn biết thêm", "con muon choi", "Tự làm bài tập", "tu lam bai tap",
    "con tu sap xep do choi", "Em bị đau bụng", "em bi dau bung", "Con thích vẽ tranh", "Con giúp mẹ nấu cơm",
    "Bạn con rất tốt bụng", "Con muốn đi biển", "con muon song o day", "Con không muốn ngủ trưa", "con khong muon ngu trua",
    "Con chơi trốn tìm với em",
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

test("기본 목록 판: 판마다 더한 말은 기본 목록에도 있고, 저장한 판 뒤에 더한 말만 돌려준다", () => {
  assert.equal(RISK_WORDS_V, 3);
  for (const ws of Object.values(RISK_WORDS_BY_V)) for (const w of ws) assert.ok(DEFAULT_RISK_WORDS.includes(w), w);
  assert.deepEqual(riskWordsAfter(2), RISK_WORDS_BY_V[3]);
  assert.deepEqual(riskWordsAfter(1), [...RISK_WORDS_BY_V[2], ...RISK_WORDS_BY_V[3]]);
  assert.deepEqual(riskWordsAfter(RISK_WORDS_V), []);
});

test("설정 판 올리기: v2 반은 v3 말만 받고(지운 v2 말은 그대로 없음), 처음 반은 새 기본 목록", async () => {
  const { inSpace, db } = await import("./db.ts");
  const { getSettings, saveSettings } = await import("./data.ts");
  const v2List = ["죽고 싶", "자해", "자살", "왕따", "한테 맞"]; // 선생님이 「때리」 「에게 맞」 들을 지운 목록
  await inSpace("crisk2", async () => {
    await db().set("meta", "settings", { riskWords: v2List, riskWordsV: 2 });
    const s = await getSettings();
    assert.deepEqual(s.riskWords, [...v2List, ...RISK_WORDS_BY_V[3]]);
    assert.ok(!s.riskWords.includes("때리") && !s.riskWords.includes("에게 맞"));
    assert.equal(s.riskWordsV, 3);
    // 선생님이 설정을 저장하면 판도 같이 남아, 그 뒤에 지운 말은 다시 들어오지 않는다
    await saveSettings({ ...s, riskWords: s.riskWords.filter((w) => w !== "때린") });
    assert.ok(!(await getSettings()).riskWords.includes("때린"));
  });
  await inSpace("crisk1", async () => {
    await db().set("meta", "settings", { riskWords: ["죽고 싶", "왕따"] }); // 판이 없던 예전 저장
    const s = await getSettings();
    assert.deepEqual(s.riskWords, ["죽고 싶", "왕따", ...RISK_WORDS_BY_V[2], ...RISK_WORDS_BY_V[3]]);
    assert.equal(s.riskWordsV, 3);
  });
  await inSpace("crisk0", async () => {
    const s = await getSettings(); // 설정을 한 번도 저장하지 않은 반
    assert.deepEqual(s.riskWords, DEFAULT_RISK_WORDS);
    assert.equal(s.riskWordsV, 3);
  });
});
