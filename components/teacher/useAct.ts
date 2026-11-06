"use client";
// 서버에 쓰는 단추 하나(또는 한 묶음): 누른 일이 끝날 때까지 다시 받지 않고(두 번 눌러 두 번 저장되지 않게 — 상태가 그려지기 전의
// 두 번째 누름도 ref로 막는다), 실패하면(와이파이 끊김·체험 반 횟수 제한·잠김) 그 까닭을 err로 돌려 단추 가까이에 보이게 한다.
// run(fail, fn, ask): fail은 실패했을 때 앞에 붙일 말(「메모를 저장하지 못했어요」), ask가 있으면 먼저 묻는다(바쁜 동안은 묻지도 않음).
import { useCallback, useRef, useState } from "react";

export function useAct() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = useCallback(async (fail: string, fn: () => Promise<unknown>, ask?: string): Promise<boolean> => {
    if (lock.current) return false;
    if (ask && !confirm(ask)) return false;
    lock.current = true;
    setBusy(true);
    setErr("");
    try {
      await fn();
      return true;
    } catch (e) {
      const why = (e as Error).message.trim();
      setErr(why ? `${fail}: ${why}` : `${fail}.`);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, err, setErr, run };
}
