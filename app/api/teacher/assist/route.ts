// 선생님 도우미(AI 챗봇): 물음에 맞춰 학생 기록·할 일·자료·위기 대응 안내를 모아 AI에 묻는다.
// 학생은 번호·가명으로만 보낸다(실명은 선생님 기기에만 있고, 화면이 보내기 전에 번호로 바꾼다).
// 면담 메모·위험 표현 조치 기록도 물은 학생 것만 보낸다(선생님이 고른 방식). 역량 진단의 선생님 메모는 보내지 않는다.
// 대화는 학급 저장소에 남기고 마지막으로 쓴 날부터 30일 지나면 지운다. 체험 반(여럿이 함께 씀)에는 남기지 않는다.
import { NextResponse, type NextRequest } from "next/server";
import { assistReply, inTime } from "@/lib/ai";
import { TEACHER_COOKIE, isTeacher, teacherSpace } from "@/lib/auth";
import { aiConfig, getPin, getRiskActions, getRiskDrafts, getRoster, getSelNotes, getSelfAnswers, getSelfRounds, getSettings, recordsFrom, recordsOf, riskyRecords, withOpenRisks } from "@/lib/data";
import { addDays, today } from "@/lib/date";
import { db, inSpace, isDemo } from "@/lib/db";
import { clientIp, trialEditWait, waitText } from "@/lib/limit";
import { riskAlerts } from "@/components/teacher/alerts";
import { watchFlags } from "@/lib/rules";
import { cutoffOf } from "@/lib/retention";
import { searchKb } from "@/lib/kb";
import { CRISIS, crisisOf, crisisText, type CrisisId } from "@/lib/crisis";
import { DOMAINS, levelOf, obsMax, obsScores, scoresOf, cleanSelfAnswers } from "@/lib/selfcheck";
import {
  ASK_MAX, CHAT_DAYS, CHAT_MAX, DOC_CHARS, DOC_KINDS, DOC_MAX, DOC_TOTAL, GO_TABS, MSG_MAX, TODO_MAX,
  cleanAssist, cleanContacts, cleanDocText, cleanDue, cleanTitle, isClassWide, meansThis, mentionedNos, saysTodo, searchDocs, sortTodos, threadTitle, wantsTodo,
  type AppTodo, type ChatMsg, type ChatThread, type Contact, type DocKind, type DocMeta, type Todo,
} from "@/lib/assist";
import { RISK_ACTION_KO, ownBy, type Cheer, type Letter, type MoodRecord, type Note, type Reflect, type Student } from "@/lib/shared";

export const maxDuration = 60;
const BUDGET_MS = (maxDuration - 8) * 1000;
const bad = (message: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error: message, ...extra }, { status });
const TODOS = "assistTodos", CONTACTS = "assistContacts", DOCS = "assistDocs";
const docId = (id: string) => `assistDoc_${id}`;
const chatId = (id: string) => `chat_${id}`;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const clip = (s: unknown, n: number) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
// 체험 반에서 함께 쓰는 것을 바꾸는 일(10분 제한) · 막는 일(여럿이 보는 공간에 문서를 올리지 않게)
const TRIAL_WRITES = new Set(["todoAdd", "todoEdit", "todoDelete", "contactsSave"]);
const DEMO_BLOCKED = new Set(["docSave", "docDelete"]);

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return bad("요청이 올바르지 않아요.", 415);
  return inSpace(teacherSpace(req.cookies.get(TEACHER_COOKIE)?.value), () => handle(req));
}

