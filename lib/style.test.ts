// 번역투·기계식 표현: 확실한 것은 바로 고치고, 남은 것은 찾아 알린다
import assert from "node:assert/strict";
import { test } from "node:test";
import { STYLE_RULES, polish, polishAll, styleHits } from "./style.ts";

test("이중 피동을 바로 끊는다", () => {
  assert.equal(polish("변화가 보여진다."), "변화가 보인다.");
  assert.equal(polish("마음이 차분해진 모습이 보여졌어요."), "마음이 차분해진 모습이 보였어요.");
  assert.equal(polish("문제가 발생되어진다"), "문제가 발생된다");
  assert.equal(polish("발생되어졌다"), "발생되었다");
  assert.equal(polish("보여지는 감정"), "보이는 감정");
  assert.equal(polish("활동지에 쓰여진 말"), "활동지에 쓰인 말");
  assert.equal(polish("잘 보여집니다"), "잘 보입니다");
  assert.equal(polish("나뉘어져 있어요"), "나뉘어 있어요");
  assert.equal(polish("잊혀질 거예요"), "잊힐 거예요");
  // 이중 피동이 아닌 말은 그대로
  assert.equal(polish("마음이 편안해졌어요. 만들어진 작품"), "마음이 편안해졌어요. 만들어진 작품");
  assert.equal(polish("보여 주었어요"), "보여 주었어요");
});

test("번역 조사와 끝맺음 공식을 고친다", () => {
  assert.equal(polish("이에 있어서 중요한 것은"), "여기서 중요한 것은");
  assert.equal(polish("친구 관계에 있어서 어려움이 보임"), "친구 관계에서 어려움이 보임");
  assert.equal(polish("친구가 옆에 있어서 좋았어요"), "친구가 옆에 있어서 좋았어요"); // 실제로 「있는」 말은 그대로
  assert.equal(polish("결론적으로, 마음이 나아졌어요."), "마음이 나아졌어요.");
  assert.equal(polish("힘든 날이 있었어요. 요약하자면 회복 중이에요."), "힘든 날이 있었어요. 회복 중이에요.");
  assert.equal(polish(""), "");
});

test("「~에 있어서」는 따로 쓴 번역 조사만 고치고, 실제로 「있는」 말은 그대로", () => {
  // 고침
  assert.equal(polish("이에 있어서, 선생님은 기다렸어요."), "여기서, 선생님은 기다렸어요.");
  assert.equal(polish("학습에 있어 중요한 것은 꾸준함이에요."), "학습에서 중요한 것은 꾸준함이에요.");
  assert.equal(polish("이 점에 있어서 차이가 보여요."), "이 점에서 차이가 보여요.");
  assert.equal(polish("이런 부분에 있어서 도움이 필요해요."), "이런 부분에서 도움이 필요해요.");
  assert.equal(polish("생활 지도에 있어서, 꾸준함이 필요해요."), "생활 지도에서, 꾸준함이 필요해요.");
  // 그대로(낱말 끝·장소·「있어요」)
  for (const s of [
    "친구 사이에 있어서 편했어요.",
    "종이에 있어요.",
    "종이에 있어서 잘 보였어요.",
    "매점에 있어서 샀어요.",
    "뒷면에 있어서 못 봤어요.",
    "학교 지도에 있어서 찾기 쉬웠어요.",
    "빨간 점에 있어서 금방 찾았어요.",
    "그림 아래 부분에 있어서 잘 안 보였어요.",
    "좋은 관계에 있어요.",
    "교우관계에 있었어요.",
  ]) assert.equal(polish(s), s);
});

test("끝맺음 공식을 뺄 때 이어지는 말도 함께 뺀다", () => {
  assert.equal(polish("결론적으로 말하면, 마음이 나아졌어요."), "마음이 나아졌어요.");
  assert.equal(polish("힘든 날이 있었어요. 결론적으로 보면 회복 중이에요."), "힘든 날이 있었어요. 회복 중이에요.");
  assert.equal(polish("종합적으로 볼 때, 친구와 잘 지내요."), "친구와 잘 지내요.");
  assert.equal(polish("결론적으로 이야기하면 즐거운 한 주였어요."), "즐거운 한 주였어요.");
  assert.equal(polish("종합적으로 생각하는 힘이 늘었어요."), "종합적으로 생각하는 힘이 늘었어요.");
});

