import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPassword, isTeacher, makePin, queueToken, readQueueToken, sign, teacherSpace, teacherToken, validPin } from "./auth.ts";
import { inSpace } from "./db.ts";

test("바꾼 비밀번호는 해시로만 맞춰 보고, 바꾸기 전에는 처음 비밀번호", () => {
  const pin = makePin("246810", 1);
  assert.notEqual(pin.hash, "246810");
  assert.equal(checkPassword("246810", pin).ok, true);
  assert.equal(checkPassword("1324", pin).ok, false);
  assert.equal(checkPassword("1324", null).ok, true);
});

test("비밀번호는 숫자 4~12자리만", () => {
  assert.equal(validPin("1234"), true);
  assert.equal(validPin("123"), false);
  assert.equal(validPin("12ab"), false);
  assert.equal(validPin("1234567890123"), false);
});

test("비밀번호를 바꾸면 예전 판의 표는 통하지 않음", () => {
  assert.equal(isTeacher(teacherToken(0), 0), true);
  assert.equal(isTeacher(teacherToken(0), 1), false);
  assert.equal(isTeacher(teacherToken(1), 1), true);
  assert.equal(isTeacher("t:9999999999999.가짜", 0), false);
  // 학급(공간)마다 표가 따로: 체험·다른 학급 표로는 이 학급을 열 수 없다
  assert.equal(isTeacher(teacherToken(0, "demo"), 0, ""), false);
  assert.equal(isTeacher(teacherToken(0, ""), 0, "demo"), false);
  assert.equal(isTeacher(teacherToken(0, "demo"), 0, "demo"), true);
  assert.equal(isTeacher(teacherToken(1, "c1a2b3c4"), 1, "c9z9z9z9"), false);
  assert.equal(teacherSpace(teacherToken(1, "c1a2b3c4")), "c1a2b3c4");
  assert.equal(teacherSpace("가짜"), "");
  // 예전 표: 공간 없음 = 홍북초, 끝이 d = 체험
  assert.equal(teacherSpace(sign(`t:${Date.now() + 60_000}:0`)), "");
  assert.equal(teacherSpace(sign(`t:${Date.now() + 60_000}:0:d`)), "demo");
});

test("처음 비밀번호 1324는 처음부터 있던 반에서만", () => {
  assert.equal(inSpace("", () => checkPassword("1324", null)).ok, true);
  assert.equal(inSpace("c1a2b3c4", () => checkPassword("1324", null)).ok, false);
});

test("끊김 대비 표는 그 학생·그날만, 고치면 무효", () => {
  const tk = queueToken(3, "ABC234", "2026-10-21", "c1a2b3c4");
  assert.deepEqual(readQueueToken(tk), { no: 3, code: "ABC234", date: "2026-10-21", space: "c1a2b3c4" });
  assert.equal(readQueueToken(tk.replace("ABC234", "ZZZ999")), null);
  assert.equal(readQueueToken(teacherToken(0)), null);
});