async function handle(req: NextRequest) {
  if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("요청이 올바르지 않아요.");
  const act = String(body.action ?? "");
  if (isDemo() && DEMO_BLOCKED.has(act)) return bad("체험 반은 여러 사람이 함께 보는 곳이라 자료를 올리거나 지울 수 없어요.", 403);
  if (isDemo() && TRIAL_WRITES.has(act)) {
    const wait = await trialEditWait(clientIp(req.headers));
    if (wait) return bad(`체험 반에서는 잠시 뒤에 다시 해 주세요(${waitText(wait)}).`, 429);
  }
  try {
    if (act === "ask") return await ask(body);
    if (act === "threads") return NextResponse.json({ threads: (await liveThreads()).map(({ id, title, updatedAt, msgs }) => ({ id, title, updatedAt, count: msgs.length })), saved: !isDemo() });
    if (act === "thread") {
      const t = await db().get<ChatThread>("meta", chatId(String(body.id ?? "")));
      return t ? NextResponse.json({ thread: t }) : bad("대화를 찾지 못했어요.", 404);
    }
    if (act === "threadDelete") {
      await db().del("meta", chatId(String(body.id ?? "")));
      return NextResponse.json({ ok: true });
    }

    // ── 할 일 ──
    if (act === "todos") return NextResponse.json({ app: await appTodos(), mine: await myTodos(), today: today() });
    if (act === "todoAdd" || act === "todoEdit" || act === "todoDelete") {
      const out: { err?: string } = {};
      const doc = await db().update<{ items: Todo[] }>("meta", TODOS, (cur) => {
        const items = [...(cur?.items ?? [])];
        out.err = undefined;
        if (act === "todoAdd") {
          const title = cleanTitle(body.title);
          if (!title) { out.err = "할 일을 써 주세요."; return undefined; }
          if (items.filter((x) => !x.done).length >= TODO_MAX) { out.err = `할 일은 ${TODO_MAX}개까지 둘 수 있어요. 마친 일을 지워 주세요.`; return undefined; }
          items.push({ id: newId(), title, due: cleanDue(body.due), done: false, at: new Date().toISOString(), ...(body.from === "chat" ? { from: "chat" as const } : {}) });
        } else {
          const i = items.findIndex((x) => x.id === String(body.id ?? ""));
          if (i < 0) { out.err = "그 할 일을 찾지 못했어요."; return undefined; }
          if (act === "todoDelete") items.splice(i, 1);
          else items[i] = {
            ...items[i],
            ...(typeof body.done === "boolean" ? { done: body.done } : {}),
            ...(body.title !== undefined && cleanTitle(body.title) ? { title: cleanTitle(body.title) } : {}),
            ...(body.due !== undefined ? { due: cleanDue(body.due) } : {}),
          };
        }
        // 마친 일은 최근 50개만 남긴다
        const done = items.filter((x) => x.done).sort((a, b) => b.at.localeCompare(a.at)).slice(50).map((x) => x.id);
        return { items: items.filter((x) => !done.includes(x.id)) };
      });
      if (out.err) return bad(out.err);
      return NextResponse.json({ mine: sortTodos(doc?.items ?? []) });
    }

    // ── 학교 연락처 ──
    if (act === "contacts") return NextResponse.json({ items: await contacts() });
    if (act === "contactsSave") {
      const items = cleanContacts(body.items);
      await db().set("meta", CONTACTS, { items });
      return NextResponse.json({ items });
    }

    // ── 자료함 ──
    if (act === "docs") return NextResponse.json({ items: await docIndex(), max: DOC_MAX, total: DOC_TOTAL });
    if (act === "docSave") {
      const title = cleanTitle(body.title, 80), text = cleanDocText(body.text);
      const kind: DocKind = DOC_KINDS.includes(body.kind) ? body.kind : "기타";
      if (!title) return bad("자료 이름을 써 주세요.");
      if (text.length < 20) return bad("글자를 거의 찾지 못했어요. 글이 들어 있는 파일인지 확인해 주세요.");
      const items = await docIndex();
      if (items.length >= DOC_MAX) return bad(`자료는 ${DOC_MAX}개까지 둘 수 있어요. 안 쓰는 자료를 지워 주세요.`);
      const used = items.reduce((n, d) => n + d.chars, 0);
      if (used + text.length > DOC_TOTAL) return bad("자료함이 꽉 찼어요. 안 쓰는 자료를 지우거나 필요한 부분만 올려 주세요.");
      const meta: DocMeta = { id: newId(), title, kind, chars: text.length, at: new Date().toISOString() };
      await db().set("meta", docId(meta.id), { kind: "assistDoc", id: meta.id, text });
      const doc = await db().update<{ items: DocMeta[]; ver?: number }>("meta", DOCS, (cur) => ({ items: [...(cur?.items ?? []), meta], ver: (cur?.ver ?? 0) + 1 }));
      return NextResponse.json({ items: doc?.items ?? [], cut: String(body.text ?? "").length > DOC_CHARS });
    }
    if (act === "docDelete") {
      const id = String(body.id ?? "");
      await db().del("meta", docId(id));
      const doc = await db().update<{ items: DocMeta[]; ver?: number }>("meta", DOCS, (cur) => ({ items: (cur?.items ?? []).filter((d) => d.id !== id), ver: (cur?.ver ?? 0) + 1 }));
      return NextResponse.json({ items: doc?.items ?? [] });
    }
    return bad("알 수 없는 요청이에요.");
  } catch (e) {
    console.error("선생님 도우미 실패", e);
    return bad(e instanceof Error ? e.message.slice(0, 200) : "잠시 뒤 다시 해 주세요.", 500);
  }
}

