// 학급 역량 진단 서면 검사지 읽기(AI): 기기가 확신하지 못한 문장의 체크 칸과, 빈 검사지에 학생이 손으로 쓴 번호만 묻는다.
// 화면이 한 학생의 검사지 쪽 그림(JPEG, 많아야 4쪽)과 읽을 문장 번호를 보낸다. 그림은 저장하지 않는다.
// 업스테이지 Solar는 그림을 못 보므로 Document Parse(OCR 강제 + enhanced)로 글로 바꿔 읽는다(체크 표시를 놓칠 수 있어 화면에 알림).
import { NextResponse, type NextRequest } from "next/server";
import { docError, inTime, readPaper } from "@/lib/ai";
import { TEACHER_COOKIE, isTeacher, teacherSpace } from "@/lib/auth";
import { aiConfig, getPin } from "@/lib/data";
import { inSpace } from "@/lib/db";
import { SELF_ITEMS } from "@/lib/selfcheck";
import { parseDocument } from "@/lib/upstage";

export const maxDuration = 120;
const BUDGET_MS = (maxDuration - 15) * 1000;
const LATE = "검사지를 읽는 데 시간이 너무 오래 걸렸어요. 한 번 더 눌러 주세요.";
const MAX = 4 * 1024 * 1024;
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  return inSpace(teacherSpace(req.cookies.get(TEACHER_COOKIE)?.value), () => handle(req));
}

async function handle(req: NextRequest) {
  const deadline = AbortSignal.timeout(BUDGET_MS);
  if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);
  const form = await req.formData().catch(() => null);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "{}"));
  } catch {
    return bad("요청이 올바르지 않아요.");
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return bad("요청이 올바르지 않아요.");
  const files = (form?.getAll("page") ?? []).filter((f): f is File => f instanceof File && f.type === "image/jpeg");
  const items = Array.isArray(meta.items) ? [...new Set(meta.items.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= SELF_ITEMS.length))] : [];
  const number = meta.number === true;
  if (!files.length || files.length > 4) return bad("검사지 쪽 그림이 없어요.");
  if (files.reduce((n, f) => n + f.size, 0) > MAX) return bad("쪽 그림이 너무 커요.");
  if (!items.length && !number) return bad("읽을 것이 없어요.");

  const ai = await aiConfig();
  if (!ai) return bad("「설정」에서 AI 키를 넣어 주세요. 키가 없으면 확인 표에서 직접 골라 주세요.");
  const ask = { 읽을문장: items.map((n) => ({ 번호: n, 글: SELF_ITEMS[n - 1].ko })), 번호도: number };
  try {
    let parsed: string | undefined;
    if (ai.provider === "upstage") {
      const docs = await inTime(Promise.all(files.map((f, i) => parseDocument(ai.key, f, `page${i + 1}.jpg`, { ocr: "force", mode: "enhanced", signal: deadline }))), deadline);
      parsed = docs.map((d, i) => `[${i + 1}쪽]\n${d.markdown}`).join("\n\n") || "(읽은 글이 없음)";
    }
    const images = parsed ? [] : await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()).toString("base64")));
    const out = await readPaper(ai, ask, images, parsed, deadline);
    return NextResponse.json({ ...out, viaText: !!parsed });
  } catch (e) {
    if (!deadline.aborted) console.error("서면 검사지 읽기 실패", e);
    return bad(docError(e, deadline.aborted, LATE), deadline.aborted ? 504 : 502);
  }
}
