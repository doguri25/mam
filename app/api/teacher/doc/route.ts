// 교과서·학습지 올리기: 업스테이지 Document Parse로 글을 뽑고, AI가 감정 단어·활동을 정리해 돌려준다(저장은 선생님이 고른 뒤)
import { NextResponse, type NextRequest } from "next/server";
import { extractLesson } from "@/lib/ai";
import { DEMO_COOKIE, TEACHER_COOKIE, isTeacher } from "@/lib/auth";
import { aiConfig, getPin, rawKey } from "@/lib/data";
import { inSpace } from "@/lib/db";
import { parseDocument } from "@/lib/upstage";

export const maxDuration = 60;
const MAX = 4 * 1024 * 1024; // Vercel 요청 크기 한도(4.5MB) 안쪽
const OK = /\.(pdf|png|jpe?g|webp|heic|bmp|tiff?|hwp|hwpx|docx?|pptx?)$/i;
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  const run = () => handle(req);
  return req.cookies.get(DEMO_COOKIE)?.value === "1" ? inSpace("demo", run) : run();
}

async function handle(req: NextRequest) {
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
    const { markdown, pages } = await parseDocument(upKey, file, file.name);
    if (markdown.trim().length < 10) return bad("파일에서 글자를 거의 찾지 못했어요. 더 또렷한 파일로 올려 주세요.");
    const lesson = await extractLesson(ai, markdown);
    return NextResponse.json({ ...lesson, pages, chars: markdown.length, preview: markdown.slice(0, 400) });
  } catch (e) {
    return bad(`읽지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
  }
}
