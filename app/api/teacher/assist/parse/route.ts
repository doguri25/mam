// 자료함에 올릴 파일에서 글만 뽑기(HWP·HWPX·DOCX·PPTX·XLSX·글이 없는 PDF·사진): 업스테이지 Document Parse.
// 글이 든 PDF와 TXT·MD·CSV는 선생님 기기에서 바로 읽으므로 여기로 오지 않는다. 파일은 저장하지 않는다(뽑은 글은 선생님이 「저장」을 눌러야 남음).
import { NextResponse, type NextRequest } from "next/server";
import { docError, inTime } from "@/lib/ai";
import { TEACHER_COOKIE, isTeacher, teacherSpace } from "@/lib/auth";
import { getPin, rawKey } from "@/lib/data";
import { inSpace, isDemo } from "@/lib/db";
import { parseDocument } from "@/lib/upstage";

export const maxDuration = 120;
const BUDGET_MS = (maxDuration - 15) * 1000;
const LATE = "파일을 읽는 데 시간이 너무 오래 걸렸어요. 필요한 쪽만 잘라 올리거나 잠시 뒤 다시 해 주세요.";
const MAX = 4 * 1024 * 1024;
const OK = /\.(pdf|png|jpe?g|webp|hwp|hwpx|docx?|pptx?|xlsx?)$/i;
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  return inSpace(teacherSpace(req.cookies.get(TEACHER_COOKIE)?.value), () => handle(req));
}

async function handle(req: NextRequest) {
  const deadline = AbortSignal.timeout(BUDGET_MS);
  if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);
  if (isDemo()) return bad("체험 반은 여러 사람이 함께 보는 곳이라 자료를 올릴 수 없어요.", 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad("파일을 골라 주세요.");
  if (!OK.test(file.name)) return bad("PDF·HWP·HWPX·DOCX·PPTX·XLSX·사진 파일을 올려 주세요.");
  if (file.size > MAX) return bad("4MB보다 작은 파일로 올려 주세요. 필요한 쪽만 잘라서 올리면 좋아요.");
  const key = await rawKey("upstage");
  if (!key) return bad("이 파일은 업스테이지 Document Parse로 읽어요. 「설정」에서 업스테이지 키를 넣거나, PDF로 저장해서 올려 주세요.");
  try {
    const { markdown, pages } = await inTime(parseDocument(key, file, file.name, { signal: deadline }), deadline);
    if (markdown.trim().length < 20) return bad("파일에서 글자를 거의 찾지 못했어요.");
    return NextResponse.json({ text: markdown, pages });
  } catch (e) {
    if (!deadline.aborted) console.error("자료함 파일 읽기 실패", e);
    return bad(docError(e, deadline.aborted, LATE), deadline.aborted ? 504 : 502);
  }
}
