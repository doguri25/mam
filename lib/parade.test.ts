// 첫 화면 띠 그림의 마음 친구들: 모두 다르게 생겼고, 차례로 인사하며, 표정은 인사하는 사이에만 바뀐다
import assert from "node:assert/strict";
import { test } from "node:test";
import { FRIENDS, PARADE_W, WAVE_EVERY, WAVE_GAP, friendAt } from "../components/buddy/parade.ts";
import { EXPR } from "../components/buddy/expr.ts";
import { cleanLook } from "./shared.ts";

test("친구마다 모습이 다르고, 고를 수 있는 모습·마음만 쓴다", () => {
  assert.equal(FRIENDS.length, 5);
  for (const f of FRIENDS) {
    assert.deepEqual(cleanLook(f.look), f.look, `${f.look.shape}: 없는 꾸미기를 썼어요`);
    for (const m of f.feelings) assert.ok(EXPR[m], `${m} 표정이 없어요`);
    assert.ok(f.x - f.b / 2 >= -10 && f.x + f.b / 2 <= PARADE_W + 10, "장면 밖으로 나가요");
  }
  for (const k of ["shape", "color", "acc"] as const) assert.equal(new Set(FRIENDS.map((f) => f.look[k])).size, 5, `${k}가 겹쳐요`);
  // 왼쪽부터 차례로 서 있다
  assert.deepEqual(FRIENDS.map((f) => f.x), [...FRIENDS.map((f) => f.x)].sort((a, b) => a - b));
});

test("인사 물결은 왼쪽 친구부터 차례로 지나가고, 표정은 인사 중에만 바뀐다", () => {
  const starts = FRIENDS.map((_, i) => {
    for (let f = 0; f < 24 * 20; f++) if (friendAt(i, f / 24).cheer !== null) return f / 24;
    return -1;
  });
  for (let i = 1; i < starts.length; i++) assert.ok(Math.abs(starts[i] - starts[i - 1] - WAVE_GAP) < 0.05, `${i}번 친구 차례가 어긋나요`);
  FRIENDS.forEach((f, i) => {
    let prev = friendAt(i, 0).feeling;
    assert.equal(prev, f.feelings[0]);
    const seen = new Set([prev]);
    for (let fr = 1; fr < 24 * WAVE_EVERY * f.feelings.length + 24 * 3; fr++) {
      const now = friendAt(i, fr / 24);
      if (now.feeling !== prev) assert.notEqual(now.cheer, null, `${f.feelings.join(",")}: 인사하지 않을 때 표정이 바뀌었어요`);
      prev = now.feeling;
      seen.add(prev);
    }
    assert.equal(seen.size, f.feelings.length, "모든 마음을 한 번씩 지어요");
  });
});
