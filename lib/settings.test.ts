// 설정 저장과 「살펴봤어요」 표시: 먼저 읽어 둔 설정으로 저장해도 그사이 단 표시를 잃지 않는다
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-settings-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, inSpace } = await import("./db.ts");
const D = await import("./data.ts");

test("설정 저장은 저장소의 「살펴봤어요」 표시를 그대로 두고, 비울 때만 준 것을 쓴다", async () => {
  await inSpace("cset1", async () => {
    await D.saveSettings(D.defaultSettings());
    const stale = await D.getSettings(); // 화면이 설정을 읽어 둠
    await db().setField("meta", "settings", "checks.3_2026-11-16", "2026-11-19T01:00:00Z"); // 다른 탭에서 「살펴봤어요」
    await D.saveSettings({ ...stale, className: "새 이름" });
    const now = await D.getSettings();
    assert.equal(now.className, "새 이름");
    assert.deepEqual(now.checks, { "3_2026-11-16": "2026-11-19T01:00:00Z" });
    await D.saveSettings({ ...now, checks: {} }, true);
    assert.deepEqual((await D.getSettings()).checks, {});
  });
});

test("표시 지우기는 고른 번호 것만(그사이 단 다른 표시는 남는다)", async () => {
  await inSpace("cset2", async () => {
    await D.saveSettings(D.defaultSettings());
    await db().setField("meta", "settings", "checks.3_2026-11-16", "a");
    await db().setField("meta", "settings", "checks.4_2026-11-16", "b");
    await D.pruneChecks((no) => no === 3);
    assert.deepEqual((await D.getSettings()).checks, { "4_2026-11-16": "b" });
    await D.pruneChecks((no) => no === 9); // 지울 것 없음
    assert.deepEqual((await D.getSettings()).checks, { "4_2026-11-16": "b" });
  });
});

test("설정 고치기는 이 요청이 바꾸는 칸만 저장소 설정에 얹는다(그사이 다른 기기에서 바꾼 칸이 되돌아가지 않게)", async () => {
  await inSpace("cset9", async () => {
    await D.saveSettings(D.defaultSettings());
    await D.editSettings((s) => ({ ...s, retention: "24m" })); // 다른 기기
    await D.editSettings((s) => ({ ...s, className: "새 이름" })); // 이 기기(앞서 읽은 설정과 상관없이)
    const now = await D.getSettings();
    assert.deepEqual([now.retention, now.className], ["24m", "새 이름"]);
  });
});
