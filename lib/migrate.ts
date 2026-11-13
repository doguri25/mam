// 몽고DB → Turso 옮기기와 두 저장소 속도 재기(미리보기에서만 쓰는 관리 도구, app/api/admin/db).
// 옮기기: 앞이름(maeumbit_)으로 시작하는 몽고 모음을 모두(학급 공간 포함) Turso docs 표로 복사하고, 모음마다 수와 내용을 맞춰 본다.
// 몽고는 읽기만 한다. Turso 쪽 같은 모음은 지우고 새로 넣어 몽고와 똑같게 만든다.
import type { Client, InStatement } from "@libsql/client";
import { inSpace, type Store } from "./db.ts";
import { SCHEMA } from "./turso.ts";

type Doc = Record<string, unknown>;
export interface Source {
  names(): Promise<string[]>;
  docs(name: string): Promise<Doc[]>;
}
export interface ColResult { name: string; mongo: number; turso: number; same: boolean; odd: number }

// JSON으로 옮기면 모양이 바뀌는 값(날짜 객체·ObjectId 등)을 센다. 이 앱은 시각을 글자로 적으므로 0이어야 한다.
export function oddValues(v: unknown): number {
  if (v === null || typeof v !== "object") return typeof v === "bigint" || (typeof v === "number" && !Number.isFinite(v)) ? 1 : 0;
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + oddValues(x), 0);
  if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return 1;
  return Object.values(v).reduce((n: number, x) => n + oddValues(x), 0);
}

const INSERT = "INSERT INTO docs (col, id, data, v) VALUES (?, ?, ?, ?) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, v = excluded.v";
const BATCH_BYTES = 2_000_000; // 요청 하나가 너무 무거워지지 않게 2MB쯤에서 끊어 보낸다

// skip: 옮기지 않을 모음(예: 실제 반 복사본으로 시험할 때 학생 기기 알림 구독 subs).
// Turso 쪽은 고른 원본과 똑같아지도록 앞이름 모음 가운데 원본에 없는(또는 건너뛴) 것도 지운다.
export async function copyAll(src: Source, dst: Client, prefix: string, skip: (name: string) => boolean = () => false) {
  const t0 = Date.now();
  await dst.batch(SCHEMA, "write");
  const all = (await src.names()).filter((n) => n.startsWith(prefix)).sort();
  const names = all.filter((n) => !skip(n));
  const skipped = all.filter(skip);
  const stale = (await dst.execute({ sql: "SELECT DISTINCT col FROM docs WHERE substr(col, 1, ?) = ?", args: [prefix.length, prefix] })).rows
    .map((r) => String(r.col))
    .filter((c) => !names.includes(c));
  if (stale.length) await dst.batch(stale.map((c) => ({ sql: "DELETE FROM docs WHERE col = ?", args: [c] })), "write");
  const cols: ColResult[] = [];
  for (const name of names) {
    const docs = await src.docs(name);
    const want = new Map<string, string>();
    let odd = 0;
    const stmts: InStatement[] = [];
    for (const d of docs) {
      const { _id, _v, ...rest } = d;
      odd += oddValues(rest);
      const data = JSON.stringify(rest);
      want.set(String(_id), data);
      stmts.push({ sql: INSERT, args: [name, String(_id), data, typeof _v === "string" ? _v : crypto.randomUUID()] });
    }
    // 처음 묶음에서 그 모음을 비우고 넣는다(같은 묶음 = 한 번에 되거나 안 되거나)
    let chunk: InStatement[] = [{ sql: "DELETE FROM docs WHERE col = ?", args: [name] }];
    let size = 0;
    for (const s of stmts) {
      const b = String((s as { args: unknown[] }).args[2]).length;
      if (chunk.length && size + b > BATCH_BYTES) {
        await dst.batch(chunk, "write");
        chunk = [];
        size = 0;
      }
      chunk.push(s);
      size += b;
    }
    if (chunk.length) await dst.batch(chunk, "write");
    // 맞춰 보기: 다시 읽어 id마다 글이 같은지
    const back = await dst.execute({ sql: "SELECT id, data FROM docs WHERE col = ?", args: [name] });
    const same = back.rows.length === want.size && back.rows.every((r) => want.get(String(r.id)) === String(r.data));
    cols.push({ name, mongo: docs.length, turso: back.rows.length, same, odd });
  }
  return {
    ok: cols.every((c) => c.same && !c.odd),
    collections: cols.length,
    docs: cols.reduce((n, c) => n + c.mongo, 0),
    ms: Date.now() - t0,
    cols,
    skipped,
    removed: stale,
  };
}

