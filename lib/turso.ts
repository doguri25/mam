// Turso(libSQL) 저장소: 모든 모음을 표 하나(docs)에 둔다. col = 앞이름까지 붙인 모음 이름(몽고 모음 이름과 같다), data = 문서 JSON.
// find·count·delWhere에 쓰는 칸은 (col, 그 칸) 식 색인으로 찾는다. 색인 없는 칸도 되지만 그 모음을 다 훑는다.
// v: 쓸 때마다 새로 다는 표. update는 읽은 때의 표가 그대로일 때만 바꿔 써서 사이에 낀 쓰기를 덮지 않는다(몽고의 _v와 같음).
// @libsql/client는 이 저장소를 쓸 때만 불러온다(몽고로 도는 배포에는 들어가지 않게).
import type { Client, InArgs, InStatement, InValue, ResultSet } from "@libsql/client";
import type { BumpOpts, Col, Store } from "./db.ts";

type Doc = Record<string, unknown>;
type Op = "==" | ">" | ">=" | "<";
type Val = string | number | boolean;

// 찾을 때 쓰는 칸(lib·app에서 find·count·delWhere에 넘기는 칸). 새 칸으로 찾게 되면 여기에 더한다.
export const INDEXED = ["no", "space", "from", "to", "risk", "status", "kind", "date", "updatedAt", "createdAt", "weekStart", "exp"] as const;

const BUSY = "저장이 한꺼번에 몰렸어요. 잠시 뒤 다시 해 주세요.";
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
// 칸 이름은 SQL 글자로 들어간다(색인과 같은 식이어야 색인을 탄다). 코드에 적힌 이름만 오지만 그래도 거른다.
const ex = (field: string) => {
  if (!NAME.test(field)) throw new Error(`찾을 수 없는 칸 이름: ${field}`);
  return `json_extract(data, '$.${field}')`;
};
const ty = (field: string) => `json_type(data, '$.${field}')`;
// 몽고·로컬처럼 같은 종류 값끼리만 견준다(글자 칸에 숫자 조건이 맞지 않게). 참·거짓은 1·0으로 견주고 종류로 가린다.
const cond = (field: string, op: Op, value: Val): [string, InValue] => {
  const kind = typeof value === "string" ? "('text')" : typeof value === "number" ? "('integer','real')" : "('true','false')";
  return [`${ex(field)} ${op === "==" ? "=" : op} ? AND ${ty(field)} IN ${kind}`, typeof value === "boolean" ? (value ? 1 : 0) : value];
};
// 점으로 이은 칸 이름 → JSON 경로 $."items"."3"
const jpath = (p: string) => "$" + p.split(".").map((k) => `."${k.replace(/"/g, "")}"`).join("");
const json = (v: unknown) => JSON.stringify(v ?? null);
const tok = () => crypto.randomUUID();
const wait = (i: number) => new Promise((r) => setTimeout(r, Math.random() * 15 * (i + 1)));
const parse = <T,>(row: Record<string, unknown>) => JSON.parse(String(row.data)) as T;
// 시험용: TURSO_SIM_MS로 요청마다 늦춰 먼 저장소를 흉내 내고, TURSO_DEBUG로 요청을 하나씩 적는다(배포에는 넣지 않는다)
const lag = async (what: string) => {
  if (process.env.TURSO_DEBUG) console.log(`[turso] ${what}`);
  const ms = Number(process.env.TURSO_SIM_MS) || 0;
  if (ms) await new Promise((r) => setTimeout(r, ms));
};

export const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (col, id))",
  // 그 칸이 있는 문서만 색인에 넣는다(없는 문서까지 넣으면 쓸 때마다 색인 줄이 늘어난다)
  ...INDEXED.map((f) => `CREATE INDEX IF NOT EXISTS docs_${f} ON docs (col, ${ex(f)}) WHERE ${ex(f)} IS NOT NULL`),
];

