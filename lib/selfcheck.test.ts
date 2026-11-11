// 학급 역량 진단(학생 화면 「마음 점검」): 4개 영역 × 8문장 · 5단계 · 다섯 언어 · 점수와 수준 · 살펴보기 신호 · 연습 회차
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOMAINS, PER, SELF_ITEMS, SELF_SCALE, STUDENT_GUIDE, cleanObs, cleanPaper, cleanSelfAnswers, domainOfItem, domainScores, levelOf, obsMax, obsScores,
  scoresOf, selWatch, tierOf, unread, type SelNote, type SelfAnswer,
} from "./selfcheck.ts";
import { DOMAIN_GUIDE, OBS16, OBS32, OBS_SCALE } from "./selguide.ts";
import { demoSelfChecks } from "./demo.ts";

const LANGS = ["ko", "en", "zh", "vi", "ja"] as const;
const EMOJI = /\p{Extended_Pictographic}/u;

test("32문장, 영역마다 8문장, 다섯 언어가 모두 있다(한국어 그대로 옮기지 않음)", () => {
  assert.equal(DOMAINS.length, 4);
  assert.equal(SELF_ITEMS.length, DOMAINS.length * PER);
  assert.deepEqual([0, 7, 8, 15, 16, 31].map(domainOfItem), [0, 0, 1, 1, 2, 3]);
  for (const it of [...SELF_ITEMS, ...SELF_SCALE, ...DOMAINS.map((d) => d.text)])
    for (const l of LANGS) {
      assert.ok(it[l].trim().length > 1, `${it.ko} ${l}`);
      if (l !== "ko") assert.notEqual(it[l], it.ko, `${it.ko} ${l}`);
    }
  assert.equal(SELF_SCALE.length, 5);
});

test("학생에게 보이는 영역 이야기: 영역마다 세 단계, 해 볼 일 3개씩, 다섯 언어, 이모지 없음", () => {
  assert.equal(STUDENT_GUIDE.length, DOMAINS.length);
  for (const g of STUDENT_GUIDE)
    for (const tier of ["high", "mid", "low"] as const) {
      assert.equal(g[tier].tips.length, 3);
      for (const x of [g[tier].desc, ...g[tier].tips]) for (const l of LANGS) {
        assert.ok(x[l].length > 5, `${x.ko} ${l}`);
        assert.ok(!EMOJI.test(x[l]), `${x[l]}`);
      }
    }
});

test("선생님 쪽: 지도 가이드(영역 × 세 단계)와 관찰 간이 16 · 심층 32", () => {
  assert.equal(DOMAIN_GUIDE.length, DOMAINS.length);
  for (const g of DOMAIN_GUIDE) for (const tier of ["high", "mid", "low"] as const) assert.ok(g[tier].desc && g[tier].tips.length >= 3);
  assert.equal(OBS16.length, 16);
  assert.equal(OBS32.length, 32);
  assert.equal(OBS_SCALE.length, 5);
});

test("답은 1~5 정수 32개만 받는다(예전 10문항 답·소수·글자는 버림)", () => {
  assert.deepEqual(cleanSelfAnswers(Array(32).fill(3)), Array(32).fill(3));
  assert.equal(cleanSelfAnswers(Array(10).fill(2)), null);
  assert.equal(cleanSelfAnswers([...Array(31).fill(2), 6]), null);
  assert.equal(cleanSelfAnswers([...Array(31).fill(2), 2.5]), null);
  assert.equal(cleanSelfAnswers(Array(32).fill("3")), null);
  assert.equal(cleanSelfAnswers("x"), null);
});

test("영역 점수(8~40)와 수준: 85% 아주 잘함 · 65% 잘함 · 45% 자라나는 중 · 그 아래 도움 필요", () => {
  const a = [...Array(8).fill(5), ...Array(8).fill(1), ...Array(8).fill(3), ...[4, 4, 4, 4, 4, 4, 4, 2]];
  assert.deepEqual(domainScores(a), [40, 8, 24, 30]);
  assert.deepEqual([34, 33, 26, 25, 18, 17].map((s) => levelOf(s).name), ["아주 잘함", "잘함", "잘함", "자라나는 중", "자라나는 중", "도움 필요"]);
  assert.deepEqual([34, 26, 18, 17].map((s) => tierOf(s)), ["high", "mid", "mid", "low"]);
  // 관찰 간이는 영역 만점 20, 심층은 40
  const o16 = { mode: 16 as const, answers: [5, 5, 4, 3, 1, 1, 1, 1, 3, 3, 3, 3, 4, 4, 4, 4] };
  assert.deepEqual(obsScores(o16), [17, 4, 12, 16]);
  assert.equal(obsMax(o16), 20);
  assert.equal(levelOf(17, 20).name, "아주 잘함");
  assert.equal(obsMax({ mode: 32, answers: Array(32).fill(3) }), 40);
});

