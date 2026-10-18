// Firestore → MongoDB 한 번 옮기기. 문서 id는 _id로, 내용은 그대로(암호화된 AI 키 포함, SESSION_SECRET이 같아야 풀림).
// 쓰기: FIREBASE_SERVICE_ACCOUNT=… MONGODB_URI=… node scripts/copy-to-mongo.mjs [모음 앞이름, 기본 maeumbit_]
// MongoDB 쪽 같은 모음은 덮어쓴다(같은 id면 바꾸고, 없던 것은 더함). Firestore는 읽기만 한다.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MongoClient } from "mongodb";

const prefix = process.argv[2] || "maeumbit_";
const { FIREBASE_SERVICE_ACCOUNT: sa, MONGODB_URI: uri, MONGODB_DB: dbName = "maeumbit" } = process.env;
if (!sa || !uri) throw new Error("FIREBASE_SERVICE_ACCOUNT와 MONGODB_URI가 필요해요.");

const fire = getFirestore(initializeApp({ credential: cert(JSON.parse(sa)) }));
const client = await new MongoClient(uri).connect();
try {
  for (const col of ["meta", "records", "cheers", "notes", "subs"]) {
    const docs = (await fire.collection(prefix + col).get()).docs;
    if (docs.length) {
      await client.db(dbName).collection(prefix + col).bulkWrite(
        docs.map((d) => ({ replaceOne: { filter: { _id: d.id }, replacement: d.data(), upsert: true } })),
      );
    }
    console.log(`${prefix + col}: ${docs.length}개`);
  }
} finally {
  await client.close();
}
