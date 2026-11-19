// 공용 업스테이지 키: 체험은 업스테이지로만, 실제 학급은 그 AI 키가 없을 때만 학급마다 하루 정해진 번까지
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// 이 시험은 임시 폴더의 로컬 저장소(.data/db.json)만 쓴다
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-shared-ai-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL", "TRIAL_AI_KEY", "TRIAL_AI_PROVIDER", "UPSTAGE_MODEL"]) delete process.env[k];
process.env.UPSTAGE_API_KEY = "up_shared_test";
process.env.SHARED_AI_PER_DAY = "2";
const { aiConfig, rawKey, sharedAiCap, sharedAiUsed, demoAiUsed, trialAiSource } = await import("./data.ts");
const { inSpace } = await import("./db.ts");

test("하루 횟수: 비었거나 이상하면 100, 0이면 끄기", () => {
  assert.equal(sharedAiCap(undefined), 100);
  assert.equal(sharedAiCap(""), 100);
  assert.equal(sharedAiCap("abc"), 100);
  assert.equal(sharedAiCap("0"), 0);
  assert.equal(sharedAiCap("30.7"), 30);
});

test("키 없는 학급은 공용 업스테이지 키를 하루 정해진 번까지만 빌린다", async () => {
  await inSpace("ctest", async () => {
    const a = await aiConfig();
    assert.deepEqual([a?.provider, a?.key], ["upstage", "up_shared_test"]);
    assert.equal(await aiConfig("gemini"), null); // 다른 AI를 콕 집어 부를 때는 빌리지 않음
    assert.equal(await rawKey("gemini"), null);
    assert.equal(await rawKey("upstage"), "up_shared_test"); // 교과서 읽기(Document Parse)
    assert.equal(await sharedAiUsed(), 2);
    assert.equal(await aiConfig(), null); // 오늘 몫을 다 씀
  });
  // 학급마다 따로 센다
  await inSpace("cother", async () => assert.equal((await aiConfig())?.provider, "upstage"));
});

test("체험은 공용 업스테이지 키로 돌고, 체험 하루 몫으로 센다", async () => {
  await inSpace("demo", async () => {
    assert.equal(await trialAiSource(), "upstage");
    const before = await demoAiUsed();
    const a = await aiConfig();
    assert.deepEqual([a?.provider, a?.key], ["upstage", "up_shared_test"]);
    assert.equal(await demoAiUsed(), before + 1);
    assert.equal(await sharedAiUsed(), 0); // 학급 몫과 섞이지 않음
  });
});

test("체험 AI는 IP마다 하루 몫이 따로 있다(한 사람이 체험 몫을 다 쓰지 못하게), IP를 모르면 전체 몫만", async () => {
  const { TRIAL_AI_PER_IP, withIp } = await import("./limit.ts");
  const h = (ip: string) => new Headers({ "x-forwarded-for": ip });
  await inSpace("demo", async () => {
    const before = await demoAiUsed();
    let got = 0;
    for (let i = 0; i < TRIAL_AI_PER_IP + 3; i++) if (await withIp(h("203.0.113.7"), () => aiConfig())) got++;
    assert.equal(got, TRIAL_AI_PER_IP);
    assert.equal(await demoAiUsed(), before + TRIAL_AI_PER_IP); // 막힌 요청은 전체 몫을 쓰지 않음
    assert.ok(await withIp(h("198.51.100.9"), () => aiConfig())); // 다른 IP는 그대로
    assert.ok(await aiConfig()); // IP를 모르는 호출(시험·내부)
  });
});

test("모든 학급 공용 몫이 다 차면 학급 몫은 돌려준다(부르지 않은 AI가 학급 사용량에 세지지 않게)", async () => {
  const { db, outOfSpace } = await import("./db.ts");
  const { today } = await import("./date.ts");
  const { SHARED_AI_ALL_PER_DAY } = await import("./data.ts");
  await outOfSpace(() => db().set("sys", "sharedAiAll", { date: today(), n: SHARED_AI_ALL_PER_DAY }));
  await inSpace("cfull", async () => {
    assert.equal(await aiConfig(), null);
    assert.equal(await sharedAiUsed(), 0);
  });
  await outOfSpace(() => db().del("sys", "sharedAiAll"));
});
