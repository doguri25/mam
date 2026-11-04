// 저장소의 「끼어들어도 잃지 않는 쓰기」(update·setField·bump·drop)와, 그것을 쓰는 곳에서 한꺼번에 저장해도 아무것도 잃지 않는지
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// 이 시험은 임시 폴더의 로컬 저장소(.data/db.json)만 쓴다
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-store-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL", "TRIAL_AI_KEY", "TRIAL_AI_PROVIDER", "UPSTAGE_MODEL"]) delete process.env[k];
process.env.UPSTAGE_API_KEY = "up_shared_test";
process.env.SHARED_AI_PER_DAY = "7";
const { db, inSpace, outOfSpace } = await import("./db.ts");
const D = await import("./data.ts");
const { DEFAULT_LOOK } = await import("./shared.ts");
const { today } = await import("./date.ts");

test("update: 없으면 만들고, 고치고, undefined면 그대로, null이면 지운다", async () => {
  await inSpace("cstore1", async () => {
    assert.deepEqual(await db().update<{ n: number }>("meta", "u", (cur) => ({ n: (cur?.n ?? 0) + 1 })), { n: 1 });
    assert.deepEqual(await db().update<{ n: number }>("meta", "u", (cur) => ({ n: (cur?.n ?? 0) + 1 })), { n: 2 });
    assert.deepEqual(await db().update<{ n: number }>("meta", "u", () => undefined), { n: 2 });
    assert.deepEqual(await db().get("meta", "u"), { n: 2 });
    assert.equal(await db().update("meta", "u", () => null), null);
    assert.equal(await db().get("meta", "u"), null);
  });
});

test("setField: 그 칸만 통째로 바꾸고 다른 칸은 그대로(없는 문서·칸은 만든다)", async () => {
  await inSpace("cstore2", async () => {
    await db().setField("meta", "looks", "items.3", { color: "red", acc: "none" });
    await db().setField("meta", "looks", "items.5", { color: "blue" });
    await db().setField("meta", "looks", "items.3", { color: "green" }); // 3번 모습은 통째로 바뀜(acc가 남지 않음)
    assert.deepEqual(await db().get("meta", "looks"), { items: { 3: { color: "green" }, 5: { color: "blue" } } });
    await db().set("meta", "stamp", { records: 1, other: 1 });
    await db().setField("meta", "stamp", "wipe", 9);
    assert.deepEqual(await db().get("meta", "stamp"), { records: 1, other: 1, wipe: 9 });
  });
});

test("bump: 구간마다 새로 세고, max에서 멈추고, 같은 구간에서만 돌려준다", async () => {
  await inSpace("cstore3", async () => {
    assert.deepEqual(await db().bump("meta", "c", "d1", { max: 2, extra: { exp: 5 } }), { ok: true, n: 1 });
    assert.deepEqual(await db().bump("meta", "c", "d1", { max: 2 }), { ok: true, n: 2 });
    assert.deepEqual(await db().bump("meta", "c", "d1", { max: 2 }), { ok: false, n: 2 });
    assert.deepEqual(await db().bump("meta", "c", "d1", { by: -1 }), { ok: true, n: 1 });
    assert.deepEqual(await db().bump("meta", "c", "d0", { by: -1 }), { ok: false, n: 0 }); // 다른 구간이면 빼지 않음
    assert.deepEqual(await db().bump("meta", "c", "d2", { max: 2 }), { ok: true, n: 1 }); // 구간이 바뀌면 0부터
    assert.deepEqual(await db().get("meta", "c"), { date: "d2", n: 1, exp: 5 });
    assert.deepEqual(await db().bump("meta", "zero", "d1", { max: 0 }), { ok: false, n: 0 }); // 한도 0 = 끄기
    assert.equal(await db().get("meta", "zero"), null);
  });
});

test("drop: 그 공간의 그 모음만 통째로 지운다", async () => {
  await inSpace("cdropa", () => db().set("records", "r1", { id: "r1" }));
  await inSpace("cdropb", () => db().set("records", "r1", { id: "r1" }));
  await inSpace("cdropa", () => db().drop("records"));
  assert.deepEqual(await inSpace("cdropa", () => db().all("records")), []);
  assert.equal((await inSpace("cdropb", () => db().all("records"))).length, 1);
  await inSpace("cdropa", () => db().drop("cheers")); // 없는 모음도 괜찮음
});

// ── 한꺼번에(Promise.all) 저장해도 잃지 않음: 예전에는 읽고 → 기다리고 → 통째로 써서 마지막 하나만 남았다 ──
test("마음 친구: 다섯 학생이 같은 순간 저장해도 다섯 모두 남는다", async () => {
  await inSpace("crace1", async () => {
    await Promise.all([1, 2, 3, 4, 5].map(async (no) => {
      await D.getLooks();
      await D.recordsOf(no); // 경로처럼 사이에 기다림이 있음
      await D.saveLook(no, { ...DEFAULT_LOOK, name: `친구${no}` });
    }));
    const looks = await D.getLooks();
    assert.deepEqual(Object.keys(looks).sort(), ["1", "2", "3", "4", "5"]);
    assert.equal(looks[3].name, "친구3");
  });
});

