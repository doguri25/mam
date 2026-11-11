// 빈 학급 정리: 학생도 기록도 없고, 만든 지 14일 지났고, 14일 동안 선생님이 들어오지 않은 새 학급만 지운다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-cleanup-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
process.env.MAX_CLASSES = "8";
const { SPACE_COLS, db, inSpace, outOfSpace } = await import("./db.ts");
const D = await import("./data.ts");
type Acc = import("./data.ts").Account;

const NOW = new Date("2026-11-20T00:00:00Z");
const ago = (days: number, from = NOW) => new Date(from.getTime() - days * 86_400_000).toISOString();
const classOf = (o: Partial<import("./data.ts").ClassUse>) => ({ id: "x", name: "x", space: "c0000abcd", createdAt: ago(20), lastLogin: ago(20), students: 0, data: false, ...o });

test("고르기: 새 학급 공간·학생 0·기록 없음·만든 지 14일·14일 동안 로그인 없음을 모두 만족해야", () => {
  const pick = (o: Partial<import("./data.ts").ClassUse>) => D.emptyClassesToRemove([classOf(o)], NOW).length === 1;
  assert.equal(pick({}), true);
  assert.equal(pick({ createdAt: ago(14), lastLogin: ago(14) }), true); // 딱 14일
  assert.equal(pick({ students: 1 }), false);
  assert.equal(pick({ data: true }), false);
  assert.equal(pick({ createdAt: ago(13) }), false);
  assert.equal(pick({ lastLogin: ago(13) }), false);
  assert.equal(pick({ lastLogin: undefined }), false); // 마지막 로그인을 모르면(그리고 처음 본 때도 없으면) 지우지 않음
  assert.equal(pick({ lastLogin: undefined, seen: ago(15) }), true);
  assert.equal(pick({ lastLogin: undefined, seen: ago(2) }), false);
  assert.equal(pick({ createdAt: "이상한 날짜" }), false);
  // 홍북초("")·체험(demo)·모양이 다른 공간은 절대 아님
  for (const space of ["", "demo", "c123", "x0000abcd", "c0000ABCD"]) assert.equal(pick({ space }), false, space);
});

async function makeClass(space: string, acc: Partial<Acc>, fill?: () => Promise<unknown>) {
  const a: Acc = { id: space, name: `반 ${space}`, space, createdAt: ago(20), lastLogin: ago(20), ...acc };
  await outOfSpace(() => db().set("accounts", a.id, { ...a }));
  await inSpace(space, async () => {
    await D.savePin({ salt: "s", hash: "h", v: 1 });
    await D.saveSettings(D.defaultSettings());
    await fill?.();
  });
  return a;
}

