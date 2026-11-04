// 감정 단어 놀이·사전: 뜻풀이는 학생 언어로, 보기는 헷갈리지 않게
import assert from "node:assert/strict";
import { test } from "node:test";
import { MEANING, MEANING_TR, SITUATIONS, makeRound, meaningOf } from "./game.ts";
import { w } from "./i18n.ts";
import { CARD_WORDS, NUANCE } from "./shared.ts";

const LANGS = ["en", "zh", "vi", "ja"] as const;

test("뜻풀이는 다섯 언어 모두 있고, 한국어 뜻풀이와 같은 낱말을 다룬다", () => {
  assert.deepEqual(Object.keys(MEANING_TR).sort(), Object.keys(MEANING).sort());
  for (const [word, ko] of Object.entries(MEANING)) {
    for (const l of LANGS) {
      const s = MEANING_TR[word][l];
      assert.ok(s && s.trim() === s, `${word} ${l}`);
      assert.ok(!/[가-힣]/.test(s), `${word} ${l}: 한국어가 섞임`);
      assert.ok(s.length <= ko.length * 2.6, `${word} ${l}: 너무 김(${s})`);
    }
  }
});

test("한 언어 안에서 서로 다른 낱말의 뜻풀이가 겹치지 않는다", () => {
  for (const l of LANGS) {
    const all = Object.values(MEANING_TR).map((t) => t[l]);
    assert.equal(new Set(all).size, all.length, l);
  }
});

// 사전·카드에서 두 낱말이 같은 이름으로 보이면 아이가 구별하지 못한다.
// 번역 이름은 lib/i18n.ts(WORDS)에 있어 여기서는 찾기만 한다 — 고치면 todo를 뗀다.
test("카드 낱말의 번역 이름이 한 언어 안에서 겹치지 않는다", { todo: "lib/i18n.ts WORDS에서 고칠 것" }, () => {
  const dups: string[] = [];
  for (const l of LANGS) {
    const seen = new Map<string, string>();
    for (const { word } of CARD_WORDS) {
      const label = w(l, word).toLowerCase();
      if (seen.has(label)) dups.push(`${l} 「${label}」: ${seen.get(label)} · ${word}`);
      else seen.set(label, word);
    }
  }
  assert.deepEqual(dups, []);
});

test("학생 언어로 뜻풀이를 고르고, 한국어 학생은 한국어 그대로", () => {
  assert.equal(meaningOf("ko", "뿌듯해요"), MEANING["뿌듯해요"]);
  assert.equal(meaningOf("en", "뿌듯해요"), MEANING_TR["뿌듯해요"].en);
  assert.equal(meaningOf("ja", "졸려요"), MEANING_TR["졸려요"].ja);
  assert.equal(meaningOf("vi", "교과서에서 더한 말"), "");
  assert.equal(meaningOf("ko", "교과서에서 더한 말"), "");
});

test("놀이 보기: 정답과 같은 무리 말은 내지 않고, 「보통」 카드 낱말끼리도 서로 보기로 내지 않는다", () => {
  const MID = [...NUANCE["피곤해요"], ...NUANCE["그저 그래요"]];
  const SAD = [...NUANCE["피곤해요"], ...NUANCE["슬퍼요"], ...NUANCE["속상해요"]];
  for (let seed = 1; seed < 400; seed++) {
    for (const q of makeRound(SITUATIONS.map((s) => s.answer).slice(seed % 15, (seed % 15) + 2), seed)) {
      assert.equal(q.options.length, 3);
      assert.equal(new Set(q.options).size, 3);
      assert.ok(q.options.includes(q.answer));
      const others = q.options.filter((o) => o !== q.answer);
      if (MID.includes(q.answer)) assert.ok(others.every((o) => !MID.includes(o)), `${q.answer}: ${others}`);
      if (SAD.includes(q.answer)) assert.ok(others.every((o) => !SAD.includes(o)), `${q.answer}: ${others}`);
    }
  }
});
