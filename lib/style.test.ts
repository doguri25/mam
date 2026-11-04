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

test("따옴표 안의 학생 말은 그대로 두고, 표현 찾기에서도 뺀다", () => {
  assert.equal(polish("“글씨가 보여졌어요”라고 썼어요. 모습이 보여진다."), "“글씨가 보여졌어요”라고 썼어요. 모습이 보인다.");
  assert.equal(polish("「결론적으로 좋아요」라고 함"), "「결론적으로 좋아요」라고 함");
  assert.deepEqual(styleHits("학생이 \"친구를 통해 알았어요\"라고 씀"), []);
});

test("여러 칸을 고치고 남은 표현을 모은다", () => {
  const { value, hits } = polishAll({ a: "모습이 보여진다.", b: "대화를 통해 알게 됨", n: 3 }, ["a", "b", "n"]);
  assert.equal(value.a, "모습이 보인다.");
  assert.equal(value.n, 3);
  assert.deepEqual(hits, ["「~를 통해」 → 「~로」"]);
  assert.ok(STYLE_RULES.includes("첫째") && STYLE_RULES.includes("통해"));
});
