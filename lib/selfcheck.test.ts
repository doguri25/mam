// 학생 자기진단: 역량마다 2문항 · 5개 언어 · 점수 계산 · 먼저 살펴볼 학생
import assert from "node:assert/strict";
import { test } from "node:test";
import { SEL_COMPS } from "./selcheck.ts";
import { SELF_ANSWER, SELF_ITEMS, classComps, cleanSelfAnswers, itemCounts, pctOf, selfComps, selfWatch, type SelfAnswer } from "./selfcheck.ts";
import { demoSelfChecks } from "./demo.ts";

test("10문항, 역량마다 2문항, 다섯 언어가 모두 있다", () => {
  assert.equal(SELF_ITEMS.length, 10);
  for (const c of SEL_COMPS) assert.equal(SELF_ITEMS.filter((x) => x.comp === c.key).length, 2, c.name);
  for (const it of SELF_ITEMS) for (const l of ["ko", "en", "zh", "vi", "ja"] as const) assert.ok(it.text[l].length > 3, `${it.text.ko} ${l}`);
  for (const v of [1, 2, 3] as const) assert.ok(SELF_ANSWER[v].ko && SELF_ANSWER[v].face);
});

test("답은 1~3 정수 10개만 받는다", () => {
  assert.deepEqual(cleanSelfAnswers(Array(10).fill(2)), Array(10).fill(2));
  assert.equal(cleanSelfAnswers(Array(9).fill(2)), null);
  assert.equal(cleanSelfAnswers([...Array(9).fill(2), 4]), null);
  assert.equal(cleanSelfAnswers("x"), null);
});

test("역량 점수·반 평균·문항별 수·같은 눈금", () => {
  const a = [3, 3, 1, 1, 2, 3, 3, 3, 1, 2];
  assert.deepEqual(selfComps(a), [3, 1, 2.5, 3, 1.5]);
  assert.deepEqual(classComps([a, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]), [2, 1, 1.75, 2, 1.25]);
  assert.deepEqual(classComps([]), [null, null, null, null, null]);
  assert.deepEqual(itemCounts([a, a])[2], [0, 0, 2]);
  assert.equal(pctOf(3, 3), 100);
  assert.equal(pctOf(3, 5), 50);
});

test("먼저 살펴볼 학생: 한 역량 두 문항 모두 아니에요, 또는 평균이 0.5 넘게 내려감", () => {
  const A = (no: number, answers: number[]): SelfAnswer => ({ kind: "selfAnswer", round: "r", no, answers, at: "" });
  const now = [A(1, [1, 1, 3, 3, 3, 3, 3, 3, 3, 3]), A(2, Array(10).fill(2)), A(3, Array(10).fill(3))];
  const before = [A(2, Array(10).fill(3)), A(3, Array(10).fill(3))];
  assert.deepEqual(selfWatch(now, before).map((x) => x.no), [1, 2]);
});

test("먼저 살펴볼 학생: 딱 0.5 내려간 것은 「0.5 넘게」가 아니라 넣지 않는다", () => {
  const A = (no: number, answers: number[]): SelfAnswer => ({ kind: "selfAnswer", round: "r", no, answers, at: "" });
  const before = [A(1, Array(10).fill(3)), A(2, Array(10).fill(3))];
  const now = [A(1, [3, 3, 3, 3, 3, 2, 2, 2, 2, 2]), A(2, [3, 3, 3, 3, 2, 2, 2, 2, 2, 2])]; // 평균 2.5(−0.5) · 2.4(−0.6)
  const out = selfWatch(now, before);
  assert.deepEqual(out.map((x) => x.no), [2]);
  assert.deepEqual(out[0].why, ["지난 회차보다 평균 0.6점 내려감"]);
});

test("연습 회차: 학기 초는 닫혔고 학기 말은 열려 있으며, 공감은 오르고 책임 행동은 제자리", () => {
  const { rounds, answers } = demoSelfChecks("2026-11-04");
  assert.equal(rounds.length, 2);
  assert.ok(rounds[0].closedAt && !rounds[1].closedAt);
  const of = (r: string) => answers.filter((a) => a.round === r).map((a) => a.answers);
  assert.equal(of(rounds[0].id).length, 25);
  assert.ok(of(rounds[1].id).length >= 18 && of(rounds[1].id).length < 25); // 아직 안 한 학생이 있다
  const [b, n] = [classComps(of(rounds[0].id)), classComps(of(rounds[1].id))];
  assert.ok(n[2]! - b[2]! >= 0.3, "공감이 오름");
  assert.ok(Math.abs(n[4]! - b[4]!) < 0.25, "책임 행동은 제자리");
  for (const a of answers) assert.ok(cleanSelfAnswers(a.answers));
});
