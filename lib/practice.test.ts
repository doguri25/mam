// 연습 데이터 정리·명단 읽기·한국 시간 기준 보관 정리
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-practice-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const { clearPractice, getRiskActions, getRoster, purgeBefore, readRoster, rosterIsDemo, saveRiskActions, saveRoster } = await import("./data.ts");

test("명단 읽기: 읽지 못한 줄을 알려 주고, 연습 학생을 실제 학생으로 바꾸면 연습 표시·동의 날짜를 뗀다", () => {
  const old = [
    { no: 1, alias: "가나", code: "AAA111", consent: "2026-09-05", demo: true },
    { no: 2, alias: "다라", code: "BBB222", consent: "2026-09-05", demo: true },
    { no: 3, alias: "햇살", code: "CCC333", consent: "2026-10-01" },
  ];
  const { students, skipped } = readRoster("1 가나\n2 진짜학생\n3 햇살\n3 중복번호\n26번 새친구\n4 열세글자가넘는아주긴가명입니다\n\n5 바람", old);
  assert.deepEqual(skipped, ["3 중복번호", "26번 새친구", "4 열세글자가넘는아주긴가명입니다"]);
  assert.deepEqual(students.map((s) => [s.no, s.alias, s.demo ?? false, s.consent ?? ""]), [
    [1, "가나", true, "2026-09-05"], // 그대로 둔 연습 학생
    [2, "진짜학생", false, ""], // 실제 학생으로 바꿈: 동의 날짜를 넘기지 않음
    [3, "햇살", false, "2026-10-01"], // 실제 학생 동의는 그대로
    [5, "바람", false, ""],
  ]);
});

test("연습 데이터만 지우기: 연습 학생과 그 흔적만 지우고 실제 학생·기록은 그대로", async () => {
  await inSpace("cpractice", async () => {
    await saveRoster([
      { no: 1, alias: "가나", code: "AAA111", demo: true },
      { no: 2, alias: "진짜", code: "BBB222" },
    ], true);
    assert.equal(await rosterIsDemo(), true);
    await db().setMany("records", [
      ["1_2026-11-03_am", { id: "1_2026-11-03_am", no: 1, date: "2026-11-03", demo: true }],
      ["2_2026-11-03_am", { id: "2_2026-11-03_am", no: 2, date: "2026-11-03" }],
      ["9_2026-03-03_am", { id: "9_2026-03-03_am", no: 9, date: "2026-03-03" }], // 명단에서 빠진 실제 학생의 지난 기록
    ]);
    await db().set("letters", "l1", { id: "l1", from: 1, to: 2, demo: true });
    await db().set("letters", "l2", { id: "l2", from: 2, to: 1 }); // 실제 학생이 연습 학생에게 쓴 쪽지
    await db().set("letters", "l3", { id: "l3", from: 2, to: 9 });
    await db().set("reflects", "1_2026-11-02", { id: "1_2026-11-02", no: 1, demo: true });
    await db().set("cheers", "c1", { id: "c1", no: 1 });
    await db().set("cheers", "c2", { id: "c2", no: 2 });
    await saveRiskActions([
      { id: "a1", no: 1, recordId: "1_2026-11-03_am", recordDate: "2026-11-03", date: "2026-11-03", kinds: ["talk"], note: "", createdAt: "" },
      { id: "a2", no: 2, recordId: "2_2026-11-03_am", recordDate: "2026-11-03", date: "2026-11-03", kinds: ["watch"], note: "", createdAt: "" },
    ]);
    await clearPractice();
    assert.deepEqual((await getRoster()).map((s) => s.no), [2]);
    assert.equal(await rosterIsDemo(), false);
    assert.deepEqual((await db().all<{ id: string }>("records")).map((r) => r.id).sort(), ["2_2026-11-03_am", "9_2026-03-03_am"]);
    assert.deepEqual((await db().all<{ id: string }>("letters")).map((r) => r.id), ["l3"]);
    assert.deepEqual(await db().all("reflects"), []);
    assert.deepEqual((await db().all<{ id: string }>("cheers")).map((r) => r.id), ["c2"]);
    assert.deepEqual((await getRiskActions()).map((a) => a.id), ["a2"]);
  });
});

test("보관 정리는 한국 날짜로: 기한 날 아침(한국 0~9시)에 쓴 글은 지우지 않는다", async () => {
  await inSpace("ckst", async () => {
    await db().set("cheers", "early", { id: "early", no: 1, createdAt: "2027-02-28T23:30:00.000Z" }); // 3월 1일 08:30 한국 시각
    await db().set("cheers", "late", { id: "late", no: 1, createdAt: "2027-02-28T14:00:00.000Z" }); // 2월 28일 23:00 한국 시각
    await purgeBefore("2027-03-01");
    assert.deepEqual((await db().all<{ id: string }>("cheers")).map((r) => r.id), ["early"]);
  });
});

test("명단 표시만 잘못 켜진 실제 명단은 「연습 데이터만 지우기」로 지우지 않는다", async () => {
  await inSpace("cwrongflag", async () => {
    await db().set("meta", "roster", { students: [{ no: 1, alias: "진짜", code: "REAL11" }, { no: 2, alias: "진짜둘", code: "REAL22" }], demo: true });
    await db().set("records", "1_2026-11-03_am", { id: "1_2026-11-03_am", no: 1, date: "2026-11-03" });
    await clearPractice();
    assert.deepEqual((await getRoster()).map((s) => s.no), [1, 2]);
    assert.deepEqual((await db().all<{ id: string }>("records")).map((r) => r.id), ["1_2026-11-03_am"]);
  });
});