test("관찰·종이 점수 검사, 학생 답이 있으면 종이 점수보다 먼저", () => {
  assert.ok(cleanObs({ mode: 16, answers: Array(16).fill(4) }));
  assert.equal(cleanObs({ mode: 16, answers: Array(15).fill(4) }), null);
  assert.equal(cleanObs({ mode: 20, answers: Array(20).fill(4) }), null);
  assert.deepEqual(cleanPaper([8, 40, 20, 33]), [8, 40, 20, 33]);
  assert.equal(cleanPaper([7, 40, 20, 33]), null);
  assert.equal(cleanPaper([8, 41, 20, 33]), null);
  const ans: SelfAnswer = { kind: "selfAnswer", round: "r", no: 1, answers: Array(32).fill(2), at: "" };
  const note: SelNote = { kind: "selNote", round: "r", no: 1, paper: [30, 30, 30, 30], at: "" };
  assert.deepEqual(scoresOf(ans, note), [16, 16, 16, 16]);
  assert.deepEqual(scoresOf(null, note), [30, 30, 30, 30]);
  assert.equal(scoresOf(null, null), null);
  assert.equal(scoresOf({ ...ans, answers: Array(10).fill(3) }, null), null); // 예전 10문항 답은 쓰지 않음
});

test("안 읽은 피드백: 보낸 뒤 읽지 않았거나, 읽은 뒤 고쳐 다시 보냈으면", () => {
  const n = (seenAt: string | null): SelNote => ({ kind: "selNote", round: "r", no: 1, at: "", feedback: { text: "고마워", at: "2026-11-10T01:00:00.000Z" }, seenAt });
  assert.equal(unread(n(null)), true);
  assert.equal(unread(n("2026-11-10T02:00:00.000Z")), false);
  assert.equal(unread(n("2026-11-10T00:30:00.000Z")), true);
  assert.equal(unread({ kind: "selNote", round: "r", no: 1, at: "" }), false);
});

test("먼저 이야기 나눠 볼 신호: 도움 필요 · 견준 회차보다 6점 넘게 내려감 · 스스로 본 모습과 관찰이 크게 다름", () => {
  assert.deepEqual(selWatch([30, 30, 30, 30], null, null), []);
  assert.deepEqual(selWatch([30, 17, 30, 30], null, null), ["소통·협력 도움 필요"]);
  assert.deepEqual(selWatch([30, 30, 30, 23], [30, 30, 30, 30], null), ["견준 회차보다 내려감(마음돌봄 7점)"]);
  assert.deepEqual(selWatch([30, 30, 30, 24], [30, 30, 30, 30], null), []); // 딱 6점은 넣지 않음
  const obs = { mode: 16 as const, answers: [1, 1, 1, 2, ...Array(12).fill(4)] }; // 자기인식·관리 관찰 5/20 = 25%
  assert.deepEqual(selWatch([38, 32, 32, 32], null, obs), ["스스로 본 모습과 관찰이 다름: 자기인식·관리(학생이 더 높게)"]);
});

test("연습 회차: 학기 초는 닫혔고 학기 말은 열려 있으며, 자기인식·소통은 오르고 책임은 제자리, 17번 소통·협력 도움 필요", () => {
  const { rounds, answers, notes } = demoSelfChecks("2026-11-11");
  assert.equal(rounds.length, 2);
  assert.ok(rounds[0].closedAt && !rounds[1].closedAt);
  for (const a of answers) assert.ok(cleanSelfAnswers(a.answers), `${a.round} ${a.no}`);
  const of = (r: string) => answers.filter((a) => a.round === r);
  assert.equal(of(rounds[0].id).length, 25);
  assert.equal(of(rounds[1].id).length, 20);
  for (const no of [5, 8]) assert.ok(!of(rounds[1].id).some((a) => a.no === no), "체험 학생 화면(1~8번)에서 처음부터 해 볼 학생");
  const mean = (r: string, d: number) => of(r).reduce((s, a) => s + domainScores(a.answers)[d], 0) / of(r).length;
  assert.ok(mean("selfp2", 0) - mean("selfp1", 0) >= 2, "자기인식·관리 오름");
  assert.ok(mean("selfp2", 1) - mean("selfp1", 1) >= 2, "소통·협력 오름");
  assert.ok(Math.abs(mean("selfp2", 2) - mean("selfp1", 2)) < 2, "책임 제자리");
  const s17 = domainScores(of("selfp2").find((a) => a.no === 17)!.answers);
  assert.equal(levelOf(s17[1]).name, "도움 필요");
  const s3 = [of("selfp1"), of("selfp2")].map((xs) => domainScores(xs.find((a) => a.no === 3)!.answers));
  assert.ok(s3[0].every((v, d) => v - s3[1][d] > 6), "3번은 모든 영역에서 크게 내려감");
  // 선생님 쪽 기록은 모두 연습 표시, 관찰은 바른 모양, 보낸 말에는 점수·수준 이름이 없다
  for (const n of notes) {
    assert.ok(n.demo);
    if (n.obs) assert.ok(cleanObs(n.obs));
    if (n.feedback) assert.doesNotMatch(n.feedback.text, /아주 잘함|자라나는 중|도움 필요|점수|진단/);
  }
  assert.ok(notes.some((n) => n.no <= 8 && unread(n)), "체험 학생 화면에서 안 읽은 선생님 말을 볼 수 있다");
});