const myTodos = async () => sortTodos((await db().get<{ items: Todo[] }>("meta", TODOS))?.items ?? []);
const contacts = async (): Promise<Contact[]> => (await db().get<{ items: Contact[] }>("meta", CONTACTS))?.items ?? [];
const docIndex = async (): Promise<DocMeta[]> => (await db().get<{ items: DocMeta[] }>("meta", DOCS))?.items ?? [];

// 자료함 글: 서버가 같은 판을 들고 있으면 다시 읽지 않는다(물음마다 글 전체를 읽지 않게)
const docCache = new Map<string, { meta: DocMeta; text: string }[]>();
async function docTexts() {
  const idx = await db().get<{ items: DocMeta[]; ver?: number }>("meta", DOCS);
  if (!idx?.items.length) return [];
  const key = `${db().prefix}:${idx.ver ?? 0}`;
  const hit = docCache.get(key);
  if (hit) return hit;
  const texts = await Promise.all(idx.items.map((m) => db().get<{ text: string }>("meta", docId(m.id))));
  const docs = idx.items.map((meta, i) => ({ meta, text: texts[i]?.text ?? "" })).filter((d) => d.text);
  if (docCache.size > 30) docCache.clear();
  docCache.set(key, docs);
  return docs;
}

// 남길 대화: 30일 지난 것과 너무 많은 것은 지운다
async function liveThreads(): Promise<ChatThread[]> {
  if (isDemo()) return [];
  const all = await db().find<ChatThread>("meta", "kind", "==", "chat");
  const old = Date.now() - CHAT_DAYS * 86_400_000;
  const sorted = all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const keep = sorted.filter((t) => Date.parse(t.updatedAt) >= old).slice(0, CHAT_MAX);
  const drop = sorted.filter((t) => !keep.includes(t));
  await Promise.all(drop.map((t) => db().del("meta", chatId(t.id))));
  return keep;
}

