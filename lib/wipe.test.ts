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
    { id: "a1", no: 3, recordId: "3_2026-11-12_am", recordDate: "2026-11-12", date: "2026-11-12", kinds: ["talk"], note: "이야기 나눔", text: "지금 학생 글", createdAt: at("2026-11-12") },
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
    // 조치 기록은 남기고 학생 글만 지운다(앞 학생 조치는 그대로)
    assert.deepEqual((await D.getRiskActions()).map((a) => a.id).sort(), ["a0", "a1"]);
    const a1 = (await D.getRiskActions()).find((a) => a.id === "a1")!;
    assert.deepEqual([a1.text, a1.note, a1.kinds], [undefined, "이야기 나눔", ["talk"]]);
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

test("명단에서 뺀 학생은 그 학생 것을 지우고 뺀 학생 기록(가명·코드)도 지운다", async () => {
  await inSpace("cwipe3", async () => {
    await D.saveRoster([{ no: 1, alias: "가나", code: "WPA112" }]);
    await db().set("records", "5_2026-11-05_am", rec(5, "2026-11-05"));
    await D.saveLeft({ 5: { alias: "떠난친구", at: at("2026-11-06") } });
    assert.deepEqual((await D.wipeTargets()).map((t) => [t.no, t.who]), [[1, "now"], [5, "left"]]);
    const peek = await D.wipeStudent(5, true, "left");
    assert.deepEqual([peek.onRoster, peek.counts.records, peek.counts.left], [false, 1, 1]);
    await D.wipeStudent(5, false, "left");
    assert.equal(await db().get("records", "5_2026-11-05_am"), null);
    assert.equal(5 in (await D.getLeft()), false);
  });
});

test("번호를 넘겨받은 학생: 앞 학생은 따로 골라 지우고, 지금 학생을 지워도 앞 학생 것(넘긴 날 조치 기록 포함)은 남는다", async () => {
  await inSpace("cwipe4", async () => {
    await seed();
    // 넘긴 날(11월 10일) 앞 학생 기록과 그 조치(글은 startFresh가 _p로 옮김)
    await db().set("records", "3_2026-11-10_am_pX", rec(3, "2026-11-10", { id: "3_2026-11-10_am_pX", createdAt: "2026-11-09T23:30:00.000Z", text: "" }));
    const acts = await D.getRiskActions();
    await D.saveRiskActions([...acts, { id: "a2", no: 3, recordId: "3_2026-11-10_am_pX", recordDate: "2026-11-10", date: "2026-11-10", kinds: ["parent"], note: "", text: "앞 학생 글", createdAt: at("2026-11-10") }] as never);
    const targets = await D.wipeTargets();
    const former = targets.find((t) => t.no === 3 && t.who.startsWith("f:"))!;
    assert.match(former.label, /앞 학생 앞친구/);
    // 지금 학생을 지워도 넘긴 날 앞 학생 조치는 그대로
    await D.wipeStudent(3, false, "now");
    assert.equal((await D.getRiskActions()).find((a) => a.id === "a2")?.text, "앞 학생 글");
    assert.ok(await db().get("records", "3_2026-11-05_am"));
    // 앞 학생을 지우면 앞 학생 기록이 사라지고 가명도 비운다
    const peek = await D.wipeStudent(3, true, former.who);
    assert.equal(peek.counts.records, 2);
    await D.wipeStudent(3, false, former.who);
    assert.equal(await db().get("records", "3_2026-11-05_am"), null);
    assert.equal(await db().get("records", "3_2026-11-10_am_pX"), null);
    assert.deepEqual((await D.getRoster()).find((s) => s.no === 3)?.formers?.map((f) => [f.alias, !!f.wiped]), [["", true]]);
    assert.equal((await D.wipeTargets()).some((t) => t.no === 3 && t.who.startsWith("f:")), false);
  });
});

