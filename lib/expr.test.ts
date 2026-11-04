// 마음 친구 표정: 큰 감정 12가지 · 「더 꼭 맞는 말」 36가지 · 카드에 더한 낱말 24가지가 모두 저마다 다른 표정을 가진다
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXPR, exprOf, moodOf, pose } from "../components/buddy/expr.ts";
import { ALL_SUB_WORDS, EMOTION_NAMES, BUDDY_SHAPES } from "./shared.ts";

test("감정 72가지마다 표정이 있고, 서로 겹치지 않는다", () => {
  const names = [...EMOTION_NAMES, ...ALL_SUB_WORDS];
  assert.equal(names.length, 72);
  for (const n of names) assert.ok(EXPR[n], `${n} 표정이 없어요`);
  const sig = names.map((n) => { const e = EXPR[n]; return [e.eye, e.brow, e.mouth, e.fx.join("+"), e.motion, e.arms].join("|"); });
  assert.equal(new Set(sig).size, 72);
});

test("더 꼭 맞는 말은 큰 감정의 무리(색·배경)를 따른다", () => {
  assert.equal(moodOf("뿌듯해요"), "joy");
  assert.equal(moodOf("서운해요"), "sad");
  assert.equal(moodOf("부글부글해요"), "angry");
  assert.equal(moodOf("궁금해요"), "calm"); // 더한 낱말도 큰 감정을 따름
  assert.equal(moodOf("쉬고 싶어요"), "sad");
  assert.equal(exprOf("모르는 말").motion, exprOf("편안해요").motion);
});

test("자세는 늘 숫자이고 몸이 뒤집히지 않는다", () => {
  for (const n of [...EMOTION_NAMES, ...ALL_SUB_WORDS]) for (const t of [0, 0.5, 1.3, 2.7, 6.1]) {
    const p = pose({ t, expr: EXPR[n], intensity: 5, cheer: null, hard: false });
    for (const v of [p.x, p.y, p.sx, p.sy, p.rot, p.armL, p.armR]) assert.ok(Number.isFinite(v), n);
    assert.ok(p.sx > 0.7 && p.sy > 0.7, n);
  }
  assert.equal(BUDDY_SHAPES.length, 15);
});
