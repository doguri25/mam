// 체험 반 시각: 실제 기록처럼 ISO(Z)로 적혀 있어 글자로 견줘도 때 순서와 같다
import assert from "node:assert/strict";
import { test } from "node:test";
import { demoExtras, demoRecords, demoRiskActions, demoSelfChecks } from "./demo.ts";

const TODAY = "2026-11-05";
const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

test("체험 기록·쪽지·돌아보기·조치·역량 진단 시각은 모두 ISO(Z), 한국 시각 그대로", () => {
  const recs = demoRecords(TODAY);
  const am = recs.find((r) => r.id === `1_${TODAY}_am`)!;
  assert.equal(am.createdAt, "2026-11-04T23:40:00.000Z"); // 11월 5일 08:40 한국 시각
  const times = [
    ...recs.flatMap((r) => [r.createdAt, ...(r.riskChecked ? [r.riskChecked] : []), ...(r.calm ?? []).map((c) => c.at)]),
    ...demoExtras(TODAY).letters.flatMap((l) => [l.createdAt, ...(l.checkedAt ? [l.checkedAt] : [])]),
    ...demoExtras(TODAY).reflects.map((r) => r.createdAt),
    ...demoRiskActions(TODAY).map((a) => a.createdAt),
    ...demoSelfChecks(TODAY).answers.map((a) => a.at),
    ...demoSelfChecks(TODAY).notes.flatMap((n) => [n.at, ...(n.feedback ? [n.feedback.at] : []), ...(n.seenAt ? [n.seenAt] : [])]),
  ];
  for (const t of times) assert.match(t, iso);
  // 늦게 도착한 끊김 기록(같은 날 08:50 한국 시각)은 체험 아침 기록보다 나중 → 글자 비교도 때 비교와 같다
  const queued = new Date("2026-11-05T08:50:00+09:00").toISOString();
  assert.ok(queued > am.createdAt && Date.parse(queued) > Date.parse(am.createdAt));
});