// ── 앱이 찾은 할 일(마음 지도·쪽지·역량 진단·보관 기간·주간 리포트·동의서) ──
async function appTodos(): Promise<AppTodo[]> {
  const date = today();
  const settings = await getSettings();
  const from = addDays(date, -34);
  const [students, recent, risky, reflects, riskyReflects, letters, drafts, rounds, answers, notes, weekly, expired] = await Promise.all([
    getRoster(), recordsFrom(from), riskyRecords(), db().find<Reflect>("reflects", "createdAt", ">=", `${addDays(date, -14)}`),
    db().find<Reflect>("reflects", "risk", "==", true), db().find<Letter>("letters", "status", "==", "wait"), getRiskDrafts(),
    getSelfRounds(), getSelfAnswers(), getSelNotes(), db().get<{ weekStart: string }>("meta", "weekly"),
    db().count("records", "date", "<", cutoffOf(settings.retention, date)),
  ]);
  const out: AppTodo[] = [];
  const alerts = riskAlerts({ records: withOpenRisks(recent, risky), reflects: [...reflects, ...riskyReflects.filter((x) => !reflects.some((y) => y.id === x.id))], letters, riskDrafts: drafts });
  if (alerts.length) {
    const nos = [...new Set(alerts.map((a) => a.no))].slice(0, 6);
    out.push({ key: "risk", text: `위험 표현 알림 ${alerts.length}건을 살펴보고 조치를 적어 주세요(${nos.map((n) => `${n}번`).join(", ")}).`, tab: "map", urgent: true });
  }
  const wait = letters.filter((l) => l.status === "wait").length;
  if (wait) out.push({ key: "letters", text: `허락을 기다리는 공감 쪽지가 ${wait}통 있어요.`, tab: "letters" });
  const alias = (no: number) => students.find((s) => s.no === no)?.alias ?? "";
  for (const f of watchFlags(recent, date, settings.rules).slice(0, 5))
    out.push({ key: `flag${f.no}`, text: `먼저 살펴볼 학생: ${f.no}번 ${alias(f.no)} — ${f.reasons.join(", ")}`, tab: "student", no: f.no });
  // 역량 진단: 열린 회차에 아직 답하지 않은 학생, 답했는데 피드백을 보내지 않은 학생(가장 최근 회차)
  const live = students.filter((s) => !s.demo || students.every((x) => x.demo));
  const open = rounds.find((r) => !r.closedAt && !r.teacherOnly);
  if (open) {
    const done = new Set(answers.filter((a) => a.round === open.id && cleanSelfAnswers(a.answers)).map((a) => a.no));
    const left = live.filter((s) => !done.has(s.no)).length;
    if (left) out.push({ key: "selOpen", text: `「${open.title}」 마음 점검에 아직 답하지 않은 학생이 ${left}명이에요.`, tab: "sel" });
  }
  const last = [...rounds].reverse().find((r) => answers.some((a) => a.round === r.id));
  if (last) {
    const fed = new Set(notes.filter((n) => n.round === last.id && n.feedback).map((n) => n.no));
    const k = answers.filter((a) => a.round === last.id && cleanSelfAnswers(a.answers) && !fed.has(a.no)).length;
    if (k) out.push({ key: "selFeed", text: `「${last.title}」에 답한 학생 가운데 ${k}명에게 아직 피드백을 보내지 않았어요.`, tab: "sel" });
  }
  if (expired) out.push({ key: "expired", text: `보관 기한이 지난 마음 기록 ${expired}개를 정리해 주세요.`, tab: "settings" });
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (dow === 5 && weekly?.weekStart !== addDays(date, -6)) out.push({ key: "weekly", text: "금요일이에요. 이번 주 주간 리포트를 만들어 볼까요?", tab: "report" });
  const withConsent = live.filter((s) => s.consent).length;
  if (withConsent && withConsent < live.length) out.push({ key: "consent", text: `보호자 동의서를 아직 받지 않은 학생이 ${live.length - withConsent}명이에요.`, tab: "roster" });
  return out;
}