test("정리: 빈 학급의 모음·코드 색인·계정을 지우고 기록을 남긴다. 학생·기록·진단이 있거나 최근 학급은 그대로", async () => {
  await makeClass("c000000a1", {}); // 지움
  await makeClass("c000000a2", {}, () => D.saveRoster([{ no: 1, alias: "햇살", code: "ABCDEF" }])); // 학생 있음
  await makeClass("c000000a3", {}, () => db().set("records", "1_x", { id: "1_x", no: 1, date: "2026-10-01" })); // 기록 있음(학생은 명단에서 지움)
  await makeClass("c000000a4", { createdAt: ago(5), lastLogin: ago(5) }); // 최근에 만듦
  await makeClass("c000000a5", { lastLogin: ago(3) }); // 최근에 들어옴
  await makeClass("c000000a6", {}, () => db().set("meta", "selnote_r_1", { kind: "selNote", round: "r", no: 1, memo: "메모", at: ago(30) })); // 역량 진단 선생님 메모만
  await makeClass("c000000a7", { lastLogin: undefined }); // 예전 학급(마지막 로그인 모름)
  await makeClass("c000000a8", {}, () => db().set("letters", "l", { id: "l", createdAt: ago(30) })); // 쪽지만 남음
  await outOfSpace(() => db().set("codes", "ZZZZZZ", { id: "ZZZZZZ", space: "c000000a1", no: 1 })); // 남은 색인
  await inSpace("c000000a1", () => db().set("subs", "s1", { id: "s1" }));
  await inSpace("demo", () => db().set("meta", "roster", { students: [] }));

  const gone = await D.cleanupEmptyClasses(NOW);
  assert.deepEqual(gone, ["반 c000000a1"]);
  const ids = (await outOfSpace(() => db().all<Acc>("accounts"))).map((a) => a.id).sort();
  assert.deepEqual(ids, ["c000000a2", "c000000a3", "c000000a4", "c000000a5", "c000000a6", "c000000a7", "c000000a8"]);
  for (const col of SPACE_COLS) assert.deepEqual(await inSpace("c000000a1", () => db().all(col)), [], col);
  const file = JSON.parse(fs.readFileSync(".data/db.json", "utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(file).filter((k) => k.startsWith("c000000a1_")), []); // 모음째 사라짐
  assert.equal(await outOfSpace(() => db().get("codes", "ZZZZZZ")), null);
  assert.ok(await inSpace("demo", () => db().get("meta", "roster"))); // 체험은 그대로
  assert.ok(await inSpace("c000000a2", () => D.getPin()));
  const log = await outOfSpace(() => db().get<{ items: { space: string }[] }>("sys", "cleanupLog"));
  assert.deepEqual(log?.items.map((x) => x.space), ["c000000a1"]);

  // 예전 학급은 처음 본 때를 적어 두고 14일 더 기다린다
  const a7 = await outOfSpace(() => db().get<Acc>("accounts", "c000000a7"));
  assert.equal(a7?.seen, NOW.toISOString());
  // 13일 뒤: 그사이 14일이 찬 a4(5일 전에 만듦)·a5(3일 전 로그인)는 지워지지만 a7은 아직
  assert.deepEqual(await D.cleanupEmptyClasses(new Date(NOW.getTime() + 13 * 86_400_000)), ["반 c000000a4", "반 c000000a5"]);
  assert.deepEqual(await D.cleanupEmptyClasses(new Date(NOW.getTime() + 14 * 86_400_000)), ["반 c000000a7"]);
});

test("선생님이 들어오면 마지막 로그인을 적고, 빈 학급 정리는 하루 한 번만", async () => {
  const later = new Date(NOW.getTime() + 40 * 86_400_000);
  const a = await makeClass("c000000b1", {});
  await makeClass("c000000b2", {});
  await D.noteTeacherLogin(a, later); // b1은 방금 들어왔으므로 남고 b2는 지워짐
  const ids = (await outOfSpace(() => db().all<Acc>("accounts"))).map((x) => x.id);
  assert.ok(ids.includes("c000000b1"));
  assert.ok(!ids.includes("c000000b2"));
  assert.equal((await outOfSpace(() => db().get<Acc>("accounts", "c000000b1")))?.lastLogin, later.toISOString());
  await makeClass("c000000b3", {});
  await D.noteTeacherLogin(a, new Date(later.getTime() + 3600_000)); // 같은 날: 정리하지 않음
  assert.ok(await outOfSpace(() => db().get("accounts", "c000000b3")));
  await D.noteTeacherLogin({ id: "홍북초", name: "홍북초", space: "", createdAt: "" }, later); // 처음부터 있던 반은 계정 문서를 만들지 않음
  assert.equal(await outOfSpace(() => db().get("accounts", "홍북초")), null);
});

test("가입: 학급 수 한도 가까이면 빈 학급을 먼저 정리해 자리를 내고, IP마다 하루 3개까지(429)", async () => {
  for (const a of await outOfSpace(() => db().all<Acc>("accounts"))) await outOfSpace(() => db().del("accounts", a.id));
  for (let i = 1; i <= 7; i++) await makeClass(`c000000c${i}`, { lastLogin: ago(1, new Date()) }, () => D.saveRoster([{ no: 1, alias: "가", code: `CCCCC${i}` }]));
  await makeClass("c000000c8", { createdAt: ago(30, new Date()), lastLogin: ago(30, new Date()) }); // 빈 학급 → 정리됨
  const r = await D.createAccount("새 반 선생님", "3학년 1반", "1234", { ip: "50.0.0.1" });
  assert.ok("space" in r, JSON.stringify(r));
  assert.equal(await outOfSpace(() => db().get("accounts", "c000000c8")), null);
  // 꽉 참: 한도 오류(정리할 빈 학급 없음)
  const full = await D.createAccount("또 다른 반", "3학년 2반", "1234", { ip: "50.0.0.1" });
  assert.match("error" in full ? full.error : "", /학급 수를 넘었어요/);
  // IP 한도: 자리를 만들고 같은 IP로 세 번 더(이미 한 번 만듦)
  for (const id of ["c000000c1", "c000000c2", "c000000c3"]) await outOfSpace(() => db().del("accounts", id));
  assert.ok("space" in (await D.createAccount("반 둘", "x", "1234", { ip: "50.0.0.1" })));
  assert.ok("space" in (await D.createAccount("반 셋", "x", "1234", { ip: "50.0.0.1" })));
  const over = await D.createAccount("반 넷", "x", "1234", { ip: "50.0.0.1" });
  assert.deepEqual("error" in over ? over.status : 0, 429);
});

test("가입: 같은 이름이 같은 순간 둘 와도 계정은 하나, 진 쪽 공간은 지운다", async () => {
  for (const a of await outOfSpace(() => db().all<Acc>("accounts"))) await outOfSpace(() => db().del("accounts", a.id));
  const spaces = () => {
    const file = JSON.parse(fs.readFileSync(".data/db.json", "utf8")) as Record<string, Record<string, unknown>>;
    return Object.keys(file).filter((k) => /^c[0-9a-f]{8}_meta$/.test(k) && Object.keys(file[k]).length).map((k) => k.slice(0, 9));
  };
  const before = new Set(spaces());
  const rs = await Promise.all([D.createAccount("같은 이름", "a", "1111"), D.createAccount("같은 이름", "b", "2222")]);
  const ok = rs.filter((r) => "space" in r) as { space: string }[];
  assert.equal(ok.length, 1);
  assert.match(JSON.stringify(rs.find((r) => "error" in r)), /이미 있는 이름/);
  assert.deepEqual((await outOfSpace(() => db().all<Acc>("accounts"))).map((a) => a.space), [ok[0].space]);
  assert.deepEqual(spaces().filter((sp) => !before.has(sp)), [ok[0].space]); // 진 쪽이 만든 공간은 남지 않음
});
