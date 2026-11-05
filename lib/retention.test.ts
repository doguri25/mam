// 기록 보관 기한: 학년도(3월 1일 시작)·1년·2년
import assert from "node:assert/strict";
import { test } from "node:test";
import { PURGE_KO, cutoffOf, isRetention } from "./retention.ts";

test("학년도: 3월부터는 그해 3월 1일, 1·2월에는 지난해 3월 1일 앞이 정리 대상", () => {
  assert.equal(cutoffOf("year", "2026-11-04"), "2026-03-01");
  assert.equal(cutoffOf("year", "2027-02-27"), "2026-03-01");
  assert.equal(cutoffOf("year", "2027-03-01"), "2027-03-01");
});

test("1년·2년: 같은 날짜, 윤년 2월 29일은 2월 28일로", () => {
  assert.equal(cutoffOf("12m", "2026-11-04"), "2025-11-04");
  assert.equal(cutoffOf("24m", "2026-11-04"), "2024-11-04");
  assert.equal(cutoffOf("12m", "2028-02-29"), "2027-02-28");
});

test("정해진 값만 받는다", () => {
  assert.ok(isRetention("year") && isRetention("24m"));
  assert.ok(!isRetention("6m") && !isRetention(undefined));
});

test("정리할 것 이름: 세는 것마다 화면에 보일 이름이 있다(「drafts 3」처럼 열쇠가 그대로 보이지 않게)", () => {
  // lib/data.ts expiredCounts·purgeBefore가 세는 열쇠
  for (const k of ["records", "cheers", "notes", "letters", "reflects", "sheets", "self", "risk", "drafts"]) assert.ok(PURGE_KO[k], k);
});
