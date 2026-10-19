// 심사용 체험: 비밀번호 없이 체험 공간(가짜 반)으로 들어가고 나온다. 실제 학급 데이터와는 저장 공간부터 따로다.
// 체험 선생님 표에는 공간 demo가 적혀 있고, 체험 학생은 코드로 체험 공간을 찾는다.
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, STUDENT_COOKIE, TEACHER_COOKIE, TEACHER_HOURS, teacherToken } from "@/lib/auth";
import { getRoster, seedPractice } from "@/lib/data";
import { today } from "@/lib/date";
import { db, inSpace } from "@/lib/db";

const secure = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  // 화면은 늘 JSON으로 보낸다. 다른 사이트의 form으로 몰래 로그인시켜 엉뚱한 학급에 쓰게 하는 것(로그인 CSRF)을 막는다.
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "요청이 올바르지 않아요." }, { status: 415 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "end") {
    const res = NextResponse.json({ ok: true });
    for (const c of [DEMO_COOKIE, TEACHER_COOKIE, STUDENT_COOKIE]) res.cookies.delete(c);
    return res;
  }
  try {
    return await inSpace("demo", async () => {
      // 날짜가 지나면 처음 판으로(가짜 기록이 늘 「최근 7일」이 되게). 여러 사람이 함께 쓰는 공간이다.
      const day = await db().get<{ date: string }>("meta", "practiceDay");
      if (day?.date !== today() || body.action === "reset") await seedPractice();
      const students = (await getRoster()).slice(0, 8).map((s) => ({ no: s.no, alias: s.alias, code: s.code }));
      const res = NextResponse.json({ students });
      res.cookies.delete(DEMO_COOKIE); // 예전 체험 표시는 더 쓰지 않음
      res.cookies.set(TEACHER_COOKIE, teacherToken(0), { httpOnly: true, sameSite: "strict", secure, maxAge: TEACHER_HOURS * 3600, path: "/" });
      res.cookies.delete(STUDENT_COOKIE); // 이 기기에 남아 있던 실제 학급 학생은 나가게
      return res;
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "체험 반을 준비하지 못했어요. 잠시 뒤 다시 해 주세요." }, { status: 500 });
  }
}
