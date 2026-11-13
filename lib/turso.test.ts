// Turso(libSQL) 저장소: 이 컴퓨터의 SQLite 파일(file:)로 시험한다. 다른 시험들도 TURSO_DATABASE_URL=file:… 로 한 번 더 돌릴 수 있다.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-turso-")));
const { inSpace, tursoStore } = await import("./db.ts");
const { connect, INDEXED } = await import("./turso.ts");
const URL = "file:turso.db";
const s = tursoStore(URL);

test("찾기는 같은 종류 값끼리만(글자 '3'과 숫자 3은 다르다), 참·거짓도 가린다", async () => {
  await inSpace("ct1", async () => {
    await s.setMany("records", [["a", { no: 3, date: "2026-11-01", risk: true }], ["b", { no: "3", date: "2026-11-05", risk: 1 }], ["c", { no: 4, risk: false }], ["d", { no: 10 }]]);
    assert.deepEqual((await s.find<{ no: unknown }>("records", "no", "==", 3)).map((d) => d.no), [3]);
    assert.deepEqual((await s.find<{ no: unknown }>("records", "no", "==", "3")).map((d) => d.no), ["3"]);
    assert.equal(await s.count("records", "no", ">=", 4), 2); // 글자 '3'은 숫자 조건에 들지 않음
    assert.equal(await s.count("records", "date", ">=", ""), 2); // 날짜 칸이 있는 것만
    assert.equal(await s.count("records", "date", "<", "2026-11-03"), 1);
    assert.equal(await s.count("records", "risk", "==", true), 1); // 숫자 1은 참이 아님
    assert.equal(await s.count("records", "risk", "==", false), 1);
    assert.equal(await s.delWhere("records", "no", ">", 3), 2);
    assert.deepEqual((await s.all<{ no: unknown }>("records")).map((d) => d.no), [3, "3"]); // 넣은 차례 그대로
  });
});

test("공간마다 따로: 같은 id도 다른 학급 것은 건드리지 않는다", async () => {
  await inSpace("ct2a", () => s.set("meta", "x", { v: "a" }));
  await inSpace("ct2b", () => s.set("meta", "x", { v: "b" }));
  await inSpace("ct2a", () => s.drop("meta"));
  assert.equal(await inSpace("ct2a", () => s.get("meta", "x")), null);
  assert.deepEqual(await inSpace("ct2b", () => s.get("meta", "x")), { v: "b" });
});

test("값은 JSON 그대로(숫자는 정수, 참·거짓, 빈 값, 깊은 칸)", async () => {
  const doc = { n: 1, f: 1.5, t: true, z: null, arr: [1, "2", { x: false }], deep: { a: { b: "글" } } };
  await s.set("meta", "json", doc);
  assert.deepEqual(await s.get("meta", "json"), doc);
  await s.setField("meta", "json", "deep.a.c", [1, 2]);
  await s.setField("meta", "new", "items.7", { color: "red" });
  assert.deepEqual(await s.get("meta", "json"), { ...doc, deep: { a: { b: "글", c: [1, 2] } } });
  assert.deepEqual(await s.get("meta", "new"), { items: { 7: { color: "red" } } });
});

test("한꺼번에 고쳐도 잃지 않는다: update 30개·bump 30개를 같은 순간에", async () => {
  await inSpace("ct3", async () => {
    await Promise.all(Array.from({ length: 30 }, (_, i) => s.update<{ items: number[] }>("meta", "list", (cur) => ({ items: [...(cur?.items ?? []), i] }))));
    assert.equal((await s.get<{ items: number[] }>("meta", "list"))!.items.length, 30);
    const rs = await Promise.all(Array.from({ length: 30 }, () => s.bump("sys", "limit", "d1", { max: 20 })));
    assert.equal(rs.filter((r) => r.ok).length, 20);
    assert.deepEqual(await s.get("sys", "limit"), { date: "d1", n: 20 });
  });
});

test("찾는 칸마다 색인을 탄다(모음을 다 훑지 않음)", async () => {
  const c = await connect(URL);
  for (const f of INDEXED) {
    const plan = await c.execute({ sql: `EXPLAIN QUERY PLAN SELECT data FROM docs WHERE col = ? AND json_extract(data, '$.${f}') = ? AND json_type(data, '$.${f}') IN ('text')`, args: ["maeumbit_records", "x"] });
    assert.match(plan.rows.map((r) => String(r.detail)).join(" "), new RegExp(`INDEX docs_${f}\\b`), f);
  }
  c.close();
});