// ── 속도 재기: 두 저장소에 같은 일을 시켜 걸린 시간(밀리초)을 견준다. 연습 공간(bench)에서만 쓰고 끝나면 지운다. ──
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.floor(s.length / 2)] * 10) / 10 : 0;
};
const p90 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] * 10) / 10 : 0;
};
async function time(n: number, fn: (i: number) => Promise<unknown>) {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await fn(i);
    xs.push(performance.now() - t);
  }
  return { median: median(xs), p90: p90(xs) };
}

export const BENCH_SPACE = "bench";
const rec = (i: number) => ({
  id: `r${i}`, no: (i % 25) + 1, date: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`, slot: i % 2 ? "pm" : "am", emotion: "기뻐요", intensity: 3,
  summary: "오늘 친구랑 같이 놀아서 기분이 좋았어요. ".repeat(3), risk: i % 40 === 0, createdAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString(),
});

export async function bench(store: Store, rounds = 8) {
  return inSpace(BENCH_SPACE, async () => {
    const first = performance.now();
    await store.get("meta", "warm"); // 처음 연결(차가운 시작)
    const connectMs = Math.round(performance.now() - first);
    await store.drop("records");
    await store.drop("meta");
    await store.drop("sys");
    const seed = await time(1, () => store.setMany("records", Array.from({ length: 300 }, (_, i) => [`r${i}`, rec(i)])));
    await store.set("meta", "settings", { retention: "1y", riskWords: ["죽고", "때려"], checks: {} });
    const out = {
      kind: store.kind,
      connectMs,
      "문서 하나 읽기(get)": await time(rounds, () => store.get("meta", "settings")),
      "문서 하나 쓰기(set)": await time(rounds, (i) => store.set("meta", `note${i}`, { text: "메모", at: new Date().toISOString() })),
      "읽고 고쳐 쓰기(update)": await time(rounds, () => store.update<{ n: number }>("meta", "counter", (c) => ({ n: (c?.n ?? 0) + 1 }))),
      "칸 하나 바꾸기(setField)": await time(rounds, (i) => store.setField("meta", "looks", `items.${i}`, { color: "green" })),
      "횟수 세기(bump)": await time(rounds, () => store.bump("sys", "limit", "d1", { max: 1000 })),
      "학생 한 명 기록 찾기(find no)": await time(rounds, (i) => store.find("records", "no", "==", (i % 25) + 1)),
      "기간으로 세기(count date)": await time(rounds, () => store.count("records", "date", ">=", "2026-11-15")),
      "기록 300개 모두 읽기(all)": await time(rounds, () => store.all("records")),
      // 선생님 화면을 열 때처럼 여러 개를 한꺼번에
      "화면 열기처럼 6개 한꺼번에": await time(rounds, () => Promise.all([
        store.get("meta", "settings"), store.get("meta", "looks"), store.get("meta", "counter"),
        store.find("records", "risk", "==", true), store.count("records", "date", ">=", "2026-11-15"), store.all("records"),
      ])),
      "300개 한꺼번에 넣기(setMany)": seed,
    };
    await store.drop("records");
    await store.drop("meta");
    await store.drop("sys");
    return out;
  });
}
