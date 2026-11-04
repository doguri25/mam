// 교과서·학습지 올리기: 업스테이지 Document Parse로 글을 뽑고, AI가 감정 단어·활동을 정리해 돌려준다(저장은 선생님이 고른 뒤)
import { NextResponse, type NextRequest } from "next/server";
import { docError, extractLesson, inTime } from "@/lib/ai";
import { TEACHER_COOKIE, isTeacher, teacherSpace } from "@/lib/auth";
import { aiConfig, getPin, rawKey } from "@/lib/data";
import { inSpace } from "@/lib/db";
import { parseDocument } from "@/lib/upstage";

// 문서 읽기(업스테이지, 최대 55초) + AI 정리(최대 40초, 한 번 다시)가 60초를 넘을 수 있다.
// Vercel Hobby는 Fluid compute(2025-04-23 뒤 만든 프로젝트는 기본으로 켜짐)에서 함수 시간을 300초까지 쓸 수 있어 120초로 잡고,
// 그보다 15초 먼저 멈춰 한국어로 답한다(Vercel이 끊으면 화면에는 알아보기 어려운 오류만 감).
export const maxDuration = 120;
const BUDGET_MS = (maxDuration - 15) * 1000;
const LATE = "파일을 읽는 데 시간이 너무 오래 걸렸어요. 필요한 쪽만 잘라 올리거나 잠시 뒤 다시 해 주세요.";
const MAX = 4 * 1024 * 1024; // Vercel 요청 크기 한도(4.5MB) 안쪽
const OK = /\.(pdf|png|jpe?g|webp|heic|bmp|tiff?|hwp|hwpx|docx?|pptx?)$/i;
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  return inSpace(teacherSpace(req.cookies.get(TEACHER_COOKIE)?.value), () => handle(req)); // 표에 적힌 학급 공간에서
}

async function handle(req: NextRequest) {
  const deadline = AbortSignal.timeout(BUDGET_MS);
  if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad("파일을 골라 주세요.");
  if (!OK.test(file.name)) return bad("PDF·사진(JPG·PNG)·HWP·DOCX·PPTX 파일을 올려 주세요.");
  if (file.size > MAX) return bad("4MB보다 작은 파일로 올려 주세요. 필요한 쪽만 잘라서 올리면 좋아요.");

  const upKey = await rawKey("upstage"); // 체험 공간이면 실제 반의 키를 하루 제한 안에서 빌려 씀
  if (!upKey) return bad("교과서 읽기는 업스테이지 Document Parse를 써요. 「설정」에서 업스테이지 키를 넣어 주세요.");
  const ai = (await aiConfig()) ?? (await aiConfig("upstage"));
  if (!ai) return bad("AI 키가 필요해요.");

  try {
    const { markdown, pages } = await inTime(parseDocument(upKey, file, file.name), deadline);
    if (markdown.trim().length < 10) return bad("파일에서 글자를 거의 찾지 못했어요. 더 또렷한 파일로 올려 주세요.");
    const lesson = await extractLesson(ai, markdown, deadline);
    return NextResponse.json({ ...lesson, pages, chars: markdown.length, preview: markdown.slice(0, 400) });
  } catch (e) {
    if (!deadline.aborted) console.error("교과서 읽기 실패", e);
    return bad(docError(e, deadline.aborted, LATE), deadline.aborted ? 504 : 502);
  }
}
