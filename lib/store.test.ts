// 저장소의 「끼어들어도 잃지 않는 쓰기」(update·setField·bump·drop)
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// 이 시험은 임시 폴더의 로컬 저장소(.data/db.json)만 쓴다
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-store-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL", "TRIAL_AI_KEY", "TRIAL_AI_PROVIDER", "UPSTAGE_MODEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");

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
