// 저장소 옮기기·속도 재기(미리보기 전용 관리 도구). 화면: /admin/db
// 실제 배포(production)에서는 열리지 않는다. 미리보기 주소는 Vercel 로그인(배포 보호)한 사람만 들어온다.
// GET = 두 저장소의 모음별 문서 수, POST {action: "copy"} = 몽고 → Turso 복사·맞춰 보기, POST {action: "bench"} = 속도 재기
// 결과는 Vercel 실행 기록(로그)에도 남긴다.
import { MongoClient } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { mongo, tursoStore, type Store } from "@/lib/db";
import { bench, copyAll } from "@/lib/migrate";
import { connect } from "@/lib/turso";

export const maxDuration = 60;
const PREFIX = process.env.DATA_PREFIX || "maeumbit_";
const env = () => ({ mongo: process.env.MONGODB_URI, turso: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN, mdb: process.env.MONGODB_DB || "maeumbit" });

let mongoClient: Promise<MongoClient> | undefined;
const mdb = async () => (await (mongoClient ??= new MongoClient(env().mongo!, { maxPoolSize: 3 }).connect())).db(env().mdb);
let stores: { mongo: Store; turso: Store } | undefined;

const off = () => process.env.VERCEL_ENV === "production";
const missing = () => {
  const e = env();
  return [!e.mongo && "MONGODB_URI", !e.turso && "TURSO_DATABASE_URL"].filter(Boolean) as string[];
};

export async function GET() {
  if (off()) return new NextResponse(null, { status: 404 });
  const need = missing();
  if (need.length) return NextResponse.json({ ready: false, need, mongoDb: env().mdb });
  try {
    const m = await mdb();
    const names = (await m.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => n.startsWith(PREFIX)).sort();
    const mongoCounts = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await m.collection(n).countDocuments()] as const)));
    const c = await connect(env().turso!, env().token);
    const has = (await c.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'docs'")).rows.length > 0;
    const tursoCounts = has
      ? Object.fromEntries((await c.execute("SELECT col, count(*) AS n FROM docs GROUP BY col ORDER BY col")).rows.map((r) => [String(r.col), Number(r.n)]))
      : {};
    c.close();
    return NextResponse.json({ ready: true, mongoDb: env().mdb, prefix: PREFIX, mongo: mongoCounts, turso: tursoCounts });
  } catch (e) {
    return NextResponse.json({ ready: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (off()) return new NextResponse(null, { status: 404 });
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "요청이 올바르지 않아요." }, { status: 415 });
  const need = missing();
  if (need.length) return NextResponse.json({ error: `환경 변수가 없어요: ${need.join(", ")}` }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (body.action === "copy") {
      const m = await mdb();
      const c = await connect(env().turso!, env().token);
      const out = await copyAll({
        names: async () => (await m.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name),
        docs: (n) => m.collection(n).find().toArray() as Promise<Record<string, unknown>[]>,
      }, c, PREFIX);
      c.close();
      console.log("[admin/db] copy", JSON.stringify({ mongoDb: env().mdb, ...out }));
      return NextResponse.json({ mongoDb: env().mdb, ...out });
    }
    if (body.action === "bench") {
      stores ??= { mongo: mongo(env().mongo!), turso: tursoStore(env().turso!, env().token) };
      // 차례에 따른 치우침이 없게 번갈아 두 번씩
      const runs = [];
      for (const k of ["mongo", "turso", "mongo", "turso"] as const) runs.push(await bench(stores[k]));
      const out = { region: process.env.VERCEL_REGION ?? "local", mongo: [runs[0], runs[2]], turso: [runs[1], runs[3]] };
      console.log("[admin/db] bench", JSON.stringify(out));
      return NextResponse.json(out);
    }
    return NextResponse.json({ error: "모르는 요청이에요." }, { status: 400 });
  } catch (e) {
    console.error("[admin/db]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
