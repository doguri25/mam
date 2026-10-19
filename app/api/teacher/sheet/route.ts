// 활동지 피드백: 화면이 스캔 PDF를 쪽 그림(JPEG)으로 나눠 학생 한 명씩 보낸다 → AI 피드백 → 그 회차에 쌓아 저장(그림은 저장하지 않음)
// 업스테이지 Solar는 그림을 못 보므로 Document Parse(OCR 강제 + enhanced: 손글씨·그림 설명)로 먼저 글로 바꾼다.
import { NextResponse, type NextRequest } from "next/server";
import { sheetFeedback } from "@/lib/ai";
import { DEMO_COOKIE, TEACHER_COOKIE, isTeacher } from "@/lib/auth";
import { aiConfig, getPin } from "@/lib/data";
import { db, inSpace } from "@/lib/db";
import { parseDocument } from "@/lib/upstage";
import type { SheetItem, SheetRun } from "@/lib/shared";

export const maxDuration = 60;
const MAX = 4 * 1024 * 1024; // Vercel 요청 크기 한도(4.5MB) 안쪽
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function POST(req: NextRequest) {
  const run = () => handle(req);
  return req.cookies.get(DEMO_COOKIE)?.value === "1" ? inSpace("demo", run) : run();
}

async function handle(req: NextRequest) {
  if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);
  const form = await req.formData().catch(() => null);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "{}"));
  } catch {
    return bad("요청이 올바르지 않아요.");
  }
  const files = (form?.getAll("page") ?? []).filter((f): f is File => f instanceof File && f.type === "image/jpeg");
  const r = (meta.run ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? "");
  const no = Number(meta.no);
  const pages = Array.isArray(meta.pages) ? meta.pages.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 4) : [];
  if (!/^[\w-]{6,40}$/.test(id) || !Number.isInteger(no) || no < 1 || no > 99) return bad("요청이 올바르지 않아요.");
  if (!files.length || files.length > 4 || files.length !== pages.length) return bad("활동지 쪽 그림이 없어요.");
  if (files.reduce((n, f) => n + f.size, 0) > MAX) return bad("쪽 그림이 너무 커요. 한 학생 쪽 수를 줄여 주세요.");

  const ai = await aiConfig();
  if (!ai) return bad("「설정」에서 AI 키를 넣어 주세요.");
  const input = { topic: text(r.topic, 60), content: text(r.content, 600), criteria: text(r.criteria, 600) };

  let item: SheetItem;
  try {
    let parsed: string | undefined;
    if (ai.provider === "upstage") {
      const docs = await Promise.all(files.map((f, i) => parseDocument(ai.key, f, `page${i + 1}.jpg`, { ocr: "force", mode: "enhanced" })));
      parsed = docs.map((d, i) => (docs.length > 1 ? `[${i + 1}쪽]\n` : "") + d.markdown).join("\n\n") || "(읽은 글이 없음)";
    }
    const images = parsed ? [] : await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()).toString("base64")));
    item = { no, pages, ...(await sheetFeedback(ai, { ...input, parsed }, images)) };
  } catch (e) {
    return bad(`읽지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
  }

  // 화면이 학생을 한 명씩 차례로 보내므로 읽고-고쳐-쓰기가 겹치지 않는다
  const old = await db().get<SheetRun>("sheets", id);
  const doc: SheetRun = old
    ? { ...old, items: [...old.items.filter((x) => x.no !== no), item].sort((a, b) => a.no - b.no) }
    : {
        id, ...input, file: text(r.file, 80), pagesPer: Math.min(4, Math.max(1, Number(r.pagesPer) || 1)),
        skip: Array.isArray(r.skip) ? r.skip.map(Number).filter(Number.isInteger).slice(0, 40) : [], createdAt: new Date().toISOString(), items: [item],
      };
  await db().set("sheets", id, { ...doc });
  return NextResponse.json({ item });
}
