// 저장소 옮기기·속도 재기·점검. 실제 배포에서는 운영 선생님으로 들어와야 API가 열린다(아니면 404).
import type { Metadata } from "next";
import AdminDb from "./AdminDb";

export const metadata: Metadata = { title: "저장소 옮기기 · 마음빛 길잡이", robots: { index: false } };

export default function Page() {
  return <AdminDb />;
}