// ── 학생 한 명의 최근 기록(번호·가명만) ──
async function studentBlock(s: Student, date: string): Promise<string> {
  const no = s.no;
  const own = (at?: string) => ownBy(s, at);
  const [records, notes, cheers, sent, got, actions, rounds, answers, selNotes] = await Promise.all([
    recordsOf(no), db().find<Note>("notes", "no", "==", no), db().find<Cheer>("cheers", "no", "==", no),
    db().find<Letter>("letters", "from", "==", no), db().find<Letter>("letters", "to", "==", no), getRiskActions(),
    getSelfRounds(), getSelfAnswers(), getSelNotes(),
  ]);
  const from = addDays(date, -30);
  const recs = records.filter((r) => own(r.createdAt) && r.date >= from).sort((a, b) => a.id.localeCompare(b.id));
  const lines: string[] = [`[학생 ${no}번 ${s.alias}]`];
  lines.push(`최근 30일 마음 기록 ${recs.length}개${recs.length ? "" : "(없음)"}`);
  for (const r of recs.slice(-30)) {
    const said = r.summaryKo || r.summary;
    lines.push(`- ${r.date} ${r.slot === "am" ? "아침" : "하교 전"}: ${r.emotion}${r.word ? `(${r.word})` : ""} 크기${r.intensity}${r.reason ? ` · 까닭 ${r.reason}` : ""}${said ? ` · "${clip(said, 80)}"` : ""}${r.answer ? ` · 되묻기 답 "${clip(r.answer, 60)}"` : ""}${r.risk ? " · ⚠위험 표현" : ""}`);
  }
  const flags = watchFlags(recs, date).find((f) => f.no === no);
  if (flags) lines.push(`앱이 본 신호(최근 7일): ${flags.reasons.join(", ")}`);
  const mine = <T extends { createdAt: string }>(xs: T[]) => xs.filter((x) => own(x.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ns = mine(notes).slice(0, 8);
  if (ns.length) lines.push("면담 메모(선생님만):", ...ns.map((n) => `- ${n.createdAt.slice(0, 10)} ${clip(n.text, 240)}`));
  const acts = actions.filter((a) => a.no === no && own(a.recordDate || a.date)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  if (acts.length) lines.push("위험 표현 조치 기록:", ...acts.map((a) => `- ${a.date} ${a.kinds.map((k) => RISK_ACTION_KO[k]).join("·")}${a.note ? ` — ${clip(a.note, 160)}` : ""}`));
  const cs = mine(cheers).slice(0, 3);
  if (cs.length) lines.push(`보낸 응원 한마디: ${cs.map((c) => `${c.createdAt.slice(0, 10)} "${clip(c.text, 60)}"`).join(" / ")}`);
  const recent = (l: Letter) => l.createdAt.slice(0, 10) >= from;
  lines.push(`공감 쪽지(30일): 보냄 ${mine(sent).filter(recent).length}통, 받음 ${mine(got.filter((l) => !l.toPractice)).filter(recent).length}통`);
  // 역량 진단: 가장 최근 회차의 영역별 수준(학생 답·종이 검사)과 선생님 관찰 수준(메모는 보내지 않음)
  const r = [...rounds].reverse().find((x) => answers.some((a) => a.round === x.id && a.no === no) || selNotes.some((n) => n.round === x.id && n.no === no));
  if (r) {
    const a = answers.find((x) => x.round === r.id && x.no === no && own(x.at) && cleanSelfAnswers(x.answers)) ?? null;
    const n = selNotes.find((x) => x.round === r.id && x.no === no && own(x.at)) ?? null;
    const sc = scoresOf(a, n);
    const ob = n?.obs ? obsScores(n.obs) : null;
    if (sc || ob) lines.push(`학급 역량 진단 「${r.title}」(${r.openedAt}): ${DOMAINS.map((d, i) => `${d.name} ${sc ? levelOf(sc[i]).name : "-"}${ob && n?.obs ? `/관찰 ${levelOf(ob[i], obsMax(n.obs)).name}` : ""}`).join(", ")}${n?.feedback ? " · 피드백 보냄" : ""}`);
  }
  return lines.join("\n");
}

// ── 우리 반 최근 2주 한눈에 ──
function classBlock(students: Student[], recs: MoodRecord[], date: string, rules: Parameters<typeof watchFlags>[2]): string {
  const from = addDays(date, -13);
  const flags = new Map(watchFlags(recs, date, rules).map((f) => [f.no, f.reasons]));
  const lines = [`[우리 반 최근 2주(${from}~${date})] 학생 ${students.length}명`];
  for (const s of students.slice(0, 40)) {
    const mine = recs.filter((r) => r.no === s.no && r.date >= from && ownBy(s, r.createdAt));
    const count = new Map<string, number>();
    for (const r of mine) count.set(r.emotion, (count.get(r.emotion) ?? 0) + 1);
    const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, k]) => `${e}${k}`).join(" ");
    const risk = mine.filter((r) => r.risk).length;
    lines.push(`- ${s.no}번 ${s.alias}: 기록 ${mine.length}${top ? ` (${top})` : ""}${risk ? ` · 위험 표현 ${risk}` : ""}${flags.get(s.no) ? ` · 신호: ${flags.get(s.no)!.join(", ")}` : ""}`);
  }
  return lines.join("\n");
}

