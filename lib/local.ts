"use client";
// 이 기기에만 남기는 값(localStorage): 학생 「읽어 주기」 켜기, 교사의 실명 명렬표.
// 실명은 서버·AI로 보내지 않는다.
import { useSyncExternalStore } from "react";
import { langOf, type Lang } from "./i18n.ts";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  window.addEventListener("storage", f);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", f);
  };
};
function read(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // 사생활 보호 모드 등에서는 저장하지 못해도 화면은 그대로 쓴다
  }
  emit();
}

export function useLocal(key: string): [string, (v: string) => void] {
  const v = useSyncExternalStore(subscribe, () => read(key), () => "");
  return [v, (next: string) => write(key, next)];
}

// 읽어 주기: 켜져 있을 때만 말한다(🔊 버튼은 force로 늘 말함)
export function speak(text: string, force = false, lang: Lang = "ko") {
  if ((!force && read("mb_read") !== "1") || typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langOf(lang).speech;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// 교사 실명: 「번호 이름」 줄들을 이 기기에만
export function parseNames(text: string) {
  const out: Record<number, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s*[,.\t ]\s*(.{1,20})$/);
    if (m) out[Number(m[1])] = m[2].trim();
  }
  return out;
}

// 학급(공간)마다 따로: 한 기기를 여러 선생님이 써도 다른 반 실명이 섞이지 않게. 홍북초 반은 예전 열쇠 그대로.
export function useNames(space = "") {
  const [raw, setRaw] = useLocal(space ? `mb_names_${space}` : "mb_names");
  const [show, setShow] = useLocal("mb_show_names");
  const names = parseNames(raw);
  const on = show === "1" && Object.keys(names).length > 0;
  return {
    raw,
    setRaw,
    on,
    setOn: (v: boolean) => setShow(v ? "1" : ""),
    // 화면에 보일 이름: 실명 보기가 켜져 있으면 실명, 아니면 가명
    name: (no: number, alias: string) => (on && names[no] ? names[no] : alias),
  };
}
