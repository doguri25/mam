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

test("알림 등록: 브라우저 알림 서버처럼 이름 있는 https 주소와 짧은 키만 받는다(서버 안쪽 주소로 보내지 않게)", async () => {
  const { pushEndpointOk, pushKeyOk } = await import("./push.ts");
  for (const u of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/Q", "https://wns2-sg2p.notify.windows.com/w/?token=x"])
    assert.equal(pushEndpointOk(u), true, u);
  for (const u of ["http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://[::1]/x", "https://localhost/x", "https://metadata.google.internal/x",
    "https://fcm.googleapis.com:8443/x", "https://intranet/x", `https://fcm.googleapis.com/${"a".repeat(1000)}`, 3, null])
    assert.equal(pushEndpointOk(u), false, String(u));
  assert.equal(pushEndpointOk("https://push.whale.naver.com/abc"), true); // 목록에 없는 브라우저 알림 서버도
  for (const u of ["https://localhost./x", "https://metadata.google.internal./x", "https://foo.local./x", "https://kubernetes.default.svc./x", "https://169.254.169.254.nip.io/x", "https://127.0.0.1.sslip.io/x", "https://localtest.me/x"])
    assert.equal(pushEndpointOk(u), false, u);
  assert.equal(pushKeyOk("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"), true);
  assert.equal(pushKeyOk("x".repeat(201)), false);
  assert.equal(pushKeyOk({}), false);
});

test("알림 주소가 가리키는 IP: IPv4를 담은 IPv6(::ffff:10.0.0.1, ::ffff:a00:1)도 안쪽 주소로 본다", async () => {
  const { innerAddr } = await import("./push.ts");
  for (const a of ["::ffff:10.0.0.1", "::ffff:a00:1", "::ffff:a9fe:a9fe", "::ffff:127.0.0.1", "fe80::1", "::1", "fd00::1", "10.1.2.3", "169.254.169.254"]) assert.equal(innerAddr(a), true, a);
  for (const a of ["::ffff:8.8.8.8", "2607:f8b0::1", "93.184.216.34"]) assert.equal(innerAddr(a), false, a);
});
