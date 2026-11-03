// 학급 사회·정서역량 진단 점수 계산
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanCheck, compScores, levelOf, overall, strongWeak, summaryText } from "./selcheck.ts";

const A = [4, 3, 5, 2, 4, 3, 4, 1, 5, 4, 3, 2, 4, 5, 3, 4, 2, 3, 4, 3]; // 캔바 체크리스트로 해 본 답

test("역량 점수·전체 평균은 캔바 체크리스트와 같다", () => {
  assert.deepEqual(compScores(A), [3.5, 3, 3.5, 4, 3]);
  assert.equal(overall(A), 3.4);
});

test("수준: 4.0 이상 상, 3.0~3.9 중, 그 아래 하", () => {
  assert.equal(levelOf(4), "상");
  assert.equal(levelOf(3.99), "중");
  assert.equal(levelOf(3), "중");
  assert.equal(levelOf(2.75), "하");
});

test("강점·보완은 같은 점수면 모두, 모두 같으면 보완 없음", () => {
  assert.deepEqual(strongWeak([3.5, 3, 3.5, 4, 3]), { strong: [3], weak: [1, 4] });
  assert.deepEqual(strongWeak([3, 3, 3, 3, 3]), { strong: [0, 1, 2, 3, 4], weak: [] });
});

test("요약 글은 담당 선생님께 보내던 모양 그대로", () => {
  const text = summaryText({ id: "x", date: "2026-11-03", school: "테스트초", group: "3학년 1반", rater: "테스트", answers: A, memo: "", createdAt: "" });
  assert.equal(text, "[테스트초/3학년 1반] 작성자:테스트 (2026. 11. 3.)\n전체평균:3.40\n정서인식및조절:3.5 자기관리:3 공감하기:3.5 긍정적관계맺기:4 책임있는행동:3");
});

test("저장 전에 답·날짜를 확인한다", () => {
  assert.equal(cleanCheck({ date: "2026-11-03", answers: A.slice(0, 19) }), null);
  assert.equal(cleanCheck({ date: "2026-11-03", answers: [...A.slice(0, 19), 6] }), null);
  assert.equal(cleanCheck({ date: "11/3", answers: A }), null);
  assert.equal(cleanCheck({ date: "2026-11-03", answers: A, rater: "<b>담임</b>" })?.rater, "b담임/b");
});
