// 보관 기한 정리: 기한 앞 기록만 세고 지우며, 기한 뒤 기록·반 명단·학급 역량 진단은 그대로 두고, 지운 수만 남긴다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-purge-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const { expiredCounts, getRiskActions, getSelfAnswers, getSelfRounds, purgeBefore, purgeLogs, saveRiskActions, saveSelfRounds, saveSelChecks, getSelChecks } = await import("./data.ts");

test("기한 앞의 학생 기록만 지우고, 지운 수를 남긴다", async () => {
  await inSpace("cpurge", async () => {
    const rec = (id: string, date: string) => [id, { id, no: 1, date, createdAt: `${date}T09:00:00+09:00` }] as [string, Record<string, unknown>];
    await db().setMany("records", [rec("old1", "2026-02-27"), rec("old2", "2026-02-28"), rec("new1", "2026-03-01"), rec("new2", "2026-11-04")]);
    await db().set("cheers", "c1", { id: "c1", no: 1, createdAt: "2026-02-10T10:00:00.000Z" });
    await db().set("cheers", "c2", { id: "c2", no: 1, createdAt: "2026-03-02T10:00:00.000Z" });
    await db().set("meta", "self_rold_1", { kind: "selfAnswer", round: "rold", no: 1, answers: Array(10).fill(2), at: "2026-02-01T00:00:00Z" });
    await db().set("meta", "self_rnew_1", { kind: "selfAnswer", round: "rnew", no: 1, answers: Array(10).fill(3), at: "2026-04-01T00:00:00Z" });
    await saveSelfRounds([
      { id: "rold", title: "학기 초", openedAt: "2026-01-20", closedAt: "2026-02-02" },
      { id: "rnew", title: "학기 초", openedAt: "2026-03-30", closedAt: null },
    ]);
    await saveRiskActions([
      { id: "a1", no: 1, recordId: "old1", recordDate: "2026-02-27", date: "2026-02-27", kinds: ["talk"], note: "", createdAt: "" },
      { id: "a2", no: 1, recordId: "new2", recordDate: "2026-11-04", date: "2026-11-04", kinds: ["watch"], note: "", createdAt: "" },
    ]);
    await saveSelChecks([{ id: "s1", date: "2026-01-10", school: "", group: "", rater: "", answers: Array(20).fill(3), memo: "", createdAt: "" }]);
    await db().set("meta", "roster", { students: [{ no: 1, alias: "햇살", code: "ABC234" }] });

    const counts = await expiredCounts("2026-03-01");
    assert.deepEqual([counts.records, counts.cheers, counts.self, counts.risk, counts.notes], [2, 1, 1, 1, 0]);

    const log = await purgeBefore("2026-03-01");
    assert.equal(log.counts.records, 2);
    assert.deepEqual((await db().all<{ id: string }>("records")).map((r) => r.id).sort(), ["new1", "new2"]);
    assert.deepEqual((await db().all<{ id: string }>("cheers")).map((r) => r.id), ["c2"]);
    assert.deepEqual((await getSelfAnswers()).map((a) => a.round), ["rnew"]);
    assert.deepEqual((await getSelfRounds()).map((r) => r.id), ["rnew"]); // 답이 모두 지워진 지난 회차도 정리
    assert.deepEqual((await getRiskActions()).map((a) => a.id), ["a2"]);
    assert.equal((await getSelChecks()).length, 1); // 학급 역량 진단(이름 없음)은 그대로
    assert.ok(await db().get("meta", "roster"));
    assert.equal(Object.values(await expiredCounts("2026-03-01")).reduce((a, b) => a + b, 0), 0);
    assert.equal((await purgeLogs()).at(-1)?.cutoff, "2026-03-01");
  });
});
