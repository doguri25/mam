// 보관 기한 정리: 기한 앞 기록(학급 역량 진단 답·선생님 쪽 기록 포함)만 세고 지우며, 기한 뒤 기록·반 명단은 그대로 두고, 지운 수만 남긴다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-purge-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const { expiredCounts, getRiskActions, getSelNotes, getSelfAnswers, getSelfRounds, heldRisks, purgeBefore, purgeLogs, saveRiskActions, saveSelfRounds } = await import("./data.ts");

test("기한 앞의 학생 기록만 지우고, 지운 수를 남긴다", async () => {
  await inSpace("cpurge", async () => {
    const rec = (id: string, date: string) => [id, { id, no: 1, date, createdAt: `${date}T09:00:00+09:00` }] as [string, Record<string, unknown>];
    await db().setMany("records", [rec("old1", "2026-02-27"), rec("old2", "2026-02-28"), rec("new1", "2026-03-01"), rec("new2", "2026-11-04")]);
    await db().set("cheers", "c1", { id: "c1", no: 1, createdAt: "2026-02-10T10:00:00.000Z" });
    await db().set("cheers", "c2", { id: "c2", no: 1, createdAt: "2026-03-02T10:00:00.000Z" });
    await db().set("meta", "self_rold_1", { kind: "selfAnswer", round: "rold", no: 1, answers: Array(32).fill(2), at: "2026-02-01T00:00:00Z" });
    await db().set("meta", "self_rnew_1", { kind: "selfAnswer", round: "rnew", no: 1, answers: Array(32).fill(3), at: "2026-04-01T00:00:00Z" });
    await db().set("meta", "selnote_rold_1", { kind: "selNote", round: "rold", no: 1, memo: "학기 초 메모", at: "2026-02-03T00:00:00Z" });
    await db().set("meta", "selnote_rnew_1", { kind: "selNote", round: "rnew", no: 1, memo: "새 메모", at: "2026-04-02T00:00:00Z" });
    await saveSelfRounds([
      { id: "rold", title: "학기 초", openedAt: "2026-01-20", closedAt: "2026-02-02" },
      { id: "rnew", title: "학기 초", openedAt: "2026-03-30", closedAt: null },
    ]);
    await saveRiskActions([
      { id: "a1", no: 1, recordId: "old1", recordDate: "2026-02-27", date: "2026-02-27", kinds: ["talk"], note: "", createdAt: "" },
      { id: "a2", no: 1, recordId: "new2", recordDate: "2026-11-04", date: "2026-11-04", kinds: ["watch"], note: "", createdAt: "" },
    ]);
    await db().set("meta", "roster", { students: [{ no: 1, alias: "햇살", code: "ABC234" }] });

    const counts = await expiredCounts("2026-03-01");
    assert.deepEqual([counts.records, counts.cheers, counts.self, counts.selNote, counts.risk, counts.notes], [2, 1, 1, 1, 1, 0]);

    const log = await purgeBefore("2026-03-01");
    assert.equal(log.counts.records, 2);
    assert.deepEqual((await db().all<{ id: string }>("records")).map((r) => r.id).sort(), ["new1", "new2"]);
    assert.deepEqual((await db().all<{ id: string }>("cheers")).map((r) => r.id), ["c2"]);
    assert.deepEqual((await getSelfAnswers()).map((a) => a.round), ["rnew"]);
    assert.deepEqual((await getSelNotes()).map((n) => n.memo), ["새 메모"]); // 선생님 메모·관찰·피드백도 기한 앞 것은 함께
    assert.deepEqual((await getSelfRounds()).map((r) => r.id), ["rnew"]); // 답이 모두 지워진 지난 회차도 정리
    assert.deepEqual((await getRiskActions()).map((a) => a.id), ["a2"]);
    assert.ok(await db().get("meta", "roster"));
    assert.equal(Object.values(await expiredCounts("2026-03-01")).reduce((a, b) => a + b, 0), 0);
    assert.equal((await purgeLogs()).at(-1)?.cutoff, "2026-03-01");
  });
});

