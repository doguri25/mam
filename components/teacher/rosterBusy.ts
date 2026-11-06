// 명단을 통째로 바꾸는 일(연습 데이터 만들기·지우기·모두 지우기)이 서버에서 도는 동안을 화면 전체에 알린다.
// 그사이 「명단 저장」을 누르면 칸에 남은 예전 명단(연습 학생)이 실제 학생으로 저장될 수 있어 그동안은 막는다.
// (서버도 명단 저장 때 칸이 바탕으로 삼은 명단과 지금 명단이 다르면 409로 막는다 — 다른 기기에서 바꾼 경우까지)
import { useSyncExternalStore } from "react";

let running = 0;
const subs = new Set<() => void>();
const tell = () => subs.forEach((f) => f());

export async function whileRosterChanges<T>(work: () => Promise<T>): Promise<T> {
  running++;
  tell();
  try {
    return await work();
  } finally {
    running--;
    tell();
  }
}

export const useRosterChanging = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => running > 0,
    () => false,
  );
