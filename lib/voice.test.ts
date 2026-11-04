// 말 빠르기: 받아쓴 말을 언어와 상관없이 소리 마디(음절)로 센다
import assert from "node:assert/strict";
import { test } from "node:test";
import { speechSyllables } from "./voice.ts";

test("한국어는 한 글자가 한 마디(예전과 같은 눈금)", () => {
  assert.equal(speechSyllables("안녕하세요"), 5);
  assert.equal(speechSyllables("오늘 친구랑 놀았어요!"), 9);
  assert.equal(speechSyllables("3학년"), 3);
});

test("중국어·일본어는 0이 아니라 글자로 센다", () => {
  assert.equal(speechSyllables("我今天很开心。"), 6);
  assert.equal(speechSyllables("こんにちは"), 4); // ん은 앞 소리에 붙임
  assert.equal(speechSyllables("きょうは たのしかった"), 8); // ょ·っ은 세지 않음
  assert.equal(speechSyllables("今日は楽しい"), 6); // 한자도 한 글자에 한 마디로 어림
});

test("영어·베트남어는 알파벳 수가 아니라 음절로", () => {
  assert.equal(speechSyllables("I like my school"), 4);
  assert.equal(speechSyllables("Today was happy"), 5);
  assert.equal(speechSyllables("Hôm nay em rất vui"), 5);
  assert.equal(speechSyllables("Xin chào các bạn, người bạn của tôi"), 8);
});

test("같은 말을 다른 언어로 해도 빠르기 눈금이 비슷하다", () => {
  const ko = speechSyllables("나는 오늘 기분이 좋아요"); // 9
  for (const s of ["我今天心情很好", "Hôm nay em thấy rất vui", "I feel really good today"]) {
    const n = speechSyllables(s);
    assert.ok(n >= ko / 2 && n <= ko * 1.5, `${s}: ${n} vs ${ko}`);
  }
  assert.equal(speechSyllables(""), 0);
  assert.equal(speechSyllables("…?!"), 0);
});