async function ask(body: Record<string, unknown>) {
  const deadline = AbortSignal.timeout(BUDGET_MS);
  const text = String(body.text ?? "").replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " ")).trim().slice(0, ASK_MAX);
  if (!text) return bad("물어볼 말을 써 주세요.");
  const ctx = (body.ctx ?? {}) as { tab?: unknown; no?: unknown };
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8).flatMap((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    return (o.role === "me" || o.role === "bot") && typeof o.text === "string" ? [{ role: o.role, text: clip(o.text, 1200) }] : [];
  });
  const date = today();
  const settings = await getSettings();
  const students = (await getRoster());
  const live = students.filter((s) => !s.demo || students.every((x) => x.demo));
  const recentText = [text, ...history.filter((h) => h.role === "me").slice(-2).map((h) => h.text)].join("\n");

  // 어떤 학생을 묻는가: 번호·가명, 「이 학생」이면 보던 학생, 앞 물음에서 물은 학생
  let nos = mentionedNos(text, live);
  const ctxNo = Number(ctx.no);
  if (!nos.length && Number.isInteger(ctxNo) && live.some((s) => s.no === ctxNo) && (meansThis(text) || ["student", "cheer", "referral"].includes(String(ctx.tab)))) nos = [ctxNo];
  if (!nos.length && meansThis(text)) nos = mentionedNos(recentText, live);
  nos = nos.slice(0, 3);

  const crisis: CrisisId[] = crisisOf(recentText);
  const kb = searchKb(recentText, crisis.length ? 2 : 3);
  const docs = searchDocs(recentText, await docTexts(), 4);
  const parts: string[] = [`[오늘] ${date}(${WEEK[new Date(`${date}T12:00:00Z`).getUTCDay()]}) · 학급 「${settings.className}」 학생 ${live.length}명`];
  const tab = String(ctx.tab ?? "");
  if (tab in GO_TABS || tab === "assist") parts.push(`[화면] 선생님이 보던 메뉴: ${tab === "assist" ? "AI 도우미" : GO_TABS[tab as keyof typeof GO_TABS]}${Number.isInteger(ctxNo) && ctxNo > 0 ? ` · 고른 학생 ${ctxNo}번` : ""}`);

  // 할 일: 늘 짧게(업무 물음이면 더 자세히)
  const [app, mine] = await Promise.all([appTodos(), myTodos()]);
  const open = mine.filter((t) => !t.done);
  const full = wantsTodo(text);
  const todoLines = [
    ...app.map((t) => `- (앱) ${t.text}`),
    ...open.slice(0, full ? 30 : 8).map((t) => `- (선생님) ${t.title}${t.due ? ` · 마감 ${t.due}` : ""}`),
  ];
  parts.push(`[할 일]\n${todoLines.length ? todoLines.join("\n") : "- 지금 앱이 찾은 일과 적어 둔 일이 없어요."}`);

  for (const no of nos) parts.push(await studentBlock(live.find((s) => s.no === no)!, date));
  if (!nos.length && isClassWide(text)) parts.push(classBlock(live, await recordsFrom(addDays(date, -13)), date, settings.rules));

  const sources: string[] = [];
  for (const id of crisis) {
    const g = CRISIS.find((x) => x.id === id)!;
    sources.push(`대응 안내 · ${g.title}`);
    parts.push(crisisText(g));
  }
  if (crisis.length) {
    const cs = await contacts();
    if (cs.length) parts.push(`[학교 연락처] ${cs.map((c) => `${c.label} ${c.num}`).join(", ")}`);
  }
  for (const c of kb) {
    sources.push(c.title);
    parts.push(`[자료: ${c.title}] (출처: ${c.src})\n${c.text}`);
  }
  for (const d of docs) {
    const name = `자료함 · ${d.title}`;
    if (!sources.includes(name)) sources.push(name);
    parts.push(`[자료: ${name}] (선생님이 올린 ${d.kind} 자료의 일부)\n${d.text}`);
  }
  if (history.length) parts.push(`[지난 대화]\n${history.map((h) => `${h.role === "me" ? "선생님" : "도우미"}: ${h.text}`).join("\n")}`);
  parts.push(`[물음]\n${text}`);
  parts.push(`(sources에 쓸 수 있는 이름: ${sources.length ? sources.map((s) => `「${s}」`).join(", ") : "없음"}. go의 tab: ${Object.entries(GO_TABS).map(([k, v]) => `${k}=${v}`).join(", ")})`);

  const ai = await aiConfig();
  if (!ai) return bad(isDemo() ? "오늘 체험용 AI 사용량을 다 썼어요. 위기 대응 안내와 할 일은 AI 없이도 볼 수 있어요." : "AI 키가 있어야 대답할 수 있어요. 「설정」에서 키를 넣어 주세요. 위기 대응 안내와 할 일은 AI 없이도 볼 수 있어요.", 400, { crisis });
  let out;
  try {
    out = cleanAssist(await inTime(assistReply(ai, parts.join("\n\n"), deadline), deadline), { nos, sources });
  } catch (e) {
    const late = deadline.aborted;
    return bad(late ? "대답을 만드는 데 시간이 너무 걸렸어요. 물음을 조금 짧게 해서 다시 해 주세요." : `대답을 만들지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), late ? 504 : 502, { crisis });
  }
  if (!out.reply) return bad("AI 답이 비어 있어요. 다시 해 주세요.", 502, { crisis });
  if (!saysTodo(text)) out.todos = [];
  if (!out.sources.length) out.sources = sources.slice(0, 3); // AI가 출처를 비워 두어도 넘겨준 자료 이름은 보이게

  const at = new Date().toISOString();
  const me: ChatMsg = { role: "me", text, at };
  const bot: ChatMsg = { role: "bot", text: out.reply, at, sources: out.sources, todos: out.todos, go: out.go, crisis, nos };
  let thread: { id: string; title: string } | null = null;
  if (!isDemo()) {
    const id = /^[a-z0-9]{4,20}$/.test(String(body.thread ?? "")) ? String(body.thread) : newId();
    const saved = await db().update<ChatThread>("meta", chatId(id), (cur) => ({
      kind: "chat", id, title: cur?.title ?? threadTitle(text), createdAt: cur?.createdAt ?? at, updatedAt: at,
      msgs: [...(cur?.msgs ?? []), me, bot].slice(-MSG_MAX),
    }));
    if (saved) thread = { id, title: saved.title };
    await liveThreads(); // 오래된 대화 정리
  }
  return NextResponse.json({ ...bot, thread, kb: kb.map((c) => c.id), saved: !isDemo() });
}

