"use client";
// 예전 이름 그대로 두는 입구: 마음 친구는 이제 WebGL 없이 SVG로 그리므로 어느 기기에서나 같은 모습이다.
import Buddy, { type BuddyProps } from "./Buddy";

export default function BuddyLazy(props: BuddyProps) {
  return <Buddy {...props} />;
}
