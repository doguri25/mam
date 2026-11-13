// 너무 잦은 시도 막기: 학생 코드 로그인 · 선생님 비밀번호 · 새 학급 만들기 · 체험 처음 판으로. 시각(now)을 넘겨 시간을 흉내 낸다.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "mam-limit-")));
for (const k of ["MONGODB_URI", "FIREBASE_SERVICE_ACCOUNT", "VERCEL"]) delete process.env[k];
const { db, outOfSpace } = await import("./db.ts");
const L = await import("./limit.ts");
const { hashId } = await import("./auth.ts");

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 4, 0, 0, 0); // 10분 칸·한 시간 칸이 시작하는 때
const sys = () => outOfSpace(() => db().all<{ exp?: number }>("sys"));

test("IP: x-forwarded-for 첫 칸, 없으면 x-real-ip. 포트는 떼고 IPv6는 /64로 묶는다", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(L.clientIp(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
  assert.equal(L.clientIp(h({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(L.clientIp(h({})), "unknown");
  assert.equal(L.normIp("203.0.113.5:443"), "203.0.113.5");
  assert.equal(L.normIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(L.normIp("2001:db8:abcd:12:1:2:3:4"), "2001:db8:abcd:12::/64");
  assert.equal(L.normIp("[2001:0db8:abcd:0012::99]:8080"), "2001:db8:abcd:12::/64");
  assert.equal(L.normIp("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(L.normIp("2001:db8:abcd:12:ffff::1"), L.normIp("2001:db8:abcd:12::2")); // 같은 /64
  assert.equal(L.waitText(40), "40초");
  assert.equal(L.waitText(61), "2분");
});

test("코드 로그인: 틀린 것만 세고, IP마다 정한 수만큼 틀리면 그 10분 칸 끝까지 막고, 다른 IP는 그대로", async () => {
  const now = T0 + 3 * MIN;
  for (let i = 0; i < 10; i++) await (await L.codeAttempt("1.1.1.1", now)).done(true); // 맞힌 로그인은 몇 번이든 세지 않음
  for (let i = 0; i < L.CODE_PER_IP; i++) {
    const g = await L.codeAttempt("1.1.1.1", now);
    assert.equal(g.wait, 0);
    await g.done(false);
  }
  const blocked = await L.codeAttempt("1.1.1.1", now);
  assert.equal(blocked.wait, 7 * 60); // 10분 칸이 끝날 때까지
  assert.equal((await L.codeAttempt("2.2.2.2", now)).wait, 0); // 다른 학교는 그대로
  assert.equal((await L.codeAttempt("1.1.1.1", T0 + 10 * MIN)).wait, 0); // 다음 칸에는 다시
});

test("코드 로그인: 같은 IP에서 한꺼번에 100번 보내도 정한 수까지만 맞춰 본다", async () => {
  const now = T0 + 20 * MIN;
  const gates = await Promise.all(Array.from({ length: 100 }, () => L.codeAttempt("3.3.3.3", now)));
  assert.equal(gates.filter((g) => g.wait === 0).length, L.CODE_PER_IP);
});

test("코드 로그인: 모두 합쳐 300번 넘게 틀린 칸에는 IP마다 3번까지만", async () => {
  const now = T0 + 30 * MIN;
  for (let i = 0; i < L.CODE_ALL; i++) await (await L.codeAttempt(`10.0.${Math.floor(i / 25)}.${i % 25}`, now)).done(false);
  const ip = "4.4.4.4";
  for (let i = 0; i < L.CODE_TIGHT; i++) assert.equal((await L.codeAttempt(ip, now)).wait, 0);
  assert.ok((await L.codeAttempt(ip, now)).wait > 0);
  // 한 번도 틀리지 않은 곳의 학생은 그대로 들어온다(맞히면 돌려받으므로 몇 명이든)
  for (let i = 0; i < 10; i++) {
    const g = await L.codeAttempt("5.5.5.5", now);
    assert.equal(g.wait, 0);
    await g.done(true);
  }
});

test("선생님 비밀번호: 학급 × IP마다 5번이면 1분 → 2 → 4 → 8 → 15분까지, 다른 IP·다른 학급은 그대로", async () => {
  const sp = "cpw00001";
  let now = T0;
  const fail5 = async (ip: string) => {
    for (let i = 0; i < L.PW_FAILS; i++) {
      const g = await L.passwordAttempt(ip, sp, now);
      assert.equal(g.wait, 0, `${i}번째`);
      await g.done(false);
    }
  };
  const locks: number[] = [];
  for (let round = 0; round < 6; round++) {
    await fail5("6.6.6.6");
    const w = (await L.passwordAttempt("6.6.6.6", sp, now)).wait;
    locks.push(w);
    now += w * 1000; // 잠금이 풀릴 때까지 기다림
  }
  assert.deepEqual(locks, [60, 120, 240, 480, 900, 900]);
  assert.equal((await L.passwordAttempt("7.7.7.7", sp, now)).wait, 0); // 선생님은 다른 IP에서 그대로
  assert.equal((await L.passwordAttempt("6.6.6.6", "cpw00002", now)).wait, 0); // 다른 학급도 그대로
  // 한 시간 조용하면 처음부터(1분부터)
  now += 61 * MIN;
  await fail5("6.6.6.6");
  assert.equal((await L.passwordAttempt("6.6.6.6", sp, now)).wait, 60);
});

test("선생님 비밀번호: 맞히면 그 IP의 셈을 비우고, 한꺼번에 보내도 5번까지만 맞춰 본다", async () => {
  const sp = "cpw00003";
  const now = T0;
  for (let i = 0; i < 4; i++) await (await L.passwordAttempt("8.8.8.8", sp, now)).done(false);
  await (await L.passwordAttempt("8.8.8.8", sp, now)).done(true); // 다섯 번째에 맞힘 → 잠기지 않음
  assert.equal((await L.passwordAttempt("8.8.8.8", sp, now)).wait, 0);
  const gates = await Promise.all(Array.from({ length: 40 }, () => L.passwordAttempt("9.9.9.9", sp, now)));
  assert.equal(gates.filter((g) => g.wait === 0).length, L.PW_FAILS);
});

test("선생님 비밀번호: 한 학급에 한 시간 50번 넘게 틀리면 IP마다 한 번 틀릴 때마다 잠그지만, 맞는 비밀번호는 첫 번에 통한다", async () => {
  const sp = "cpw00004";
  const now = T0 + 5 * MIN;
  for (let i = 0; i < L.PW_CLASS_HOURLY; i++) await (await L.passwordAttempt(`20.0.0.${i}`, sp, now)).done(false);
  const g = await L.passwordAttempt("21.0.0.1", sp, now);
  assert.equal(g.wait, 0);
  await g.done(false);
  assert.equal((await L.passwordAttempt("21.0.0.1", sp, now)).wait, 60); // 한 번 틀리고 바로 잠김
  const teacher = await L.passwordAttempt("22.0.0.1", sp, now); // 선생님(다른 IP)
  assert.equal(teacher.wait, 0);
  await teacher.done(true);
  assert.equal((await L.passwordAttempt("22.0.0.1", sp, now)).wait, 0);
});

test("새 학급: IP마다 하루 50개, 모두 합쳐 하루 200개", async () => {
  const day1 = Date.UTC(2026, 10, 10, 3);
  for (let i = 0; i < L.SIGNUP_PER_IP; i++) assert.equal(await L.signupSlot("30.0.0.1", day1), null);
  assert.match((await L.signupSlot("30.0.0.1", day1))!, /하루 50개/);
  for (let i = 0; i < L.SIGNUP_PER_DAY - L.SIGNUP_PER_IP; i++) assert.equal(await L.signupSlot(`31.0.0.${i}`, day1), null);
  assert.match((await L.signupSlot("32.0.0.1", day1))!, /학급 수를 다 채웠어요/);
  // 전체 한도에 걸리면 그 IP 몫은 돌려준다(못 만든 것을 세지 않음)
  assert.equal((await outOfSpace(() => db().get<{ n: number }>("sys", `signup:${hashId("32.0.0.1")}`)))?.n, 0);
  assert.equal(await L.signupSlot("32.0.0.1", day1 + 86_400_000), null); // 다음 날은 다시
});

test("체험 처음 판으로: IP마다 1분, 모두 합쳐 10분에 한 번", async () => {
  const t = Date.UTC(2026, 10, 12, 1);
  assert.equal(await L.resetWait("40.0.0.1", t), 0);
  assert.equal(await L.resetWait("40.0.0.1", t + 10_000), 50); // 같은 IP 1분 안
  assert.equal(await L.resetWait("40.0.0.2", t + 10_000), 590); // 다른 IP도 10분 안이면 기다림
  assert.equal(await L.resetWait("40.0.0.2", t + 10 * MIN), 0);
});

test("기한 지난 셈 문서는 한 시간에 한 번 지운다(쌓이지 않음)", async () => {
  const t = Date.UTC(2026, 10, 20, 0);
  await outOfSpace(() => db().setMany("sys", [["old1", { exp: t - 1 }], ["old2", { exp: t - 5000 }], ["keep", { exp: t + 1 }], ["single", { date: "x", n: 1 }]]));
  await L.tidy(t);
  assert.equal((await sys()).filter((d) => d.exp !== undefined && d.exp < t).length, 0);
  assert.ok(await outOfSpace(() => db().get("sys", "keep")));
  assert.ok(await outOfSpace(() => db().get("sys", "single"))); // exp 없는 문서(하루 한 번 표시 등)는 그대로
  await outOfSpace(() => db().set("sys", "old3", { exp: t }));
  await L.tidy(t + 30 * MIN); // 같은 시간 칸: 지우지 않음
  assert.ok(await outOfSpace(() => db().get("sys", "old3")));
  await L.tidy(t + 61 * MIN);
  assert.equal(await outOfSpace(() => db().get("sys", "old3")), null);
});
