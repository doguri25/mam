// 휴대폰 알림 기기 끊기: 이 학급의 알림 주소만 모두 빼고(하나는 남길 수 있음) 뺀 수를 돌려준다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-push-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { inSpace } = await import("./db.ts");
const { clearSubs, countSubs, hasSub, saveSub } = await import("./push.ts");

const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: "p", auth: "a" } });

test("clearSubs: 이 학급 기기를 모두 빼고 수를 돌려준다(다른 학급은 그대로)", async () => {
  await inSpace("cpush0001", async () => { for (const n of [1, 2, 3]) await saveSub(sub(n), "폰"); });
  await inSpace("cpush0002", () => saveSub(sub(9), "폰"));
  assert.equal(await inSpace("cpush0001", () => clearSubs()), 3);
  assert.equal(await inSpace("cpush0001", countSubs), 0);
  assert.equal(await inSpace("cpush0002", countSubs), 1);
});

test("clearSubs(keepEndpoint): 비밀번호를 바꾼 이 기기 하나만 남긴다", async () => {
  await inSpace("cpush0003", async () => {
    for (const n of [1, 2, 3]) await saveSub(sub(n), "폰");
    assert.equal(await clearSubs(sub(2).endpoint), 2);
    assert.equal(await countSubs(), 1);
  });
});

test("hasSub: 이 학급 알림 목록에 지금 있는 기기만 true(다른 기기에서 빼면 false, 다른 학급 것은 false)", async () => {
  await inSpace("cpush0004", async () => {
    for (const n of [1, 2]) await saveSub(sub(n), "폰");
    assert.equal(await hasSub(sub(1).endpoint), true);
    await clearSubs(sub(2).endpoint); // 2번 기기에서 비밀번호를 바꿈 → 1번 기기는 빠짐
    assert.equal(await hasSub(sub(1).endpoint), false);
    assert.equal(await hasSub(sub(2).endpoint), true);
  });
  assert.equal(await inSpace("cpush0005", () => hasSub(sub(2).endpoint)), false);
});
