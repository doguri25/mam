// 마음 남기기 카드: 낱말 72장, 고를 때마다 긍정·보통·부정 4장씩 무작위로
import assert from "node:assert/strict";
import { test } from "node:test";
import { MEANING } from "./game.ts";
import { w } from "./i18n.ts";
import { CARD_WORDS, EMOTION_NAMES, POLARITY, drawCards, isWordOf, parentEmotion } from "./shared.ts";

test("카드는 72장이고 긍정·보통·부정이 24장씩, 모두 큰 감정 12가지 아래로 묶인다", () => {
  assert.equal(CARD_WORDS.length, 72);
  assert.equal(new Set(CARD_WORDS.map((c) => c.word)).size, 72);
  for (const p of ["pos", "mid", "neg"]) assert.equal(CARD_WORDS.filter((c) => c.polarity === p).length, 24, p);
  for (const c of CARD_WORDS) {
    assert.ok(EMOTION_NAMES.includes(parentEmotion(c.word)), c.word);
    if (c.word !== c.parent) assert.ok(isWordOf(c.parent, c.word), c.word);
  }
});

test("카드 낱말은 모두 4개 언어 이름이 있고, 큰 감정이 아닌 낱말은 뜻풀이가 있다", () => {
  for (const c of CARD_WORDS) {
    for (const l of ["en", "zh", "vi", "ja"] as const) assert.notEqual(w(l, c.word), c.word, `${c.word} ${l}`);
    if (c.word !== c.parent) assert.ok(MEANING[c.word], `${c.word} 뜻풀이`);
  }
});

test("한 번 뽑으면 12장: 긍정 4 · 보통 4 · 부정 4, 겹치지 않고 한 큰 감정이 몰리지 않는다", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const cards = drawCards(4, rand);
    assert.equal(cards.length, 12);
    assert.equal(new Set(cards).size, 12);
    for (const p of ["pos", "mid", "neg"]) assert.equal(cards.filter((x) => POLARITY[parentEmotion(x)] === p).length, 4);
    const per = new Map<string, number>();
    for (const x of cards) per.set(parentEmotion(x), (per.get(parentEmotion(x)) ?? 0) + 1);
    for (const [parent, n] of per) assert.ok(n <= (POLARITY[parent] === "mid" ? 3 : 2), parent);
    cards.forEach((x) => seen.add(x));
  }
  assert.equal(seen.size, 72); // 여러 번 뽑으면 모든 카드가 나온다
});
