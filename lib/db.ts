// 저장소: TURSO_DATABASE_URL이 있으면 Turso(libSQL), MONGODB_URI가 있으면 MongoDB, FIREBASE_SERVICE_ACCOUNT가 있으면 Firestore, 없으면 로컬 파일(.data/db.json)
// MongoDB·Firestore는 서버(관리자 SDK)에서만 읽고 쓴다 — 브라우저는 API로만 닿는다.
// DATA_PREFIX로 모음 이름 앞을 바꾼다: 배포는 maeumbit_, 이 컴퓨터는 maeumbit_dev_ → 연습하다 실제 반 기록을 건드리지 않게.
// 학급마다 공간이 따로다: inSpace(공간)이면 그 요청 동안 앞이름에 「공간_」을 더한다.
// ""(앞이름 없음) = 처음부터 있던 반(홍북초 계정), "demo" = 심사용 체험, "c…" = 새로 가입한 학급.
// 선생님 계정(accounts)·학생 코드 색인(codes)은 모든 학급이 함께 쓰므로 공간 밖(outOfSpace)에서만 읽고 쓴다.
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore, type Firestore } from "firebase-admin/firestore";
import { MongoClient, type UpdateFilter } from "mongodb";
import { turso } from "./turso.ts";

// sys: 모든 학급이 함께 쓰는 셈(너무 잦은 시도 막기·하루 한 번 정리). accounts·codes처럼 공간 밖(outOfSpace)에서만 쓴다.
export type Col = "meta" | "records" | "cheers" | "notes" | "subs" | "reflects" | "letters" | "sheets" | "accounts" | "codes" | "sys";
// 학급 공간마다 생기는 모음(빈 학급을 지울 때 이것만 지운다). accounts·codes·sys는 공간 밖에 하나씩.
export const SPACE_COLS = ["meta", "records", "cheers", "notes", "subs", "reflects", "letters", "sheets"] as const satisfies readonly Col[];
type Doc = Record<string, unknown>;
type Op = "==" | ">" | ">=" | "<";
export interface BumpOpts { max?: number; by?: number; extra?: Doc }

export interface Store {
  kind: "mongo" | "firestore" | "local" | "turso";
  prefix: string;
  all<T>(col: Col): Promise<T[]>;
  // 한 필드 조건으로 좁혀 읽기(Firestore 단일 필드 색인만 써서 따로 색인을 만들 필요 없음)
  find<T>(col: Col, field: string, op: Op, value: string | number | boolean): Promise<T[]>;
  count(col: Col, field: string, op: Op, value: string | number | boolean): Promise<number>; // 세기만(문서는 받지 않음)
  get<T>(col: Col, id: string): Promise<T | null>;
  set(col: Col, id: string, data: Doc): Promise<void>;
  setMany(col: Col, items: [string, Doc][]): Promise<void>; // 한 번에 여러 개(연습 데이터 만들기)
  del(col: Col, id: string): Promise<void>;
  clear(col: Col): Promise<void>;
  delWhere(col: Col, field: string, op: Op, value: string | number | boolean): Promise<number>; // 조건에 맞는 것만 지우고 지운 수
  drop(col: Col): Promise<void>; // 모음째 지우기(MongoDB는 빈 모음도 500개 한도에 세므로 학급을 지울 때는 이것으로)

  // ── 여러 요청이 같은 문서를 한꺼번에 고쳐도 잃지 않는 쓰기(서버가 여러 대여도) ──
  // 읽고 고쳐 쓰기를 한 번에: fn이 돌려준 것으로 바꾼다(undefined = 그대로 둠, null = 지움). 사이에 다른 쓰기가 끼면 fn을 다시 부른다.
  update<T>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined): Promise<T | null>;
  // 문서 안 한 칸만 바꾸기(문서가 없으면 만든다). path는 점으로 이은 칸 이름(예: "items.3"). 그 칸의 값은 통째로 바뀐다.
  setField(col: Col, id: string, path: string, value: unknown): Promise<void>;
  // 구간마다 세는 수(문서 모양 { date: 구간, n }): 구간(하루·10분 칸 등)이 바뀌면 새로 센다. n + by가 max를 넘으면 올리지 않고 ok: false.
  // by가 음수면(잡아 둔 몫 돌려주기) 같은 구간일 때만 뺀다. extra는 함께 적을 칸(예: 지워도 되는 때 exp).
  bump(col: Col, id: string, win: string, opts?: BumpOpts): Promise<{ ok: boolean; n: number }>;
}

// 점으로 이은 칸 이름 → 그 자리에 value를 둔 문서 조각({ items: { "3": value } })
const nest = (keys: string[], value: unknown) => keys.reduceRight<unknown>((acc, k) => ({ [k]: acc }), value) as Doc;
const BUSY = "저장이 한꺼번에 몰렸어요. 잠시 뒤 다시 해 주세요.";