test("글이 없어진 조치 기록: 쓴 때(recordAt)로 가리고, 번호를 넘긴 날의 예전 조치·옮겨 둔 앞 학생 기록은 지금 학생 것으로 보지 않는다", async () => {
  const { actionOwnBy } = await import("./shared.ts");
  const st = { since: "2026-11-10T04:00:00.000Z" }; // 11월 10일 13시(한국 시각)에 새 학생에게
  const a = (x: Record<string, string>) => ({ recordId: "3_2026-11-10_am", recordDate: "2026-11-10", date: "2026-11-10", ...x });
  assert.equal(actionOwnBy(st, a({ recordAt: "2026-11-09T23:40:00.000Z" })), false); // 넘긴 날 아침 앞 학생 글
  assert.equal(actionOwnBy(st, a({ recordAt: "2026-11-10T05:00:00.000Z" })), true); // 넘긴 뒤 새 학생 글
  assert.equal(actionOwnBy(st, a({})), false); // 쓴 때를 모르는 넘긴 날 조치
  assert.equal(actionOwnBy(st, a({ recordDate: "2026-11-12", date: "2026-11-12" })), true);
  assert.equal(actionOwnBy(st, a({ recordId: "3_2026-11-12_am_pmhx1a2b3", recordDate: "2026-11-12" })), false);
  assert.equal(actionOwnBy(undefined, a({})), true); // 번호를 넘긴 적 없는 학생
});

test("새 코드를 주는 사이 다른 기기에서 표시한 보호자 동의는 남는다", async () => {
  await inSpace("cwipe5", async () => {
    await D.saveRoster([{ no: 1, alias: "가나", code: "WPE111" }]);
    const before = await D.getRoster(); // 새 코드를 주려고 읽은 명단(동의 표시 전)
    await db().update<{ students: { no: number; consent?: string }[] }>("meta", "roster", (cur) => cur && { ...cur, students: cur.students.map((s) => ({ ...s, consent: "2026-11-19" })) });
    const next = before.map((s) => ({ ...s, code: "WPE999" }));
    const saved = await D.saveRoster(next, false, { recoded: { 1: "WPE111" } });
    assert.deepEqual([saved[0].code, saved[0].consent], ["WPE999", "2026-11-19"]);
  });
});

test("하교 전 기록(…_pm)은 번호를 넘길 때 옮긴 기록(…_p+때)으로 보지 않는다", async () => {
  const { actionOwnBy, isMovedId } = await import("./shared.ts");
  assert.deepEqual(["3_2026-10-10_pm", "draft:3_2026-10-10_pm", "3_2026-11-10_am_pmhx1a2b3", "draft:3_2026-11-10_pm_pmhx1a2b3"].map(isMovedId), [false, false, true, true]);
  const st = { since: "2026-11-10T04:00:00.000Z" };
  assert.equal(actionOwnBy(st, { recordId: "3_2026-11-12_pm", recordDate: "2026-11-12", date: "2026-11-12" }), true);
});

test("자료를 지운 번호를 다시 넣으면 남은 조치 기록 때문에 새 학생인지 묻는다", async () => {
  await inSpace("cwipe6", async () => {
    await D.saveRoster([{ no: 1, alias: "가나", code: "WPF111" }]);
    assert.equal((await D.withDataFor([5])).has(5), false);
    await D.saveRiskActions([{ id: "a5", no: 5, recordId: "5_2026-11-12_am", recordDate: "2026-11-12", date: "2026-11-12", kinds: ["parent"], note: "보호자 통화", createdAt: at("2026-11-12") }] as never);
    assert.equal((await D.withDataFor([5])).has(5), true);
  });
});

test("쓴 때가 없는 예전 조치 기록에 글을 쓴 때를 채운다(글이 없으면 다시 찾지 않게 표시)", async () => {
  await inSpace("cwipe7", async () => {
    await db().set("records", "3_2026-11-12_pm", rec(3, "2026-11-12", { id: "3_2026-11-12_pm", slot: "pm", createdAt: "2026-11-12T06:30:00.000Z" }));
    await D.saveRiskActions([
      { id: "b1", no: 3, recordId: "3_2026-11-12_pm", recordDate: "2026-11-12", date: "2026-11-12", kinds: ["talk"], note: "", createdAt: at("2026-11-12") },
      { id: "b2", no: 3, recordId: "draft:3_2026-10-01_am", recordDate: "2026-10-01", date: "2026-10-01", kinds: ["talk"], note: "", createdAt: at("2026-10-01") },
    ] as never);
    assert.equal(await D.backfillRecordAt(), 2);
    const got = Object.fromEntries((await D.getRiskActions()).map((a) => [a.id, [a.recordAt ?? null, !!a.atGone]]));
    assert.deepEqual(got, { b1: ["2026-11-12T06:30:00.000Z", false], b2: [null, true] });
    assert.equal(await D.backfillRecordAt(), 0);
  });
});
