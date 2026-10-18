// 저장소: MONGODB_URI가 있으면 MongoDB, FIREBASE_SERVICE_ACCOUNT가 있으면 Firestore, 없으면 로컬 파일(.data/db.json)
// MongoDB·Firestore는 서버(관리자 SDK)에서만 읽고 쓴다 — 브라우저는 API로만 닿는다.
// DATA_PREFIX로 모음 이름 앞을 바꾼다: 배포는 maeumbit_, 이 컴퓨터는 maeumbit_dev_ → 연습하다 실제 반 기록을 건드리지 않게.
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { MongoClient } from "mongodb";

export type Col = "meta" | "records" | "cheers" | "notes" | "subs";
type Doc = Record<string, unknown>;
type Op = "==" | ">" | ">=";

interface Store {
  kind: "mongo" | "firestore" | "local";
  prefix: string;
  all<T>(col: Col): Promise<T[]>;
  // 한 필드 조건으로 좁혀 읽기(Firestore 단일 필드 색인만 써서 따로 색인을 만들 필요 없음)
  find<T>(col: Col, field: string, op: Op, value: string | number | boolean): Promise<T[]>;
  get<T>(col: Col, id: string): Promise<T | null>;
  set(col: Col, id: string, data: Doc): Promise<void>;
  del(col: Col, id: string): Promise<void>;
  clear(col: Col): Promise<void>;
}

const PREFIX = process.env.DATA_PREFIX || "maeumbit_";
const match = (v: unknown, op: Op, x: string | number | boolean) =>
  op === "==" ? v === x : typeof v === typeof x && (op === ">" ? (v as number) > (x as number) : (v as number) >= (x as number));

function firestore(sa: string): Store {
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(sa)) });
  const db: Firestore = getFirestore(app);
  const c = (col: Col) => db.collection(PREFIX + col);
  return {
    kind: "firestore",
    prefix: PREFIX,
    all: async <T,>(col: Col) => (await c(col).get()).docs.map((d) => d.data() as T),
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) =>
      (await c(col).where(field, op, value).get()).docs.map((d) => d.data() as T),
    get: async <T,>(col: Col, id: string) => ((await c(col).doc(id).get()).data() as T) ?? null,
    set: async (col, id, data) => void (await c(col).doc(id).set(data)),
    del: async (col, id) => void (await c(col).doc(id).delete()),
    clear: async (col) => {
      const snap = await c(col).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
  };
}

// 문서 id는 _id로 두고, 읽을 때는 떼어 Firestore·로컬과 같은 모양으로 돌려준다
function mongo(uri: string): Store {
  type MDoc = Doc & { _id: string };
  const client = new MongoClient(uri, { maxPoolSize: 5 }); // 서버리스 인스턴스마다 연결을 조금만
  const ready = client.connect();
  const c = async (col: Col) => (await ready).db(process.env.MONGODB_DB || "maeumbit").collection<MDoc>(PREFIX + col);
  const plain = <T,>({ _id, ...rest }: MDoc) => (void _id, rest as T);
  return {
    kind: "mongo",
    prefix: PREFIX,
    all: async <T,>(col: Col) => (await (await c(col)).find().toArray()).map(plain<T>),
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) => {
      const cond = op === "==" ? value : { [op === ">" ? "$gt" : "$gte"]: value };
      return (await (await c(col)).find({ [field]: cond }).toArray()).map(plain<T>);
    },
    get: async <T,>(col: Col, id: string) => {
      const d = await (await c(col)).findOne({ _id: id });
      return d ? plain<T>(d) : null;
    },
    set: async (col, id, data) => void (await (await c(col)).replaceOne({ _id: id }, data, { upsert: true })),
    del: async (col, id) => void (await (await c(col)).deleteOne({ _id: id })),
    clear: async (col) => void (await (await c(col)).deleteMany({})),
  };
}

function local(): Store {
  const file = path.join(process.cwd(), ".data", "db.json");
  const read = (): Record<Col, Record<string, Doc>> => {
    const empty = { meta: {}, records: {}, cheers: {}, notes: {}, subs: {} };
    try {
      return { ...empty, ...JSON.parse(fs.readFileSync(file, "utf8")) }; // 예전 파일엔 새 모음이 없을 수 있음
    } catch {
      return empty;
    }
  };
  const write = (d: Record<Col, Record<string, Doc>>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(d));
    fs.renameSync(file + ".tmp", file); // 쓰다 멈춰도 원래 파일이 깨지지 않게
  };
  return {
    kind: "local",
    prefix: "",
    all: async <T,>(col: Col) => Object.values(read()[col]) as T[],
    find: async <T,>(col: Col, field: string, op: Op, value: string | number | boolean) =>
      Object.values(read()[col]).filter((d) => match(d[field], op, value)) as T[],
    get: async <T,>(col: Col, id: string) => (read()[col][id] as T) ?? null,
    set: async (col, id, data) => {
      const d = read();
      d[col][id] = data;
      write(d);
    },
    del: async (col, id) => {
      const d = read();
      delete d[col][id];
      write(d);
    },
    clear: async (col) => {
      const d = read();
      d[col] = {};
      write(d);
    },
  };
}

let store: Store | undefined;
export function db(): Store {
  if (store) return store;
  const uri = process.env.MONGODB_URI;
  if (uri) return (store = mongo(uri));
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) return (store = firestore(sa));
  if (process.env.VERCEL) throw new Error("Vercel에서는 MONGODB_URI(또는 FIREBASE_SERVICE_ACCOUNT) 환경 변수가 필요해요.");
  return (store = local());
}