const PREFIX = process.env.DATA_PREFIX || "maeumbit_";
// ponytail: 학급마다 모음(컬렉션)이 10개씩 생긴다. MongoDB 무료(M0)는 모음 500개까지라 50학급쯤이 한도 — 넘으면 문서에 학급 칸을 두는 방식으로.
const space = new AsyncLocalStorage<string>();
export const inSpace = <T,>(name: string, fn: () => T) => space.run(name, fn);
export const outOfSpace = <T,>(fn: () => T) => space.exit(fn); // 계정·코드 색인, 체험이 빌려 쓰는 홍북초 AI 키
export const spaceId = () => space.getStore() ?? "";
export const isDemo = () => spaceId() === "demo";
const prefix = () => (spaceId() ? `${PREFIX}${spaceId()}_` : PREFIX);
const match = (v: unknown, op: Op, x: string | number | boolean) =>
  op === "==" ? v === x : typeof v === typeof x && (op === ">" ? (v as number) > (x as number) : op === "<" ? (v as number) < (x as number) : (v as number) >= (x as number));
const MONGO_OP = { ">": "$gt", ">=": "$gte", "<": "$lt" } as const;

function firestore(sa: string): Store {
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(sa)) });
  const db: Firestore = getFirestore(app);
  const c = (col: Col) => db.collection(prefix() + col);
  return {
    kind: "firestore",
    get prefix() { return prefix(); },
    all: async <T,>(col: Col) => (await c(col).get()).docs.map((d) => d.data() as T),
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) =>
      (await c(col).where(field, op, value).get()).docs.map((d) => d.data() as T),
    count: async (col, field, op, value) => (await c(col).where(field, op, value).count().get()).data().count,
    get: async <T,>(col: Col, id: string) => ((await c(col).doc(id).get()).data() as T) ?? null,
    set: async (col, id, data) => void (await c(col).doc(id).set(data)),
    setMany: async (col, items) => {
      for (let i = 0; i < items.length; i += 400) {
        const batch = db.batch();
        items.slice(i, i + 400).forEach(([id, data]) => batch.set(c(col).doc(id), data));
        await batch.commit();
      }
    },
    del: async (col, id) => void (await c(col).doc(id).delete()),
    delWhere: async (col, field, op, value) => {
      const snap = await c(col).where(field, op, value).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      return snap.size;
    },
    clear: async (col) => {
      const snap = await c(col).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
    // Firestore 모음은 문서가 모두 없어지면 사라진다
    drop: async (col) => {
      const snap = await c(col).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
    // 트랜잭션: 읽은 뒤 다른 쓰기가 끼면 Firestore가 fn을 다시 부른다. 문서 자리(ref)는 공간을 아는 지금 잡아 둔다.
    update: async <T,>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined) => {
      const ref = c(col).doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists ? (snap.data() as T) : null;
        const next = fn(cur);
        if (next === undefined) return cur;
        if (next === null) {
          if (snap.exists) tx.delete(ref);
          return null;
        }
        tx.set(ref, next as Doc);
        return next;
      });
    },
    // mergeFields: 그 칸만 통째로 바꾸고 나머지 칸은 그대로(없는 문서는 만든다)
    setField: async (col, id, p, value) => {
      const keys = p.split(".");
      await c(col).doc(id).set(nest(keys, value), { mergeFields: [new FieldPath(...keys)] });
    },
    bump: async (col, id, win, { max = Infinity, by = 1, extra = {} } = {}) => {
      const ref = c(col).doc(id);
      return db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data();
        const n = d?.date === win ? Number(d.n) || 0 : 0;
        if (by < 0) {
          if (d?.date !== win || n + by < 0) return { ok: false, n };
          tx.set(ref, { n: n + by }, { merge: true });
          return { ok: true, n: n + by };
        }
        if (n + by > max) return { ok: false, n };
        tx.set(ref, { ...extra, date: win, n: n + by }, { merge: true });
        return { ok: true, n: n + by };
      });
    },
  };
}