test("바로 고치기 어려운 표현은 찾아서 알린다", () => {
  assert.deepEqual(styleHits("숨 고르기를 통해 마음을 가라앉혔어요."), ["「~를 통해」 → 「~로」"]);
  assert.ok(styleHits("첫째, 감정을 말해요. 둘째, 친구를 도와요.").some((h) => h.includes("첫째")));
  assert.ok(styleHits("이 변화는 시사하는 바가 크다.").length === 1);
  assert.ok(styleHits("다양한 요인에 의해 힘들어 보여요").length === 1);
  assert.ok(styleHits("단순한 활동을 넘어 새로운 패러다임").length === 1);
  assert.ok(styleHits("슬픔이 아니라 아쉬움이에요. 실패가 아니라 연습이에요.").some((h) => h.includes("대조")));
  assert.deepEqual(styleHits("슬픔이 아니라 아쉬움이에요."), []); // 한 번은 괜찮다
  assert.deepEqual(styleHits("친구와 놀아서 기뻤구나. 내일도 이야기해 줘요."), []);
});

test("표현 찾기는 낱말 경계를 지키고, 「첫째·둘째」는 번호로 늘어놓을 때만", () => {
  assert.ok(styleHits("그녀는 웃었다.").some((h) => h.includes("대명사")));
  assert.ok(styleHits("그는 그의 그림을 보여 줬다.").some((h) => h.includes("대명사")));
  assert.deepEqual(styleHits("블로그의 글을 읽었어요."), []);
  assert.deepEqual(styleHits("그녀석이 또 장난을 쳤어요."), []);
  assert.deepEqual(styleHits("첫째 언니가 도와줬어요. 둘째 오빠도 같이 놀았어요."), []);
  assert.deepEqual(styleHits("우리 집 첫째, 둘째가 모두 왔어요."), []);
  assert.ok(styleHits("첫째로 감정을 말해요. 둘째로 친구를 도와요.").some((h) => h.includes("첫째")));
  assert.ok(styleHits("- 첫째: 감정 말하기\n- 둘째: 친구 돕기").some((h) => h.includes("첫째")));
});

test("따옴표 안의 학생 말은 그대로 두고, 표현 찾기에서도 뺀다", () => {
  assert.equal(polish("“글씨가 보여졌어요”라고 썼어요. 모습이 보여진다."), "“글씨가 보여졌어요”라고 썼어요. 모습이 보인다.");
  assert.equal(polish("「결론적으로 좋아요」라고 함"), "「결론적으로 좋아요」라고 함");
  assert.deepEqual(styleHits("학생이 \"친구를 통해 알았어요\"라고 씀"), []);
});

test("홑따옴표도 따옴표로 보고, 닫히지 않은 따옴표는 뒤 글을 삼키지 않는다", () => {
  assert.equal(polish("'글씨가 보여졌어요'라고 썼어요. 모습이 보여진다."), "'글씨가 보여졌어요'라고 썼어요. 모습이 보인다.");
  assert.deepEqual(styleHits("학생이 '친구를 통해 알았어요'라고 씀"), []);
  // 닫히지 않은 따옴표: 뒤 글도 고친다
  assert.equal(polish("“글씨가 예뻐요 라고 씀. 모습이 보여진다."), "“글씨가 예뻐요 라고 씀. 모습이 보인다.");
  assert.equal(polish("「글씨가 예뻐요 라고 씀. 모습이 보여진다."), "「글씨가 예뻐요 라고 씀. 모습이 보인다.");
  // 떨어진 곧은따옴표가 뒤 따옴표와 짝지어져 사이 글을 감추지 않는다
  assert.equal(
    polish("학생이 \"친구가 좋아 라고 함. 모습이 보여진다. \"보여졌어\"라고도 씀"),
    "학생이 \"친구가 좋아 라고 함. 모습이 보인다. \"보여졌어\"라고도 씀",
  );
  // 영어 줄임표(don't)는 따옴표가 아님
  assert.equal(polish("don't 모습이 보여진다. it's"), "don't 모습이 보인다. it's");
  // 여러 따옴표가 섞여도 깨지지 않는다
  assert.equal(polish("“가”, '나', 「다」, 『라』, ‘마’ 모두 보여진다"), "“가”, '나', 「다」, 『라』, ‘마’ 모두 보인다");
  assert.equal(polish("“ ” '"), "“ ” '");
});

test("여러 칸을 고치고 남은 표현을 모은다", () => {
  const { value, hits } = polishAll({ a: "모습이 보여진다.", b: "대화를 통해 알게 됨", n: 3 }, ["a", "b", "n"]);
  assert.equal(value.a, "모습이 보인다.");
  assert.equal(value.n, 3);
  assert.deepEqual(hits, ["「~를 통해」 → 「~로」"]);
  assert.ok(STYLE_RULES.includes("첫째") && STYLE_RULES.includes("통해"));
});
