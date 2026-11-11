// 학생 화면 다섯 언어: 기본 되묻기가 마음에 맞는지, 새 안내 글이 모든 언어에 있는지
import assert from "node:assert/strict";
import { test } from "node:test";
import { LANGS, SKIP, errText, fallbackFor, t } from "./i18n.ts";

test("기본 되묻기: 기쁜 마음 + 집·몸이면 「좋았겠다!」 뒤에 힘든 보기 대신 기쁜 마음에 맞는 보기를, 힘든 마음은 그대로", () => {
  const ko = fallbackFor("ko", "집", true);
  assert.equal(ko.question, "좋았겠다! 지금 마음은 어때?");
  assert.deepEqual(ko.options, ["아주 좋아", "조금 좋아", SKIP.ko]);
  assert.deepEqual(fallbackFor("ko", "집", false).options, ["조금 괜찮아", "아직 힘들어", SKIP.ko]);
  assert.ok(!fallbackFor("ko", "몸", true).options.includes("배"));
  for (const { id } of LANGS) {
    for (const reason of ["집", "몸"]) {
      const joy = fallbackFor(id, reason, true), hard = fallbackFor(id, reason, false);
      assert.equal(joy.options.length, 3, `${id} ${reason}`);
      assert.equal(joy.options[2], SKIP[id]);
      assert.ok(joy.options.slice(0, 2).every((o) => o && !hard.options.includes(o)), `${id} ${reason}: ${joy.options}`);
      assert.notEqual(joy.question, hard.question);
    }
    // 다른 까닭은 기쁜 마음이어도 예전 보기 그대로(앞말만 「좋았겠다!」)
    assert.deepEqual(fallbackFor(id, "친구", true).options, fallbackFor(id, "친구", false).options);
    assert.deepEqual(fallbackFor(id, "없는 까닭", true).options, fallbackFor(id, "그냥", true).options);
  }
});

test("새 안내 글은 다섯 언어 모두에 있고, 서버의 「마음 점검이 새로 열림」 글도 학생 언어로", () => {
  for (const key of ["slowThink", "checkChanged", "sendWait", "checkStory", "checkStoryHint", "checkTry", "checkLetter"] as const) {
    const ko = t("ko", key);
    assert.ok(ko.length > 5);
    for (const { id } of LANGS) if (id !== "ko") assert.ok(t(id, key) && t(id, key) !== ko, `${key} ${id}`);
  }
  const msg = "마음 점검이 새로 열렸어요. 처음부터 다시 해 주세요.";
  assert.equal(errText("ko", msg), msg);
  for (const { id } of LANGS) if (id !== "ko") assert.notEqual(errText(id, msg), errText(id, "문제가 생겼어요."), id);
});