// 문서 id는 _id로 두고, 읽을 때는 떼어 Firestore·로컬과 같은 모양으로 돌려준다
// _v: 쓸 때마다 새로 다는 표. update는 읽은 때의 표가 그대로일 때만 바꿔 써서(비교 후 쓰기) 사이에 낀 쓰기를 덮지 않는다.
export function mongo(uri: string): Store {
  type MDoc = Doc & { _id: string };
  const client = new MongoClient(uri, { maxPoolSize: 5 }); // 서버리스 인스턴스마다 연결을 조금만
  const ready = client.connect();
  const c = async (col: Col) => (await ready).db(process.env.MONGODB_DB || "maeumbit").collection<MDoc>(prefix() + col);
  const plain = <T,>({ _id, _v, ...rest }: MDoc) => (void _id, void _v, rest as T);
  const tok = () => crypto.randomUUID();
  const dup = (e: unknown) => (e as { code?: number }).code === 11000; // 같은 _id가 이미 있음(다른 요청이 먼저 만듦)
  const wait = (i: number) => new Promise((r) => setTimeout(r, Math.random() * 15 * (i + 1)));
  const inc = (by: number, extra: Doc) => ({ $inc: { n: by }, $set: { ...extra, _v: tok() } }) as unknown as UpdateFilter<MDoc>; // n은 Doc에서 unknown이라 타입만 맞춤
  return {
    kind: "mongo",
    get prefix() { return prefix(); },
    all: async <T,>(col: Col) => (await (await c(col)).find().toArray()).map(plain<T>),
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) =>
      (await (await c(col)).find({ [field]: op === "==" ? value : { [MONGO_OP[op]]: value } }).toArray()).map(plain<T>),
    count: async (col, field, op, value) => (await c(col)).countDocuments({ [field]: op === "==" ? value : { [MONGO_OP[op]]: value } }),
    get: async <T,>(col: Col, id: string) => {
      const d = await (await c(col)).findOne({ _id: id });
      return d ? plain<T>(d) : null;
    },
    set: async (col, id, data) => void (await (await c(col)).replaceOne({ _id: id }, { ...data, _v: tok() }, { upsert: true })),
    setMany: async (col, items) => {
      if (items.length) await (await c(col)).bulkWrite(items.map(([id, data]) => ({ replaceOne: { filter: { _id: id }, replacement: { ...data, _v: tok() }, upsert: true } })));
    },
    del: async (col, id) => void (await (await c(col)).deleteOne({ _id: id })),
    clear: async (col) => void (await (await c(col)).deleteMany({})),
    delWhere: async (col, field, op, value) => (await (await c(col)).deleteMany({ [field]: op === "==" ? value : { [MONGO_OP[op]]: value } })).deletedCount,
    drop: async (col) => {
      try {
        await (await c(col)).drop();
      } catch (e) {
        if ((e as { code?: number }).code !== 26) throw e; // 없는 모음(NamespaceNotFound)은 괜찮음
      }
    },
    update: async <T,>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined) => {
      const k = await c(col);
      for (let i = 0; i < 20; i++) {
        const cur = await k.findOne({ _id: id });
        const before = cur ? plain<T>(cur) : null;
        const next = fn(before);
        if (next === undefined) return before;
        const same = { _id: id, _v: cur?._v === undefined ? { $exists: false } : cur._v };
        let done: boolean;
        if (next === null) done = !cur || (await k.deleteOne(same)).deletedCount === 1;
        else if (!cur) done = await k.insertOne({ ...(next as Doc), _id: id, _v: tok() }).then(() => true, (e) => (dup(e) ? false : Promise.reject(e)));
        else done = (await k.replaceOne(same, { ...(next as Doc), _v: tok() })).matchedCount === 1;
        if (done) return next;
        await wait(i);
      }
      throw new Error(BUSY);
    },
    setField: async (col, id, p, value) => void (await (await c(col)).updateOne({ _id: id }, { $set: { [p]: value, _v: tok() } }, { upsert: true })),
    // 흔한 경우(같은 구간·자리 있음)는 findOneAndUpdate 한 번. 구간이 바뀌었을 때만 새로 센다.
    bump: async (col, id, win, { max = Infinity, by = 1, extra = {} } = {}) => {
      const k = await c(col);
      const count = (d: MDoc | null) => (d?.date === win ? Number(d.n) || 0 : 0);
      if (by < 0) {
        const d = await k.findOneAndUpdate({ _id: id, date: win, n: { $gte: -by } }, inc(by, {}), { returnDocument: "after" });
        return d ? { ok: true, n: count(d) } : { ok: false, n: count(await k.findOne({ _id: id })) };
      }
      for (let i = 0; i < 8; i++) {
        const room = Number.isFinite(max) ? { n: { $lte: max - by } } : {};
        const hit = await k.findOneAndUpdate({ _id: id, date: win, ...room }, inc(by, extra), { returnDocument: "after" });
        if (hit) return { ok: true, n: count(hit) };
        const d = await k.findOne({ _id: id });
        if (d?.date === win) {
          if (count(d) + by > max) return { ok: false, n: count(d) };
          continue; // 그사이 자리가 났음 → 다시
        }
        if (by > max) return { ok: false, n: 0 };
        try {
          // 구간이 바뀌었거나 문서가 없음: 새 구간으로(같은 순간 다른 요청이 먼저 새로 세면 같은 _id 충돌 → 다시)
          await k.findOneAndUpdate({ _id: id, date: { $ne: win } }, { $set: { ...extra, date: win, n: by, _v: tok() } }, { upsert: true });
          return { ok: true, n: by };
        } catch (e) {
          if (!dup(e)) throw e;
        }
        await wait(i);
      }
      throw new Error(BUSY);
    },
  };
}

