"use client";
// 브라우저(태블릿) 「뒤로 가기」를 화면 안 단계와 잇는다.
// 학생 화면은 한 주소 안에서 단계가 바뀐다(마음 남기기: 고르기 → 감정 카드 → 더 꼭 맞는 말 → 마음 크기 → 까닭 → 되묻기 …).
// 단계가 하나 깊어질 때마다 같은 주소로 기록(history 항목)을 하나 쌓고, 뒤로 가기를 누르면 그 항목을 꺼내며 앞 단계로 돌린다.
// 화면 단추로 앞 단계로 돌아가면 쌓아 둔 항목을 조용히 걷어 내 둘이 어긋나지 않게 한다.
// 항목마다 「몇째 단계인지」(mbBack)를 적어 두어, 뒤로 가기로 도착한 곳이 어느 단계인지로 꺼낼 개수를 정한다.
import { useEffect, useRef } from "react";

interface Entry { onPop: () => void; path: string }
const stack: Entry[] = [];
let installed = false;
let pendingGo = 0;

const depthHere = () => (window.history.state as { mbBack?: unknown } | null)?.mbBack;

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", (e) => {
    const target = (e.state as { mbBack?: unknown } | null)?.mbBack;
    if (typeof target !== "number") return; // 우리가 적지 않은 항목(다른 주소로 오가기)은 Next.js가 알아서
    // 앞으로 가기로 이미 걷어 낸 단계에 다시 왔거나, 새로 불러오기 전에 쌓였던 단계에 왔다: 화면을 되살릴 수 없으니
    // 지금 화면과 맞는 자리로 조용히 되돌린다(그대로 두면 뒤로 가기를 한두 번 눌러도 아무 일이 없다)
    if (target > stack.length && (!stack.length || stack[stack.length - 1].path === window.location.pathname)) {
      window.history.go(stack.length - target);
      return;
    }
    // 먼저 꺼내 둔 뒤 위에서부터 부른다(손잡이가 새로 쌓아도 다시 꺼내지 않게)
    for (const e of stack.splice(Math.max(0, target)).reverse()) e.onPop();
  });
}

function push(onPop: () => void): Entry {
  install();
  // 지금 항목에도 단계(=지금 쌓인 수)를 적어 둔다 → 끝까지 뒤로 오면 0. 새로 불러오기 전에 적힌 낡은 수는 바로잡는다.
  if (depthHere() !== stack.length) window.history.replaceState({ ...window.history.state, mbBack: stack.length }, "");
  const e: Entry = { onPop, path: window.location.pathname };
  stack.push(e);
  window.history.pushState({ mbBack: stack.length }, ""); // Next.js가 자기 정보를 덧붙여 같은 주소로 쌓는다
  return e;
}

// 화면 단추로 앞으로 돌아간 만큼 걷어 낸다. 지금 맨 위 단계에 있을 때만 실제로 뒤로 이동(다른 화면에 가 있으면 목록에서만 뺌)
function drop(entries: Entry[]) {
  const atTop = depthHere() === stack.length;
  let n = 0;
  for (const e of entries) {
    const i = stack.indexOf(e);
    if (i >= 0) { stack.splice(i, 1); n++; }
  }
  if (!atTop || !n) return;
  pendingGo += n;
  setTimeout(() => { // 한꺼번에 여러 단계를 걷을 때 한 번만 이동
    const k = pendingGo;
    pendingGo = 0;
    if (k) window.history.go(-k);
  }, 0);
}

// depth: 지금 몇 단계 들어와 있는지(0 = 처음 화면). back: 한 단계 앞으로 돌아가기.
// root: 이 화면 바깥 요소에 붙인 data-back-root 값. 화면이 정말 사라지면(숨김이 아니라) 쌓아 둔 단계를 목록에서 뺀다.
// (Next.js는 지나온 화면을 숨겨 두며 정리 함수를 부르는데, 그때는 요소가 문서에 그대로 남아 있다)
const alive = (root?: string) => !!root && !!document.querySelector(`[data-back-root="${root}"]`);
export function useBackSteps(depth: number, back: () => void, root?: string) {
  const mine = useRef<Entry[]>([]);
  const backRef = useRef(back);
  useEffect(() => { backRef.current = back; });
  useEffect(() => {
    while (mine.current.length < depth) {
      const e: Entry = push(() => {
        mine.current = mine.current.filter((x) => x !== e);
        backRef.current();
      });
      mine.current.push(e);
    }
    if (mine.current.length > depth) drop(mine.current.splice(depth));
  }, [depth]);
  useEffect(() => {
    return () => {
      setTimeout(() => {
        if (alive(root)) return;
        for (const e of mine.current) { const i = stack.indexOf(e); if (i >= 0) stack.splice(i, 1); }
        mine.current = [];
      }, 0);
    };
  }, [root]);
}

// 첫 화면에서 뒤로 가기를 눌러도 앱 밖으로 나가지 않게: 한 칸을 깔아 두고, 눌리면 알려 준 뒤 다시 깐다
export function useBackGuard(onBlocked: () => void, root?: string) {
  const cb = useRef(onBlocked);
  useEffect(() => { cb.current = onBlocked; });
  const mine = useRef<Entry | null>(null);
  useEffect(() => {
    const arm = () => { mine.current = push(() => { cb.current(); arm(); }); };
    if (!mine.current || !stack.includes(mine.current)) arm(); // 숨겼다 다시 보일 때는 이미 깔려 있음
    return () => {
      setTimeout(() => {
        if (alive(root) || !mine.current) return;
        const i = stack.indexOf(mine.current);
        if (i >= 0) stack.splice(i, 1);
        mine.current = null;
      }, 0);
    };
  }, [root]);
}

// 학생 화면(/me)에서 작은 화면(달력·쪽지·꾸미기…)으로 갔다가 「← 돌아가기」를 누르면, 새 /me 항목을 쌓지 않고 실제로 뒤로 간다.
// 새로 쌓으면 그 뒤 브라우저 뒤로 가기가 작은 화면으로 되돌아가거나 한두 번 먹통이 된다.
let fromMe = false;
export const leftMe = () => { fromMe = true; };
export const atMe = () => { fromMe = false; };
// 이 작은 화면이 스스로 쌓은 단계 수(마음 점검의 문장들처럼): 맨 위에서부터 이 주소로 쌓인 항목
function stepsHere() {
  const here = window.location.pathname;
  const at = depthHere();
  let top = typeof at === "number" ? Math.min(at, stack.length) : stack.length;
  let n = 0;
  while (top > 0 && stack[top - 1].path === here) { top--; n++; }
  return n;
}
// 이 화면의 단계들까지 한 번에 건너 /me로(하나만 뒤로 가면 마음 점검 중에는 앞 문장으로만 돌아간다)
const leave = () => window.history.go(-(1 + stepsHere()));
export function backToMe(e: { preventDefault: () => void }) {
  if (!fromMe) return; // 주소로 바로 들어왔거나 새로 불러왔으면 보통 링크처럼 /me로
  fromMe = false;
  e.preventDefault();
  leave();
}
// 링크가 아닌 곳에서 /me로 돌아갈 때(저장한 뒤 등)
export function returnToMe(push: () => void) {
  if (!fromMe) return push();
  fromMe = false;
  leave();
}