test("기한 앞에 살펴보지 않은 위험 표현이 있으면 정리하지 않는다(살펴본 뒤에는 정리)", async () => {
  await inSpace("cpurgeheld", async () => {
    const old = "2026-02-20";
    await db().set("records", "1_old_am", { id: "1_old_am", no: 1, date: old, risk: true, riskChecked: null, createdAt: "2026-02-20T00:00:00.000Z" });
    await db().set("records", "2_old_am", { id: "2_old_am", no: 2, date: old, risk: true, riskChecked: "2026-02-21T00:00:00.000Z", createdAt: "2026-02-20T00:00:00.000Z" });
    await db().set("records", "3_new_am", { id: "3_new_am", no: 3, date: "2026-03-05", risk: true, riskChecked: null, createdAt: "2026-03-05T00:00:00.000Z" }); // 기한 뒤
    await db().set("reflects", "4_w", { id: "4_w", no: 4, weekStart: "2026-02-16", text: "죽고 싶어", reply: "", risk: true, riskChecked: null, createdAt: "2026-02-20T00:00:00.000Z" });
    await db().set("letters", "5_l", { id: "5_l", from: 5, to: 6, text: "죽어", showName: true, status: "wait", risk: true, createdAt: "2026-02-20T00:00:00.000Z" });
    await db().set("letters", "6_l", { id: "6_l", from: 6, to: 5, text: "죽어", showName: true, status: "no", risk: true, createdAt: "2026-02-20T00:00:00.000Z" }); // 돌려보낸 쪽지는 알림이 아님
    await db().set("meta", "riskDrafts", { items: [{ id: "7_x_am", no: 7, date: old, slot: "am", text: "죽고 싶어", hits: [], lang: "ko", at: "2026-02-20T00:00:00.000Z", checked: null }] });
    assert.equal(await heldRisks("2026-03-01"), 4);
    await assert.rejects(purgeBefore("2026-03-01"), /살펴보지 않은 위험 표현/);
    assert.equal((await db().all("records")).length, 3); // 아무것도 지우지 않음
    assert.equal(await purgeLogs().then((l) => l.length), 0);

    // 선생님이 모두 살펴본 뒤에는 정리된다
    await db().update<Record<string, unknown>>("records", "1_old_am", (c) => ({ ...c, riskChecked: "2026-11-06T00:00:00.000Z" }));
    await db().update<Record<string, unknown>>("reflects", "4_w", (c) => ({ ...c, riskChecked: "2026-11-06T00:00:00.000Z" }));
    await db().update<Record<string, unknown>>("letters", "5_l", (c) => ({ ...c, riskChecked: "2026-11-06T00:00:00.000Z" }));
    await db().set("meta", "riskDrafts", { items: [{ id: "7_x_am", no: 7, date: old, slot: "am", text: "죽고 싶어", hits: [], lang: "ko", at: "2026-02-20T00:00:00.000Z", checked: "2026-11-06T00:00:00.000Z" }] });
    assert.equal(await heldRisks("2026-03-01"), 0);
    const log = await purgeBefore("2026-03-01");
    assert.equal(log.counts.records, 2);
    assert.deepEqual((await db().all<{ id: string }>("records")).map((r) => r.id), ["3_new_am"]);
  });
});

test("기한 앞에 번호를 넘긴 앞 학생 가명도 비운다(때는 남겨 뒤 학생 구간은 그대로)", async () => {
  await inSpace("cpurgef", async () => {
    const D = await import("./data.ts");
    await D.saveRoster([{ no: 3, alias: "나래", code: "ABC333", since: "2026-06-01T00:00:00.000Z", formers: [{ alias: "가온", until: "2026-06-01T00:00:00.000Z" }] },
      { no: 4, alias: "보라", code: "ABC444", since: "2026-04-01T00:00:00.000Z", formers: [{ alias: "시월", until: "2026-04-01T00:00:00.000Z" }] }]);
    await D.saveLeft({ 5: { alias: "라온", at: "2027-03-03T00:00:00.000Z", since: "2026-06-01T00:00:00.000Z", formers: [{ alias: "다온", until: "2026-06-01T00:00:00.000Z" }] } });
    assert.equal((await expiredCounts("2026-05-01")).formers, 1); // 4번 앞 학생(4월에 넘김)만
    const log = await purgeBefore("2026-05-01");
    assert.equal(log.counts.formers, 1);
    const roster = await D.getRoster();
    assert.deepEqual(roster.map((s) => s.formers?.map((f) => f.alias)), [["가온"], [""]]);
    assert.equal(roster[1].formers?.[0].until, "2026-04-01T00:00:00.000Z");
    await purgeBefore("2027-03-01");
    assert.deepEqual((await D.getRoster()).map((s) => s.formers?.map((f) => f.alias)), [[""], [""]]);
    assert.deepEqual((await D.getLeft())[5].formers, [{ alias: "", until: "2026-06-01T00:00:00.000Z", wiped: true }]);
    assert.deepEqual((await D.wipeTargets()).map((t) => t.label), ["3번 나래", "4번 보라", "5번 라온 (명단에서 뺌)"]);
  });
});
