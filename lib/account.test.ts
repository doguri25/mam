// 실행: node --test lib/
import assert from "node:assert/strict";
import { test } from "node:test";
import { nameKey, validName } from "./data.ts";

test("계정 이름: 공백·대소문자·보이지 않는 글자는 같은 이름으로 모음(홍북초인 척 막기)", () => {
  assert.equal(nameKey("  홍북초 "), "홍북초");
  assert.equal(nameKey("홍북초ㅤ"), "홍북초");
  assert.equal(nameKey("홍​북초"), "홍북초");
  assert.equal(nameKey("홍북초  3-2   Kim"), "홍북초 3-2 kim");
  assert.equal(validName("홍북초 3-2 김민지"), true);
  assert.equal(validName("가"), false);
  assert.equal(validName("a/b"), false);
});