export async function connect(url: string, authToken?: string): Promise<Client> {
  // 이 컴퓨터의 파일(file:, 시험)만 SQLite 본체(네이티브)를 쓰고, 서버의 Turso는 fetch만 쓰는 웹 판으로(배포에 네이티브 모듈이 없어도 되게)
  // libsql://는 웹소켓 대신 HTTPS로(서버리스에서 요청마다 연결을 붙잡지 않게)
  const { createClient } = url.startsWith("file:") ? await import("@libsql/client") : await import("@libsql/client/web");
  return createClient({ url: url.replace(/^libsql:/, "https:"), authToken });
}

export function turso(url: string, authToken: string | undefined, prefix: () => string): Store {
  const ready = connect(url, authToken).then(async (c) => {
    await c.batch(SCHEMA, "write");
    return c;
  });
  ready.catch(() => {}); // 처음 부를 때 오류를 돌려준다
  // 쓰기는 하나씩 바로 보낸다
  const run = async (sql: string, args: InArgs = []) => {
    const c = await ready;
    await lag("write");
    return c.execute({ sql, args });
  };
  // 읽기는 같은 순간(이벤트 한 바퀴)에 들어온 것을 모아 요청 하나로 보낸다.
  // 서울 서버 ↔ 도쿄 Turso는 오갈 때마다 40ms쯤이라, 화면 하나에 여러 번 읽는 것을 한 번에 묶으면 그만큼 빨라진다.
  let queue: { stmt: InStatement; ok: (r: ResultSet) => void; fail: (e: unknown) => void }[] = [];
  const flush = async () => {
    const q = queue;
    queue = [];
    try {
      const c = await ready;
      await lag(`read ${q.length}`);
      const rs = q.length === 1 ? [await c.execute(q[0].stmt)] : await c.batch(q.map((x) => x.stmt), "read");
      q.forEach((x, i) => x.ok(rs[i]));
    } catch (e) {
      q.forEach((x) => x.fail(e));
    }
  };
  const read = (sql: string, args: InArgs = []) =>
    new Promise<ResultSet>((ok, fail) => {
      if (!queue.length) setImmediate(flush);
      queue.push({ stmt: { sql, args }, ok, fail });
    });
  const name = (col: Col) => prefix() + col;
  const one = async (col: Col, id: string) => (await read("SELECT data, v FROM docs WHERE col = ? AND id = ?", [name(col), id])).rows[0];

  return {
    kind: "turso",
    get prefix() { return prefix(); },
    // rowid 차례 = 처음 넣은 차례(몽고·로컬과 같은 차례로 돌려준다)
    all: async <T,>(col: Col) => (await read("SELECT data FROM docs WHERE col = ? ORDER BY rowid", [name(col)])).rows.map(parse<T>),
    find: async <T,>(col: Col, field: string, op: Op, value: Val) => {
      const [w, a] = cond(field, op, value);
      return (await read(`SELECT data FROM docs WHERE col = ? AND ${w} ORDER BY rowid`, [name(col), a])).rows.map(parse<T>);
    },
    count: async (col, field, op, value) => {
      const [w, a] = cond(field, op, value);
      return Number((await read(`SELECT count(*) AS n FROM docs WHERE col = ? AND ${w}`, [name(col), a])).rows[0].n);
    },
    get: async <T,>(col: Col, id: string) => {
      const r = await one(col, id);
      return r ? parse<T>(r) : null;
    },
    set: async (col, id, data) =>
      void (await run("INSERT INTO docs (col, id, data, v) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, v = excluded.v", [name(col), id, json(data), tok()])),
    setMany: async (col, items) => {
      const c = await ready;
      const n = name(col);
      for (let i = 0; i < items.length; i += 200) {
        await lag("write many");
        await c.batch(items.slice(i, i + 200).map(([id, data]) => ({
          sql: "INSERT INTO docs (col, id, data, v) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, v = excluded.v",
          args: [n, id, json(data), tok()],
        })), "write");
      }
    },
    del: async (col, id) => void (await run("DELETE FROM docs WHERE col = ? AND id = ?", [name(col), id])),
    clear: async (col) => void (await run("DELETE FROM docs WHERE col = ?", [name(col)])),
    delWhere: async (col, field, op, value) => {
      const [w, a] = cond(field, op, value);
      return (await run(`DELETE FROM docs WHERE col = ? AND ${w}`, [name(col), a])).rowsAffected;
    },
    drop: async (col) => void (await run("DELETE FROM docs WHERE col = ?", [name(col)])),
    update: async <T,>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined) => {
      const n = name(col);
      for (let i = 0; i < 20; i++) {
        const cur = await one(col, id);
        const before = cur ? parse<T>(cur) : null;
        const next = fn(before);
        if (next === undefined) return before;
        let done: boolean;
        if (next === null) done = !cur || (await run("DELETE FROM docs WHERE col = ? AND id = ? AND v = ?", [n, id, cur.v])).rowsAffected === 1;
        else if (!cur) done = (await run("INSERT INTO docs (col, id, data, v) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO NOTHING", [n, id, json(next), tok()])).rowsAffected === 1;
        else done = (await run("UPDATE docs SET data = ?, v = ? WHERE col = ? AND id = ? AND v = ?", [json(next), tok(), n, id, cur.v])).rowsAffected === 1;
        if (done) return next;
        await wait(i);
      }
      throw new Error(BUSY);
    },
    // 한 문장으로(읽지 않고) 그 칸만 바꾼다. 없는 문서·중간 칸은 만든다.
    setField: async (col, id, p, value) => {
      const jp = jpath(p);
      await run(
        "INSERT INTO docs (col, id, data, v) VALUES (?1, ?2, json_set('{}', ?3, json(?4)), ?5) ON CONFLICT (col, id) DO UPDATE SET data = json_set(data, ?3, json(?4)), v = excluded.v",
        [name(col), id, jp, json(value), tok()],
      );
    },
    // 한 문장으로 세기: 같은 구간이면 n + by(max 안일 때만), 구간이 바뀌었거나 문서가 없으면 by부터. 올리지 못하면 돌려받는 줄이 없다.
    bump: async (col, id, win, { max = Infinity, by = 1, extra = {} }: BumpOpts = {}) => {
      const n = name(col);
      const N = "coalesce(json_extract(data, '$.n'), 0)";
      const now = async () => {
        const d = await one(col, id);
        const doc = d ? parse<Doc>(d) : null;
        return doc?.date === win ? Number(doc.n) || 0 : 0;
      };
      const got = (rows: Record<string, unknown>[]) => (rows.length ? { ok: true, n: Number(rows[0].n) } : null);
      if (by < 0) {
        const r = await run(
          `UPDATE docs SET data = json_set(data, '$.n', ${N} + CAST(?1 AS INTEGER)), v = ?2 WHERE col = ?3 AND id = ?4 AND json_extract(data, '$.date') = ?5 AND ${N} >= CAST(?6 AS INTEGER) RETURNING json_extract(data, '$.n') AS n`,
          [by, tok(), n, id, win, -by],
        );
        return got(r.rows) ?? { ok: false, n: await now() };
      }
      if (by > max) return { ok: false, n: await now() };
      const keys = Object.keys(extra).filter((k) => !["date", "n"].includes(k));
      for (const k of keys) if (!NAME.test(k)) throw new Error(`쓸 수 없는 칸 이름: ${k}`);
      const withExtra = keys.reduce((acc, k, i) => `json_set(${acc}, '${jpath(k)}', json(?${8 + i}))`, "data");
      const r = await run(
        `INSERT INTO docs (col, id, data, v) VALUES (?1, ?2, json_set(json(?3), '$.date', ?4, '$.n', CAST(?5 AS INTEGER)), ?6)
         ON CONFLICT (col, id) DO UPDATE SET
           data = CASE WHEN json_extract(data, '$.date') IS ?4
             THEN json_set(${withExtra}, '$.n', ${N} + CAST(?5 AS INTEGER))
             ELSE json_set(${withExtra}, '$.date', ?4, '$.n', CAST(?5 AS INTEGER)) END,
           v = excluded.v
         WHERE json_extract(data, '$.date') IS NOT ?4 OR ${N} + CAST(?5 AS INTEGER) <= CAST(?7 AS INTEGER)
         RETURNING json_extract(data, '$.n') AS n`,
        [n, id, json(extra), win, by, tok(), Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER, ...keys.map((k) => json(extra[k]))],
      );
      return got(r.rows) ?? { ok: false, n: await now() };
    },
  };
}