test("변경 표시: wipe·records·other를 같은 순간 찍어도 셋 다 남는다", async () => {
  await inSpace("crace2", async () => {
    await db().set("meta", "stamp", { records: 1, other: 1, wipe: 1 });
    await Promise.all([D.touch("wipe"), D.touch("records"), D.touch("other")]);
    const s = await D.getStamp();
    assert.ok(s.wipe! > 1 && s.records > 1 && s.other > 1, JSON.stringify(s));
  });
  // 처음(문서 없음)에도 빈 칸은 0
  assert.deepEqual(await inSpace("crace2b", async () => (await D.touch("wipe"), { ...(await D.getStamp()), wipe: 0 })), { records: 0, other: 0, wipe: 0 });
});

test("위험 표현 조치: 두 기기(그리고 열 기기)에서 같은 순간 적어도 모두 남고, 개수로 잘리지 않는다", async () => {
  await inSpace("crace3", async () => {
    const act = (id: string) => ({ id, no: 1, recordId: "r", recordDate: "2026-11-04", date: "2026-11-04", kinds: ["talk" as const], note: id, createdAt: id });
    await Promise.all(Array.from({ length: 10 }, (_, i) => (async () => {
      await D.getRiskActions(); // 경로처럼 먼저 읽음
      await D.addRiskAction(act(`x${i}`));
    })()));
    assert.equal((await D.getRiskActions()).length, 10);
    await Promise.all([D.deleteRiskAction("x1"), D.deleteRiskAction("x2"), D.addRiskAction(act("y"))]);
    assert.deepEqual((await D.getRiskActions()).map((a) => a.id).sort(), ["x0", "x3", "x4", "x5", "x6", "x7", "x8", "x9", "y"]);
    // 예전엔 500개만 남기고 조용히 버렸다
    await D.saveRiskActions(Array.from({ length: 600 }, (_, i) => act(`z${i}`)));
    assert.equal((await D.getRiskActions()).length, 600);
  });
});

test("자기진단 회차: 같은 순간 둘을 열어도 열린 회차는 하나, 개수로 잘리지 않음", async () => {
  await inSpace("crace4", async () => {
    const open = (id: string) => D.editSelfRounds((rs) => (rs.some((r) => !r.closedAt) ? undefined : [...rs, { id, title: id, openedAt: "2026-11-04", closedAt: null }]));
    await Promise.all([open("a"), open("b"), open("c")]);
    assert.equal((await D.getSelfRounds()).filter((r) => !r.closedAt).length, 1);
    await D.saveSelfRounds(Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, title: "t", openedAt: `2026-01-${String(i % 28 + 1).padStart(2, "0")}`, closedAt: "2026-02-01" })));
    assert.equal((await D.getSelfRounds()).length, 60); // 예전엔 40개만 남았다
    // undefined를 돌려주면 그대로 두고 변경 표시도 찍지 않는다
    const before = (await D.getStamp()).other;
    await D.editSelfRounds(() => undefined);
    assert.equal((await D.getStamp()).other, before);
  });
});

test("보호자 동의: 같은 순간 다른 학생들을 표시해도 모두 남는다(명단의 다른 칸은 그대로)", async () => {
  await inSpace("crace5", async () => {
    await db().set("meta", "roster", { students: [1, 2, 3, 4].map((no) => ({ no, alias: `학생${no}`, code: `CODE${no}` })), demo: true });
    await Promise.all([D.setConsent([1], true, "2026-11-01"), D.setConsent([2, 3], true, "2026-11-02"), D.setConsent([4], false)]);
    const doc = await db().get<{ students: { no: number; consent?: string }[]; demo: boolean }>("meta", "roster");
    assert.deepEqual(doc!.students.map((s) => s.consent ?? null), ["2026-11-01", "2026-11-02", "2026-11-02", null]);
    assert.equal(doc!.demo, true);
    assert.deepEqual((await D.setConsent([2], false)).find((s) => s.no === 2)?.consent, undefined);
  });
  assert.deepEqual(await inSpace("crace5b", () => D.setConsent([1], true)), []); // 명단이 없으면 만들지 않음
  assert.equal(await inSpace("crace5b", () => db().get("meta", "roster")), null);
});

test("AI 하루 몫: 열 요청이 같은 순간 와도 한도(7)까지만 쓰고 셈도 정확하다", async () => {
  await inSpace("crace6", async () => {
    const got = await Promise.all(Array.from({ length: 10 }, () => D.aiConfig()));
    assert.equal(got.filter(Boolean).length, 7);
    assert.equal(await D.sharedAiUsed(), 7);
  });
  await inSpace("demo", async () => {
    const before = await D.demoAiUsed();
    await Promise.all(Array.from({ length: 10 }, () => D.aiConfig()));
    assert.equal(await D.demoAiUsed(), before + 10);
    // 날짜가 바뀐 문서는 0부터
    await db().set("meta", "aiUsage", { date: "2000-01-01", n: 999 });
    await D.aiConfig();
    assert.deepEqual(await db().get("meta", "aiUsage"), { date: today(), n: 1 });
  });
});

test("공간 밖 모음(accounts)도 update로 「없을 때만 만들기」", async () => {
  const a = { id: "x", name: "x", space: "c00000001", createdAt: "" };
  const r = await Promise.all([1, 2, 3].map((i) => outOfSpace(() => db().update<typeof a>("accounts", "x", (cur) => (cur ? undefined : { ...a, space: `c0000000${i}` })))));
  assert.equal(new Set(r.map((x) => x!.space)).size, 1); // 셋 다 같은(처음 만든) 계정을 본다
  await outOfSpace(() => db().del("accounts", "x"));
});
