import assert from "node:assert/strict";
import { test } from "node:test";
import { t } from "./i18n.ts";
import { BUDDY_ACCS, BUDDY_CHEEKS, BUDDY_EYES, BUDDY_LIMBS, BUDDY_PATTERNS, BUDDY_SHAPES, DEFAULT_LOOK, cleanLook, lighten } from "./shared.ts";

test("예전에 저장한 모습은 새 항목을 기본값으로 채우고, 이상한 값은 버린다", () => {
  const old = cleanLook({ color: "#ff9eb0", shape: "bean", acc: "crown", name: "몽실이" });
  assert.deepEqual(old, { ...DEFAULT_LOOK, color: "#ff9eb0", shape: "bean", acc: "crown", name: "몽실이" });
  const bad = cleanLook({ color: "red", eyes: "laser", limbs: "wings", name: "<script>아주아주긴이름입니다" });
  assert.equal(bad.color, "");
  assert.equal(bad.eyes, DEFAULT_LOOK.eyes);
  assert.equal(bad.limbs, DEFAULT_LOOK.limbs);
  assert.equal(bad.name.length <= 8 && !bad.name.includes("<"), true);
});

test("몸 색을 흰색 쪽으로 섞기", () => {
  assert.equal(lighten("#000000", 0.5), "#808080");
  assert.equal(lighten("#ffffff", 0.5), "#ffffff");
});

test("꾸미기 칸마다 5개 언어 이름이 있다", () => {
  const keys = [
    ...BUDDY_SHAPES.map((x) => `shape_${x}`), ...BUDDY_EYES.map((x) => `eyes_${x}`), ...BUDDY_ACCS.map((x) => `acc_${x}`),
    ...[...BUDDY_CHEEKS, ...BUDDY_PATTERNS, ...BUDDY_LIMBS].filter((x) => x !== "none").map((x) => x),
  ];
  const named = (k: string) => (["blush", "freckle"].includes(k) ? `cheek_${k}` : ["spots", "belly"].includes(k) ? `pattern_${k}` : ["arms", "both"].includes(k) ? `limbs_${k}` : k);
  for (const k of keys.map(named)) for (const lang of ["ko", "en", "zh", "vi", "ja"] as const) {
    assert.ok(t(lang, k as Parameters<typeof t>[1]), `${k} ${lang}`);
  }
});

test("감정 단어 놀이: 정답이 모두 더 꼭 맞는 말이고, 한 판은 보기 3개 5문제", async () => {
  const { MEANING, SITUATIONS, makeRound } = await import("./game.ts");
  const { NUANCE_WORDS } = await import("./shared.ts");
  for (const s of SITUATIONS) assert.ok(NUANCE_WORDS.includes(s.answer), s.answer);
  for (const w of NUANCE_WORDS) assert.ok(MEANING[w], `뜻풀이 없음: ${w}`);
  const round = makeRound(["설레요"], 7);
  assert.equal(round.length, 5);
  assert.equal(round[0].answer, "설레요"); // 반 감정 단어 문제가 먼저
  for (const q of round) {
    assert.equal(new Set(q.options).size, 3);
    assert.ok(q.options.includes(q.answer));
  }
});
