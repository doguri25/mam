import type { Metadata } from "next";

// 선생님 화면만 앱(PWA)으로 설치되게: 이 경로에만 매니페스트를 붙인다(학생 화면은 그냥 웹)
export const metadata: Metadata = {
  title: "마음빛 길잡이 · 선생님",
  manifest: "/teacher.webmanifest",
  appleWebApp: { capable: true, title: "마음빛 선생님", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-180.png" },
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
