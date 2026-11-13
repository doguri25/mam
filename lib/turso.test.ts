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

test("미리 읽은 판으로 고쳐 쓰기: 그사이 바뀌었으면 다시 읽어 잃지 않는다", async () => {
  await inSpace("ct4", async () => {
    await s.set("records", "r", { n: 1 });
    await s.get("records", "r"); // 미리 읽어 둠(update가 처음 한 번 이 판을 씀)
    const other = tursoStore(URL); // 다른 서버가 그사이 고침
    await inSpace("ct4", () => other.update<{ n: number }>("records", "r", (c) => ({ n: c!.n + 10 })));
    let calls = 0;
    await s.update<{ n: number }>("records", "r", (c) => (calls++, { n: c!.n + 1 }));
    assert.deepEqual(await s.get("records", "r"), { n: 12 });
    assert.equal(calls, 2); // 낡은 판으로 한 번, 다시 읽어 한 번
    // 쓴 뒤에는 읽어 둔 판을 버린다: 바로 다음 고쳐 쓰기는 한 번에
    calls = 0;
    await s.update<{ n: number }>("records", "r", (c) => (calls++, { n: c!.n + 1 }));
    assert.equal(calls, 1);
    assert.deepEqual(await s.get("records", "r"), { n: 13 });
  });
});

test("같은 순간의 읽기는 요청 하나로 묶인다", async () => {
  const logs: string[] = [];
  const orig = console.log;
  process.env.TURSO_DEBUG = "1";
  console.log = (m: string) => void logs.push(String(m));
  try {
    await Promise.all([s.get("meta", "a"), s.all("records"), s.count("records", "no", "==", 1), s.find("meta", "kind", "==", "x")]);
  } finally {
    console.log = orig;
    delete process.env.TURSO_DEBUG;
  }
  assert.deepEqual(logs.filter((l) => l.startsWith("[turso] ")), ["[turso] read 4"]);
});

test("연결이 한 번 끊겨도 다음 요청은 새 연결로 된다(실패한 연결을 붙들지 않음)", async () => {
  const { turso } = await import("./turso.ts");
  let opens = 0;
  let failNext = 0; // 남은 「끊김」 수: 그 수만큼 요청이 fetch failed로 끝난다
  const flaky: typeof connect = async (url, token) => {
    opens++;
    if (opens === 1) throw new TypeError("fetch failed"); // 첫 연결부터 실패
    const c = await connect(url, token);
    const boom = () => {
      if (failNext > 0) {
        failNext--;
        throw new TypeError("fetch failed");
      }
    };
    return new Proxy(c, {
      get(t, k, r) {
        const v = Reflect.get(t, k, r);
        if (k === "execute" || k === "batch") return async (...a: unknown[]) => (boom(), (v as (...x: unknown[]) => unknown).apply(t, a));
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
  };
  const s2 = turso(URL, undefined, () => "flaky_", flaky);
  // 첫 연결 실패는 읽기가 한 번 더 해 봐서 그대로 된다
  assert.equal(await s2.get("meta", "x"), null);
  await s2.set("meta", "x", { a: 1 });
  // 읽는 도중 끊김: 새 연결로 한 번 더 읽는다
  failNext = 1;
  assert.deepEqual(await s2.get("meta", "x"), { a: 1 });
  // 쓰기 도중 끊김: 두 번 쓰일까 봐 다시 하지 않고 오류 — 하지만 다음 요청은 새 연결로 된다
  failNext = 1;
  await assert.rejects(s2.set("meta", "y", { b: 1 }), /fetch failed/);
  await s2.set("meta", "y", { b: 2 });
  assert.deepEqual(await s2.get("meta", "y"), { b: 2 });
  assert.ok(opens >= 3, String(opens));
});
