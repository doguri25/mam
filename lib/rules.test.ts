// 실행: node --test lib/
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoRecords } from "./demo.ts";
import { absentStudents, leaks, matchRisk, watchFlags, weekStats } from "./rules.ts";
import { DEFAULT_RISK_WORDS, type MoodRecord } from "./shared.ts";

const TODAY = "2026-10-21";

function rec(no: number, date: string, slot: "am" | "pm", emotion: string, intensity = 3, reason = "친구"): MoodRecord {
  return {
    id: `${no}_${date}_${slot}`, no, date, slot, method: "card", emotion, intensity, reason,
    summary: "", question: "", answer: "", risk: false, riskHits: [], riskChecked: null, createdAt: "",
  };
}

test("시연 데이터는 3·11·17번만 살펴볼 학생, 22번만 위험 표현", () => {
  const records = demoRecords(TODAY);
  assert.deepEqual(watchFlags(records, TODAY).map((f) => f.no), [3, 11, 17]);
  assert.deepEqual([...new Set(records.filter((r) => r.risk).map((r) => r.no))], [22]);
});

test("오늘 좋은 마음이면 힘든 날 연속이 끊긴다", () => {
  const list = [
    rec(1, "2026-10-18", "am", "슬퍼요"), rec(1, "2026-10-19", "am", "화나요", 3, "집"),
    rec(1, "2026-10-20", "am", "속상해요", 3, "공부"), rec(1, TODAY, "am", "기뻐요"),
  ];
  assert.deepEqual(watchFlags(list, TODAY), []);
  assert.equal(watchFlags(list.slice(0, 3), "2026-10-20")[0].no, 1);
});

test("7일보다 오래된 기록은 세지 않는다", () => {
  const list = ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) => rec(2, d, "am", "슬퍼요"));
  assert.deepEqual(watchFlags(list, TODAY), []);
});

test("교사가 바꾼 규칙 숫자를 따른다", () => {
  const list = [rec(4, "2026-10-20", "am", "슬퍼요"), rec(4, TODAY, "am", "화나요", 3, "집")];
  assert.deepEqual(watchFlags(list, TODAY), []);
  assert.equal(watchFlags(list, TODAY, { streakDays: 2, dropDays: 9, reasonTimes: 9, absentDays: 2 })[0].no, 4);
});

test("반 기록이 있던 최근 n일 동안 기록이 없는 학생만 「기록 없음」", () => {
  // 1번은 19·20·21일, 2번은 19일만 기록
  const list = ["2026-10-19", "2026-10-20", TODAY].map((d) => rec(1, d, "am", "기뻐요"));
  list.push(rec(2, "2026-10-19", "am", "기뻐요"));
  assert.deepEqual(absentStudents(list, [1, 2, 3], TODAY, 2), [2, 3]);
  assert.deepEqual(absentStudents(list, [1, 2, 3], TODAY, 3), [3]);
  assert.deepEqual(absentStudents([], [1], TODAY, 2), []); // 반 기록이 모자라면 판단하지 않음
});

test("위험 단어는 띄어쓰기가 달라도 찾고, 평범한 말은 지나간다", () => {
  assert.deepEqual(matchRisk("그냥  사라지고 싶어요", DEFAULT_RISK_WORDS), ["사라지고 싶"]);
  assert.deepEqual(matchRisk("받아쓰기 다 맞았어요!", DEFAULT_RISK_WORDS), []);
  assert.deepEqual(matchRisk("친구랑 놀아서 신났어요", DEFAULT_RISK_WORDS), []);
});

test("응원 초안에서 선생님용 표현을 찾는다", () => {

  assert.deepEqual(leaks("가라앉은 날이 두 번이나 있었구나"), ["두 번"]);
  assert.deepEqual(leaks("사흘째 속상했구나. 한줄에도 적었지"), ["사흘", "한줄"]);
  assert.deepEqual(leaks("한 번 더 이야기해 줘서 고마워. 내일도 만나자"), []);
});

test("주간 숫자 묶음에는 이름·번호가 없고, 감정 단어 종류를 센다", () => {
  const a = { ...rec(1, "2026-10-20", "am", "기뻐요"), word: "뿌듯해요" };
  const b = { ...rec(1, "2026-10-20", "pm", "속상해요", 3, "친구"), word: "실망했어요" };
  const c = { ...rec(2, "2026-10-21", "am", "기뻐요"), word: "뿌듯해요" };
  const s = weekStats([a, b, c], [{ ...rec(3, "2026-10-12", "am", "기뻐요"), word: "즐거워요" }], { streakDays: 3, dropDays: 2, reasonTimes: 3, absentDays: 2 }, TODAY);
  assert.equal(s.기록한학생수, 2);
  assert.equal(s.하교전가라앉은날, 1);
  assert.deepEqual(s.쓴감정단어, [["뿌듯해요", 2], ["실망했어요", 1]]);
  assert.equal(s.쓴감정단어종류, 2);
  assert.equal(s.지난주감정단어종류, 1);
  assert.ok(!JSON.stringify(s).includes('"no"'));
});
