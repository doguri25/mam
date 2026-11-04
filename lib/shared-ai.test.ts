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
