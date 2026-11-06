import assert from "node:assert/strict";
import { test } from "node:test";
import { OTHER_STUDENT, checkPassword, isTeacher, makePin, otherStudent, queueCodeOk, queueToken, readQueueToken, sign, teacherSpace, teacherToken, validPin } from "./auth.ts";
import { inSpace } from "./db.ts";
import { LANGS, errText } from "./i18n.ts";

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

test("끊김 대비 표는 그 학생·그날만, 고치면 무효, 코드는 지문으로만", () => {
  const tk = queueToken(3, "ABC234", "2026-10-21", "c1a2b3c4");
  assert.ok(!tk.includes("ABC234")); // 공용 태블릿에 남아도 코드가 보이지 않게
  const q = readQueueToken(tk)!;
  assert.deepEqual({ ...q, code: "" }, { no: 3, code: "", date: "2026-10-21", space: "c1a2b3c4" });
  assert.ok(queueCodeOk("ABC234", q.code));
  assert.ok(!queueCodeOk("ZZZ999", q.code));
  assert.ok(queueCodeOk("ABC234", "ABC234")); // 예전 표
  assert.equal(readQueueToken(tk.replace("2026-10-21", "2026-10-22")), null);
  assert.equal(readQueueToken(teacherToken(0)), null);
});

test("다른 탭에서 다른 친구가 들어옴: 화면이 아는 학생·학급과 쿠키가 다를 때만, 보내지 않으면(예전 화면) 그대로", () => {
  const ck = sign("3:ABC234:c1a2b3c4");
  const at = (screen: Record<string, unknown>) => inSpace("c1a2b3c4", () => otherStudent(ck, screen));
  assert.equal(at({}), false);
  assert.equal(at({ screenNo: 3, screenSpace: "c1a2b3c4" }), false);
  assert.equal(at({ screenNo: 7 }), true);
  assert.equal(at({ screenNo: 3, screenSpace: "demo" }), true);
  assert.equal(at({ screenNo: null, screenSpace: null }), false);
  assert.equal(at({ screenNo: "3" }), false);
  assert.equal(at({ screenNo: "abc" }), true); // 알아볼 수 없는 번호는 같은 학생이라 하지 않는다
  assert.equal(inSpace("", () => otherStudent(sign("3:ABC234"), { screenNo: 3, screenSpace: "" })), false); // 공간이 적히기 전 쿠키
  // 쿠키가 없거나 고쳐졌으면 여기서 막지 않는다(아래에서 「다시 들어와 주세요」 401)
  assert.equal(otherStudent(undefined, { screenNo: 7 }), false);
  assert.equal(otherStudent(`${ck}x`, { screenNo: 7 }), false);
  // 학생 화면 언어로도 보인다
  for (const { id } of LANGS) if (id !== "ko") assert.notEqual(errText(id, OTHER_STUDENT), errText(id, "문제가 생겼어요."), id);
});
