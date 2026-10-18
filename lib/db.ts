// 저장소: FIREBASE_SERVICE_ACCOUNT가 있으면 Firestore, 없으면 로컬 파일(.data/db.json)
// Firestore는 서버(관리자 SDK)에서만 읽고 쓴다 — 브라우저는 API로만 닿는다.
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export type Col = "meta" | "records" | "cheers" | "notes";
type Doc = Record<string, unknown>;

interface Store {
  kind: "firestore" | "local";
  all<T>(col: Col): Promise<T[]>;
  get<T>(col: Col, id: string): Promise<T | null>;
  set(col: Col, id: string, data: Doc): Promise<void>;
  del(col: Col, id: string): Promise<void>;
  clear(col: Col): Promise<void>;
}

const PREFIX = "maeumbit_";

function firestore(sa: string): Store {
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(sa)) });
  const db: Firestore = getFirestore(app);
  const c = (col: Col) => db.collection(PREFIX + col);
  return {
    kind: "firestore",
    all: async <T,>(col: Col) => (await c(col).get()).docs.map((d) => d.data() as T),
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

function local(): Store {
  const file = path.join(process.cwd(), ".data", "db.json");
  const read = (): Record<Col, Record<string, Doc>> => {
    const empty = { meta: {}, records: {}, cheers: {}, notes: {} };
    try {
      return { ...empty, ...JSON.parse(fs.readFileSync(file, "utf8")) }; // 예전 파일엔 새 모음(notes)이 없을 수 있음
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
    all: async <T,>(col: Col) => Object.values(read()[col]) as T[],
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
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) return (store = firestore(sa));
  if (process.env.VERCEL) throw new Error("Vercel에서는 FIREBASE_SERVICE_ACCOUNT 환경 변수가 필요해요.");
  return (store = local());
}
