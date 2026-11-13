// 몽고 → Turso 옮기기(가짜 몽고로)와 속도 재기가 끝나면 연습 공간을 지우는지
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-migrate-")));
const { inSpace, tursoStore } = await import("./db.ts");
const { connect } = await import("./turso.ts");
const { bench, copyAll, oddValues } = await import("./migrate.ts");

const FAKE: Record<string, Record<string, unknown>[]> = {
  maeumbit_meta: [{ _id: "settings", _v: "t1", retention: "1y", checks: { a: "2026-11-01T00:00:00.000Z" } }, { _id: "roster", items: [{ no: 1, alias: "햇살" }] }],
  maeumbit_records: Array.from({ length: 250 }, (_, i) => ({ _id: `r${i}`, no: (i % 20) + 1, date: "2026-11-05", risk: i === 3, summary: "글".repeat(50) })),
  maeumbit_c1234abcd_meta: [{ _id: "pin", hash: "x" }],
  maeumbit_accounts: [{ _id: "c1234abcd", name: "새 학급", space: "c1234abcd" }],
  maeumbit_c1234abcd_subs: [{ _id: "1", endpoint: "https://push.example/1" }],
  other_app_things: [{ _id: "x" }], // 앞이름이 다른 모음은 옮기지 않음
};
const src = { names: async () => Object.keys(FAKE), docs: async (n: string) => FAKE[n] };

test("옮기기: 앞이름 모음만, 학급 공간까지, 수·내용을 맞춰 보고, 다시 해도 같다", async () => {
  const c = await connect("file:m.db");
  await c.batch(["CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (col, id))"], "write");
  await c.execute({ sql: "INSERT INTO docs VALUES ('maeumbit_meta', 'old', '{}', 'x')", args: [] }); // 몽고에 없는 문서는 지워짐
  await c.execute({ sql: "INSERT INTO docs VALUES ('maeumbit_gone_meta', 'x', '{}', 'x')", args: [] }); // 몽고에 없는 모음은 지워짐
  for (let k = 0; k < 2; k++) {
    const out = await copyAll(src, c, "maeumbit_");
    assert.ok(out.ok);
    assert.equal(out.collections, 5);
    assert.equal(out.docs, 255);
    assert.deepEqual(out.removed, k ? [] : ["maeumbit_gone_meta"]);
  }
  const s = tursoStore("file:m.db");
  assert.deepEqual(await s.get("meta", "settings"), { retention: "1y", checks: { a: "2026-11-01T00:00:00.000Z" } }); // _id·_v는 떼고
  assert.equal(await s.get("meta", "old"), null);
  assert.equal(await s.count("records", "no", "==", 4), 13);
  assert.equal((await s.find("records", "risk", "==", true)).length, 1);
  assert.deepEqual(await inSpace("c1234abcd", () => s.get("meta", "pin")), { hash: "x" });
  // 건너뛰기: 알림 구독은 옮기지 않고, 앞서 옮긴 것도 지운다
  const out = await copyAll(src, c, "maeumbit_", (n) => n.endsWith("_subs"));
  assert.deepEqual(out.skipped, ["maeumbit_c1234abcd_subs"]);
  assert.deepEqual(out.removed, ["maeumbit_c1234abcd_subs"]);
  assert.equal(await inSpace("c1234abcd", () => s.count("subs", "endpoint", ">=", "")), 0);
  c.close();
});

test("JSON으로 바뀌는 값(날짜 객체 등)을 센다", () => {
  assert.equal(oddValues({ a: "2026", b: [1, { c: null }] }), 0);
  assert.equal(oddValues({ a: new Date(), b: [new Uint8Array(1)], n: Infinity }), 3);
});

test("속도 재기: 일마다 시간을 내고, 연습 공간은 비우고 끝난다", async () => {
  const s = tursoStore("file:b.db");
  const r = await bench(s, 2);
  assert.equal(r.kind, "turso");
  assert.ok(typeof (r["문서 하나 읽기(get)"] as { median: number }).median === "number");
  assert.deepEqual(await inSpace("bench", () => s.all("records")), []);
  assert.deepEqual(await inSpace("bench", () => s.all("meta")), []);
});

test("저장소 점검: 로컬 Turso 파일에서 모두 통과하고 연습 공간을 비운다", async () => {
  const { selfTest } = await import("./migrate.ts");
  const s = tursoStore("file:st.db");
  const r = await selfTest(s);
  assert.ok(r.ok, JSON.stringify(r.checks.filter((c) => !c.ok)));
  assert.equal(r.checks.length, 7);
  assert.deepEqual(await inSpace("selftest", () => s.all("meta")), []);
});
