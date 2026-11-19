"use client";
// 창(aria-modal)이 열려 있는 동안 Tab·Shift+Tab이 창 밖(가려진 뒤 화면)으로 나가지 않게 창 안에서 돈다.
// 창이 겹치면(지도 기록 창 위에 AI 도우미 창) 위 창이 먼저 받는다: 위 창은 capture로 먼저 처리하고 defaultPrevented로 알린다.
import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

export function useTrap(ref: RefObject<HTMLElement | null>, active: boolean, opt: { top?: boolean } = {}) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current;
      if (e.key !== "Tab" || e.defaultPrevented || !box) return;
      const now = document.activeElement as HTMLElement | null;
      // 초점이 다른(더 위) 창 안에 있으면 그 창이 맡는다
      const other = now?.closest('[aria-modal="true"]');
      if (other && other !== box && !box.contains(other) && !other.contains(box)) return;
      // 보이고 Tab으로 갈 수 있는 것만(tabindex=-1 덮개 단추·숨긴 것은 빼고)
      const els = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.tabIndex >= 0 && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== "hidden");
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const inside = !!now && box.contains(now);
      if (!inside || (e.shiftKey ? now === first : now === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey, opt.top ?? false);
    return () => window.removeEventListener("keydown", onKey, opt.top ?? false);
  }, [ref, active, opt.top]);
}
