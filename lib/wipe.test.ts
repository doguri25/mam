// 학생 한 명 자료 지우기(보호자 요청): 그 학생 것만 지우고, 앞 학생 것·다른 학생 것·친구가 보낸 걱정되는 쪽지는 남긴다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-wipe-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const D = await import("./data.ts");

const at = (d: string) => `${d}T01:00:00.000Z`;
const rec = (no: number, date: string, extra: Record<string, unknown> = {}) => ({
  id: `${no}_${date}_am`, no, date, slot: "am", method: "card", emotion: "슬퍼요", intensity: 3, reason: "친구", summary: "", question: "", answer: "",
  risk: false, riskHits: [], riskChecked: null, createdAt: at(date), updatedAt: 1, ...extra,
});

async function seed() {
  // 3번은 11월 10일에 새 학생에게 준 번호(그 앞 것은 앞 학생 것)
  await D.saveRoster([{ no: 1, alias: "가나", code: "WPA111" }, { no: 3, alias: "새친구", code: "WPC333", since: at("2026-11-10"), formers: [{ alias: "앞친구", until: at("2026-11-10") }] }]);
  await db().set("records", "3_2026-11-05_am", rec(3, "2026-11-05")); // 앞 학생
  await db().set("records", "3_2026-11-12_am", rec(3, "2026-11-12")); // 지금 학생
  await db().set("records", "1_2026-11-12_am", rec(1, "2026-11-12")); // 다른 학생
  await db().set("letters", "3_2026-11-12_1", { id: "3_2026-11-12_1", from: 3, to: 1, text: "고마워", status: "ok", createdAt: at("2026-11-12") });
  await db().set("letters", "1_2026-11-12_1", { id: "1_2026-11-12_1", from: 1, to: 3, text: "반가워", status: "ok", createdAt: at("2026-11-12") }); // 받아 읽은 평범한 쪽지
  await db().set("letters", "1_2026-11-12_2", { id: "1_2026-11-12_2", from: 1, to: 3, text: "걱정", status: "ok", risk: true, riskChecked: at("2026-11-12"), createdAt: at("2026-11-12") }); // 친구가 쓴 걱정되는 쪽지
  await db().set("notes", "n3", { id: "n3", no: 3, text: "면담", createdAt: at("2026-11-13") });
  await db().set("cheers", "c3", { id: "c3", no: 3, text: "응원", createdAt: at("2026-11-13") });
  await db().set("meta", "self_r1_3", { kind: "selfAnswer", round: "r1", no: 3, answers: Array(32).fill(3), at: at("2026-11-13") });
  await D.saveLook(3, { name: "콩이", color: 0, acc: "none" } as never);
  await D.saveRiskActions([
    { id: "a1", no: 3, recordId: "3_2026-11-12_am", recordDate: "2026-11-12", date: "2026-11-12", kinds: ["talk"], note: "", createdAt: at("2026-11-12") },
    { id: "a0", no: 3, recordId: "3_2026-11-05_am", recordDate: "2026-11-05", date: "2026-11-05", kinds: ["talk"], note: "", createdAt: at("2026-11-05") },
  ] as never);
}

test("미리 보기는 지우지 않고 세기만, 지우면 지금 학생 것만 지운다", async () => {
  await inSpace("cwipe1", async () => {
    await seed();
    const peek = await D.wipeStudent(3, true);
    assert.deepEqual([peek.onRoster, peek.held, peek.counts.records, peek.counts.letters, peek.counts.notes, peek.counts.cheers, peek.counts.self, peek.counts.actions, peek.counts.look], [true, 0, 1, 2, 1, 1, 1, 1, 1]);
    assert.ok(await db().get("records", "3_2026-11-12_am")); // 아직 그대로
    await D.wipeStudent(3, false);
    assert.equal(await db().get("records", "3_2026-11-12_am"), null);
    assert.ok(await db().get("records", "3_2026-11-05_am")); // 앞 학생 것은 남는다
    assert.ok(await db().get("records", "1_2026-11-12_am")); // 다른 학생 것도
    assert.equal(await db().get("letters", "3_2026-11-12_1"), null); // 이 학생이 쓴 쪽지
    assert.equal(await db().get("letters", "1_2026-11-12_1"), null); // 받아 읽은 평범한 쪽지
    assert.ok(await db().get("letters", "1_2026-11-12_2")); // 친구가 쓴 걱정되는 쪽지는 보낸 학생 기록
    assert.equal(await db().get("notes", "n3"), null);
    assert.equal(await db().get("cheers", "c3"), null);
    assert.equal(await db().get("meta", "self_r1_3"), null);
    assert.equal(3 in (await D.getLooks()), false);
    assert.deepEqual((await D.getRiskActions()).map((a) => a.id), ["a0"]);
    assert.equal((await D.getRoster()).length, 2); // 명단은 그대로
  });
});

test("살펴보지 않은 위험 표현이 있으면 지우지 않는다", async () => {
  await inSpace("cwipe2", async () => {
    await seed();
    await db().set("records", "3_2026-11-14_am", rec(3, "2026-11-14", { id: "3_2026-11-14_am", risk: true, riskHits: ["죽고 싶"] }));
    assert.equal((await D.wipeStudent(3, true)).held, 1);
    await assert.rejects(D.wipeStudent(3, false), /살펴보지 않았어요/);
    assert.ok(await db().get("records", "3_2026-11-12_am"));
  });
});

test("명단에서 뺀 번호는 그 번호로 남은 것을 모두 지우고 뺀 학생 기록도 지운다", async () => {
  await inSpace("cwipe3", async () => {
    await D.saveRoster([{ no: 1, alias: "가나", code: "WPA112" }]);
    await db().set("records", "5_2026-11-05_am", rec(5, "2026-11-05"));
    await D.saveLeft({ 5: { alias: "떠난친구", at: at("2026-11-06") } });
    const peek = await D.wipeStudent(5, true);
    assert.deepEqual([peek.onRoster, peek.counts.records], [false, 1]);
    await D.wipeStudent(5, false);
    assert.equal(await db().get("records", "5_2026-11-05_am"), null);
    assert.equal(5 in (await D.getLeft()), false);
  });
});
