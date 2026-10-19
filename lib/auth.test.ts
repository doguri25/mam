import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPassword, isTeacher, makePin, teacherToken, validPin } from "./auth.ts";

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
});