function local(): Store {
  const file = path.join(process.cwd(), ".data", "db.json");
  type Data = Record<string, Record<string, Doc>>;
  const key = (col: Col) => (spaceId() ? `${spaceId()}_${col}` : col);
  const read = (): Data => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };
  const write = (d: Data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(d));
    fs.renameSync(file + ".tmp", file); // 쓰다 멈춰도 원래 파일이 깨지지 않게
  };
  const rows = (col: Col) => read()[key(col)] ?? {}; // 예전 파일엔 새 모음이 없을 수 있음
  const edit = (col: Col, fn: (rows: Record<string, Doc>) => void) => {
    const d = read();
    fn((d[key(col)] ??= {}));
    write(d);
  };
  return {
    kind: "local",
    get prefix() { return spaceId() ? `${spaceId()}_` : ""; },
    all: async <T,>(col: Col) => Object.values(rows(col)) as T[],
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) =>
      Object.values(rows(col)).filter((d) => match(d[field], op, value)) as T[],
    count: async (col, field, op, value) => Object.values(rows(col)).filter((d) => match(d[field], op, value)).length,
    get: async <T,>(col: Col, id: string) => (rows(col)[id] as T) ?? null,
    set: async (col, id, data) => edit(col, (r) => { r[id] = data; }),
    setMany: async (col, items) => edit(col, (r) => { for (const [id, data] of items) r[id] = data; }),
    del: async (col, id) => edit(col, (r) => { delete r[id]; }),
    clear: async (col) => edit(col, (r) => { for (const id of Object.keys(r)) delete r[id]; }),
    delWhere: async (col, field, op, value) => {
      let n = 0;
      edit(col, (r) => { for (const [id, d] of Object.entries(r)) if (match(d[field], op, value)) { delete r[id]; n++; } });
      return n;
    },
    drop: async (col) => {
      const d = read();
      delete d[key(col)];
      write(d);
    },
    // 로컬 파일은 한 프로세스가 읽고 쓰기를 한 번에(기다림 없이) 하므로 그 자체로 끼어들 틈이 없다
    update: async <T,>(col: Col, id: string, fn: (cur: T | null) => T | null | undefined) => {
      let out: T | null = null;
      edit(col, (r) => {
        const cur = (r[id] as T) ?? null;
        const next = fn(cur);
        if (next === undefined) return void (out = cur);
        if (next === null) delete r[id];
        else r[id] = next as Doc;
        out = next;
      });
      return out;
    },
    setField: async (col, id, p, value) => edit(col, (r) => {
      const keys = p.split(".");
      let o = (r[id] ??= {});
      for (const k of keys.slice(0, -1)) o = (o[k] && typeof o[k] === "object" ? o[k] : (o[k] = {})) as Doc;
      o[keys.at(-1)!] = value;
    }),
    bump: async (col, id, win, { max = Infinity, by = 1, extra = {} } = {}) => {
      let out = { ok: false, n: 0 };
      edit(col, (r) => {
        const d = r[id];
        const n = d?.date === win ? Number(d.n) || 0 : 0;
        if (by < 0 ? d?.date !== win || n + by < 0 : n + by > max) return void (out = { ok: false, n });
        r[id] = by < 0 ? { ...d, n: n + by } : { ...d, ...extra, date: win, n: n + by };
        out = { ok: true, n: n + by };
      });
      return out;
    },
  };
}

// 옮기기·속도 재기에서 정한 저장소를 따로 만들 때(앞이름·공간은 db()와 같게 따른다)
export const tursoStore = (url: string, token?: string) => turso(url, token, prefix);

let store: Store | undefined;
export function db(): Store {
  if (store) return store;
  const tu = process.env.TURSO_DATABASE_URL;
  if (tu) return (store = tursoStore(tu, process.env.TURSO_AUTH_TOKEN));
  const uri = process.env.MONGODB_URI;
  if (uri) return (store = mongo(uri));
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) return (store = firestore(sa));
  if (process.env.VERCEL) throw new Error("Vercel에서는 MONGODB_URI(또는 FIREBASE_SERVICE_ACCOUNT) 환경 변수가 필요해요.");
  return (store = local());
}
