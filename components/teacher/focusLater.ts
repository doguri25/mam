"use client";
// 폼·창을 닫은 뒤 다시 그려진 화면의 단추로 초점을 돌려준다. 요청·다시 읽기 뒤 React가 언제 그릴지 몰라 몇 판(프레임) 기다린다.
// from: 닫는 폼(아직 화면에 있으면 기다린다). 그사이 선생님이 다른 곳으로 초점을 옮겼으면(본문·닫는 폼이 아니면) 건드리지 않는다.
// pick(last): 초점 줄 곳. 아직 없으면 null(다음 판에 다시) — last는 마지막 판(그때는 있는 것으로 정한다)
export function focusLater(pick: (last: boolean) => HTMLElement | null | undefined, from: Element | null = null, frames = 30) {
  let n = 0;
  const step = () => {
    n++;
    const a = document.activeElement;
    const lost = !a || a === document.body || !a.isConnected || (!!from && from.contains(a));
    if (!lost) return;
    const el = pick(n >= frames);
    if (el && el.isConnected && !(from?.isConnected && from.contains(el))) {
      el.focus();
      return;
    }
    if (n < frames) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// 지금 초점이 든 조치 폼(닫을 때 넘긴다)
export const openForm = () => document.activeElement?.closest("[data-riskform]") ?? null;
