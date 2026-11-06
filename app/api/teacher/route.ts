// 교사 API: 비밀번호 로그인 뒤에만 쓸 수 있다
import { NextResponse, after, type NextRequest } from "next/server";
import { cheer, ping, referralDraft, translateNotice, weeklySummary } from "@/lib/ai";
import { SELF_ROUNDS_MAX, addRiskAction, deleteRiskAction, editSelfRounds, noteTeacherLogin, setConsent } from "@/lib/data";
import { draftText, partsText, reflectEverRisk, reflectSource, riskySource } from "@/components/teacher/alerts";
import { clientIp, passwordAttempt, resetWait, trialEditWait, waitText } from "@/lib/limit";
import { clearSubs } from "@/lib/push";
import { TEACHER_COOKIE, TEACHER_HOURS, checkPassword, encrypt, decrypt, isTeacher, makePin, mask, newCode, teacherSpace, teacherToken, validPin } from "@/lib/auth";
import {
  DEMO_AI_PER_DAY, SHARED_AI_PER_DAY, accountName, aiConfig, hasSharedAi, sharedAiUsed, allRecords, createAccount, demoAiUsed, demoProvider, findAccount, trialAiSource, getLessons, getSelChecks, saveSelChecks, getRiskActions, getRiskDrafts, checkRiskDraft, getSelfRounds, getSelfAnswers, deleteSelfAnswers, cutoffNow, expiredCounts, purgeBefore, purgeLogs, getLooks, getPin, getRoster, getSettings, getStamp, readRoster, purgePractice, clearPractice, recordsChangedAfter, recordsFrom, recordsOf,
  HELD_RISK, heldRisks, riskyRecords, rosterIsDemo, savePin, saveRoster, saveSettings, seedPractice, touch, withOpenRisks,
} from "@/lib/data";
import { addDays, monday, slotNow, today } from "@/lib/date";
import { db, inSpace, isDemo, spaceId } from "@/lib/db";
import { countSubs, hasSub, notifyTeachers, pushPublicKey, pushReady, removeSub, saveSub } from "@/lib/push";
import { classWeather, watchFlags, weekStats } from "@/lib/rules";
import { isLang } from "@/lib/i18n";
import { cleanCheck } from "@/lib/selcheck";
import type { SelfRound } from "@/lib/selfcheck";
import { cutoffOf, isRetention } from "@/lib/retention";
import { CALM_KO, FELT_KO, PROVIDER_IDS, RISK_WORDS_MAX, RISK_WORD_LEN, riskKinds, type Cheer, type Letter, type MoodRecord, type Note, type Provider, type Reflect, type RiskAction, type Rules, type SheetRun } from "@/lib/shared";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
// 낱말 목록: 낱말마다 길이를, 목록은 개수를 막는다(아주 긴 위험 표현 하나로 찾기가 느려지지 않게)
const strList = (v: unknown, max = 60, len = 20) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, len)).filter(Boolean))].slice(0, max) : null;
const lean = (r: MoodRecord) => ({ ...r, voice: undefined }); // 목소리 숫자는 화면에 필요 없음
const DAYS = 34; // 교사 화면이 들고 있는 기록 범위(월간 그래프 30일 + 여유)

function withTeacherCookie(v: number, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: true, ...extra });
  res.cookies.set(TEACHER_COOKIE, teacherToken(v), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: TEACHER_HOURS * 3600, path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  // 화면은 늘 JSON으로 보낸다. 다른 사이트의 form으로 몰래 로그인시켜 엉뚱한 학급에 쓰게 하는 것(로그인 CSRF)을 막는다.
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "요청이 올바르지 않아요." }, { status: 415 });
  return inSpace(teacherSpace(req.cookies.get(TEACHER_COOKIE)?.value), () => handle(req)); // 표에 적힌 학급 공간에서
}

// 체험 공간에서 막는 일: 비밀번호·AI 키 바꾸기, 휴대폰 알림(여러 사람이 함께 쓰고, 실제 반의 키를 빌려 쓰므로)
const DEMO_BLOCKED = new Set(["changePin", "subscribe", "unsubscribe", "testPush", "pushClear"]);
// 체험 반은 로그인 없이 누구나 쓰므로, 함께 쓰는 문서를 바꾸는 일은 IP마다 10분에 정한 번까지(lib/limit.ts trialEditWait)
// (아래 handle의 쓰는 일 이름과 하나하나 맞춘 목록 — 「demo」는 resetWait로 따로 막는다)
const TRIAL_WRITES = new Set([
  "roster", "newCode", "settings", "note", "deleteNote", "saveCheer", "checkFlag", "checkAlert", "riskAction", "riskActionDelete", "letterCheck", "consent",
  "selfOpen", "selfClose", "selfReopen", "selfDelete", "selSave", "selDelete", "saveLesson", "deleteLesson", "sheetEdit", "sheetDelete", "purgeOld", "weekly",
]);
const tooMany = (wait: number) => bad(`너무 많이 틀렸어요. ${waitText(wait)} 뒤에 다시 해 주세요.`, 429);

async function handle(req: NextRequest) {
  // 몸이 JSON 객체가 아니면(null·배열·숫자·깨진 JSON) 400 — body.action을 읽다 500이 나지 않게
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("요청이 올바르지 않아요.");
  try {
    // 잠그기(로그아웃): 이 기기의 알림 주소(endpoint)를 보내면 이 학급 알림 목록에서도 뺀다(잠근 기기로 위험 알림이 가지 않게)
    if (body.action === "logout") {
      if (typeof body.endpoint === "string" && !isDemo() && isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, (await getPin())?.v ?? 0)) await removeSub(body.endpoint);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(TEACHER_COOKIE);
      return res;
    }
    // 로그인: 이름으로 학급을 찾고 그 학급 공간에서 비밀번호를 맞춰 본다(어느 쪽이 틀렸는지는 알려 주지 않음).
    // 너무 많이 틀리면 그 학급 × 이 IP만 잠시 막는다(passwordAttempt — 저장소에 세므로 서버가 여러 대여도 같이 셈).
    if (body.action === "login") {
      const acc = await findAccount(String(body.name ?? ""));
      if (!acc) return bad("이름이나 비밀번호가 맞지 않아요.", 401);
      const ip = clientIp(req.headers);
      return inSpace(acc.space, async () => {
        const gate = await passwordAttempt(ip);
        if (gate.wait) return tooMany(gate.wait);
        const pin = await getPin();
        const r = checkPassword(String(body.password ?? ""), pin);
        await gate.done(r.ok);
        if (!r.ok) return bad("이름이나 비밀번호가 맞지 않아요.", 401);
        after(() => noteTeacherLogin(acc).catch((e) => console.error("로그인 기록·빈 학급 정리 실패", e)));
        return withTeacherCookie(pin?.v ?? 0);
      });
    }
    // 새 학급 만들기(누구나): 이름·학급 이름·비밀번호. AI 키는 들어간 뒤 「설정」에서 각자 넣는다. IP마다·하루 전체 만들 수 있는 수가 있다.
    if (body.action === "signup") {
      const r = await createAccount(String(body.name ?? ""), String(body.className ?? ""), String(body.password ?? ""), { ip: clientIp(req.headers) });
      if ("error" in r) return bad(r.error, r.status ?? 400);
      return inSpace(r.space, () => withTeacherCookie(r.v));
    }
    const pin = await getPin();
    if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, pin?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);

    if (isDemo() && DEMO_BLOCKED.has(body.action)) return bad("체험에서는 쓸 수 없는 기능이에요.", 403);

    // 비밀번호 바꾸기: 지금 비밀번호를 확인하고, 바꾼 기기만 계속 열려 있게 새 표를 준다.
    // 비밀번호를 바꾸는 것은 잃어버린 기기를 끊으려는 때가 많으므로 알림 받는 기기도 모두 뺀다(keepEndpoint로 보낸 이 기기만 남김).
    if (body.action === "changePin") {
      const next = String(body.next ?? "");
      if (!validPin(next)) return bad("새 비밀번호는 숫자 4~12자리로 해 주세요.");
      const gate = await passwordAttempt(clientIp(req.headers));
      if (gate.wait) return tooMany(gate.wait);
      const r = checkPassword(String(body.current ?? ""), pin);
      await gate.done(r.ok);
      if (!r.ok) return bad("지금 비밀번호가 맞지 않아요.", 401);
      const np = makePin(next, (pin?.v ?? 0) + 1);
      await savePin(np);
      const pushRemoved = await clearSubs(typeof body.keepEndpoint === "string" ? body.keepEndpoint : undefined);
      return withTeacherCookie(np.v, { pushRemoved, devices: await countSubs() });
    }

    // 변경 표시만(문서 1개 읽기). 교사 화면은 이것만 20초마다 묻는다.
    if (body.action === "stamp") return NextResponse.json(await getStamp());

    // 기록만 바뀌었을 때: 그 뒤에 바뀐 기록만
    if (body.action === "changes") {
      const since = Number(body.since) || 0;
      return NextResponse.json({ stamp: await getStamp(), records: (await recordsChangedAfter(since)).map(lean) });
    }

    const settings = await getSettings();
    if (isDemo() && TRIAL_WRITES.has(body.action)) {
      const wait = await trialEditWait(clientIp(req.headers));
      if (wait) return bad(`체험 반에서는 잠시 뒤에 다시 해 주세요(${waitText(wait)}).`, 429);
    }

    if (body.action === "overview") {
      const date = today();
      const stamp = await getStamp();
      const from = addDays(date, -DAYS);
      // 교사 기기에 기록을 저장해 두었으면(같은 저장 공간, 그 뒤 지운 적 없음) 그 뒤에 바뀐 기록만 읽는다 → 읽기량을 크게 줄임
      const partial = Number(body.since) > 0 && body.prefix === db().prefix && Number(body.wipe ?? 0) === (stamp.wipe ?? 0);
      // 그 뒤에 바뀐 기록 가운데 오래된 것은 위험 표현 기록만(살펴본 것도): 다른 기기에서 「살펴봤어요」를 눌러 닫은 오래된 알림이
      // 이 기기에 저장해 둔 「살펴보지 않음」 판으로 남지 않게 새 판을 보낸다(화면이 합친 뒤 살펴본 오래된 기록은 버린다)
      const recordsP = partial ? recordsChangedAfter(Number(body.since)).then((rs) => rs.filter((r) => r.date >= from || r.risk)) : recordsFrom(from);
      const [students, recent, cheers, notes, demo, subs, lessons, weekly, looks, letters, recentReflects, riskyReflects, aiUsed, riskActions, drafts, risky] = await Promise.all([
        getRoster(), recordsP, db().all<Cheer>("cheers"), db().all<Note>("notes"), rosterIsDemo(), countSubs(),
        getLessons(), db().get<{ weekStart: string }>("meta", "weekly"), getLooks(),
        db().all<Letter>("letters"), db().find<Reflect>("reflects", "weekStart", ">=", addDays(monday(date), -7)),
        db().find<Reflect>("reflects", "risk", "==", true), isDemo() ? demoAiUsed() : 0,
        getRiskActions(), getRiskDrafts(), riskyRecords(),
      ]);
      // 위험 표현이 있는 기록·돌아보기·마치지 않은 글은 34일이 지나도 선생님이 살펴볼 때까지 보낸다(알림이 날짜 때문에 사라지지 않게).
      // 저장해 둔 기록만 받는 때(partial)에도 늘 보낸다 — 예전 화면이 34일로 잘라 버렸어도 다시 받게.
      const records = withOpenRisks(recent, risky);
      const reflects = [...recentReflects, ...riskyReflects.filter((x) => !x.riskChecked && !recentReflects.some((y) => y.id === x.id))];
      // 보관 기한이 지난 마음 기록 수(세기만): 있으면 선생님 화면에 「정리할 기록」 알림
      const expired = await db().count("records", "date", "<", cutoffOf(settings.retention, date));
      const aiSource = isDemo() ? await trialAiSource() : null;
      // 실제 학급: 공용 업스테이지 키를 오늘 몇 번 빌려 썼는지(키를 넣지 않은 학급도 AI가 돌게)
      const sharedAi = !isDemo() && hasSharedAi() ? { used: await sharedAiUsed(), cap: SHARED_AI_PER_DAY } : null;
      const newest = <T extends { createdAt: string }>(xs: T[]) => xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return NextResponse.json({
        today: date,
        weekStart: addDays(date, -6),
        storage: db().kind,
        dataPrefix: db().prefix,
        stamp,
        partial,
        pinSet: !!pin,
        students,
        records: records.map(lean),
        demo: demo || records.some((r) => r.demo),
        cheers: newest(cheers).slice(0, 200),
        notes: newest(notes),
        push: { ready: pushReady(), key: pushPublicKey(), devices: subs },
        lessons,
        // 마음 친구 이름은 학생이 실명을 쓸 수 있어 선생님 화면에 보내지 않는다
        looks: Object.fromEntries(Object.entries(looks).map(([no, l]) => [no, { ...l, name: "" }])),
        weekly: weekly?.weekStart === addDays(date, -6) ? weekly : null,
        // 허락을 기다리는 쪽지(위험 표현 포함)는 모두, 나머지는 새것 150통까지
        letters: [...newest(letters.filter((l) => l.status === "wait")), ...newest(letters.filter((l) => l.status !== "wait")).slice(0, 150)],
        reflects, // 이번 주·지난주 한 주 돌아보기
        riskActions, // 위험 표현 조치 기록(선생님만)
        // 학생이 기록을 마치지 않고 나간 위험 표현: 최근 것은 살펴본 것도(리포트·CSV용, 알림은 살펴보지 않은 것만), 살펴보지 않은 것은 오래돼도
        riskDrafts: drafts.filter((x) => x.date >= from || !x.checked),
        expired,
        trial: isDemo() ? { aiUsed, aiCap: DEMO_AI_PER_DAY, aiSource } : null,
        sharedAi,
        space: spaceId(), // 이 기기의 실명 명렬표를 학급마다 따로 두는 열쇠
        account: await accountName(),
        settings: publicSettings(isDemo() ? { ...settings, provider: await demoProvider() } : settings),
      });
    }

    // 교실 TV 「우리 반 마음 날씨」: 오늘 기록을 이름·번호 없이 묶은 숫자만 보낸다(위험 표현 여부도 빼고)
    if (body.action === "classWeather") {
      const date = today();
      const which = body.slot === "now" ? slotNow() : body.slot === "am" || body.slot === "pm" ? body.slot : null;
      const todays = (await recordsFrom(date)).filter((r) => r.date === date && (!which || r.slot === which));
      // 「하루 전체」면 학생마다 가장 나중 기록 하나만 센다
      const latest = which ? todays : [...new Map(todays.sort((a, b) => a.slot.localeCompare(b.slot)).map((r) => [r.no, r])).values()];
      // 단어 사전 보기: 최근 30일 우리 반 감정 단어(이름 없이 횟수만)
      const month: Record<string, number> = {};
      for (const r of await recordsFrom(addDays(date, -29))) if (r.word) month[r.word] = (month[r.word] ?? 0) + 1;
      return NextResponse.json({
        date, slot: which ?? "day", now: slotNow(), className: settings.className, students: (await getRoster()).length, ...classWeather(latest),
        monthWords: Object.entries(month).sort((a, b) => b[1] - a[1]).slice(0, 30),
      });
    }

    // ── 공감 쪽지 검토: 허락(필요하면 살짝 고쳐서)하거나 돌려보내기 ──
    if (body.action === "letterCheck") {
      const status = body.status;
      if (status !== "ok" && status !== "no") return bad("쪽지를 찾지 못했어요.", 404);
      const edited = typeof body.text === "string" && body.text.trim().length >= 2 ? body.text.trim().slice(0, 120) : null;
      const roster = status === "ok" ? new Set((await getRoster()).map((s) => s.no)) : null;
      // 허락을 기다리는 쪽지만 바꾼다(읽고 고쳐 쓰기를 한 번에): 두 기기가 같은 쪽지를 하나는 돌려보내고 하나는 전하는 일이 없게.
      // 다듬어 전하면 학생이 처음 쓴 글은 original에 남긴다(위험한 말이 고쳐 쓰여 사라지지 않게).
      const out: { why?: "none" | "done" | "gone" } = {};
      await db().update<Letter>("letters", String(body.id), (cur) => {
        out.why = !cur ? "none" : cur.status !== "wait" ? "done" : roster && (cur.toPractice || !roster.has(cur.to)) ? "gone" : undefined;
        if (out.why || !cur) return undefined;
        const text = edited ?? cur.text;
        return { ...cur, text, status, checkedAt: new Date().toISOString(), ...(text !== cur.text && !cur.original ? { original: cur.text } : {}) };
      });
      if (out.why === "none") return bad("쪽지를 찾지 못했어요.", 404);
      if (out.why === "done") return bad("다른 기기에서 이미 전하거나 돌려보낸 쪽지예요. 화면을 새로 읽을게요.", 409);
      if (out.why === "gone") return bad("받을 친구가 지금 명단에 없어요(연습용 학생이었거나 명단에서 빠짐). 전하지 말고 돌려보내 주세요.", 409);
      await touch("other");
      return NextResponse.json({ ok: true });
    }

    // ── 상담 연계 의견서 초안: 최근 2주 기록(가명)으로 관찰 사실만 ──
    if (body.action === "referral") {
      const no = Number(body.no);
      const s = (await getRoster()).find((x) => x.no === no);
      if (!s) return bad("학생을 찾지 못했어요.", 404);
      const ai = await aiConfig();
      if (!ai) return bad(isDemo() ? "오늘 체험용 AI 사용량을 다 썼어요." : "AI 키가 있어야 초안을 만들 수 있어요. 「설정」에서 넣어 주세요.");
      const date = today();
      const recs = (await recordsOf(no)).filter((r) => r.date >= addDays(date, -13)).sort((a, b) => a.id.localeCompare(b.id));
      const signals = watchFlags(await recordsFrom(addDays(date, -13)), date, settings.rules).find((f) => f.no === no)?.reasons ?? [];
      const draft = await referralDraft(ai, {
        alias: s.alias, signals,
        records: recs.map((r) => ({
          date: r.date, slot: r.slot === "am" ? "아침" : "하교 전", emotion: r.emotion, word: r.word, intensity: r.intensity, reason: r.reason,
          said: r.summaryKo || r.summary || undefined, answer: r.answer || undefined, risk: r.risk || undefined,
          calm: r.calm?.map((c) => `${CALM_KO[c.tool]}→${FELT_KO[c.felt]}`),
        })),
      });
      return NextResponse.json({ draft, from: addDays(date, -13), to: date, records: recs.length });
    }

    // ── 가정 소식지 번역(이주배경학생 가정용) ──
    if (body.action === "translate") {
      const lang = body.lang;
      if (!isLang(lang) || lang === "ko" || typeof body.text !== "string" || !body.text.trim()) return bad("번역할 언어와 내용을 확인해 주세요.");
      const ai = await aiConfig();
      if (!ai) return bad(isDemo() ? "오늘 체험용 AI 사용량을 다 썼어요." : "AI 키가 있어야 번역할 수 있어요.");
      return NextResponse.json({ text: await translateNotice(ai, body.text, lang) });
    }

    // 기록 내보내기(전체). 화면에서 CSV로 만든다.
    if (body.action === "export") {
      // 돌아보기는 한 번이라도 위험했던 것(고쳐 써서 지금 글은 순해졌어도 고치기 전 글에 있었으면)을 모두
      const [reflects, riskyLetters] = await Promise.all([db().all<Reflect>("reflects"), db().find<Letter>("letters", "risk", "==", true)]);
      return NextResponse.json({
        records: (await allRecords()).map(lean), students: await getRoster(), riskActions: await getRiskActions(), riskDrafts: await getRiskDrafts(),
        reflects: reflects.filter(reflectEverRisk), letters: riskyLetters, // 위험 표현이 있었던 돌아보기·쪽지(오래된 것도 CSV에)
      });
    }

    // 면담 메모: 교사만 보고 AI에는 보내지 않는다
    if (body.action === "note") {
      const text = String(body.text ?? "").trim().slice(0, 1000);
      if (!text) return bad("메모가 비어 있어요.");
      const practice = (await getRoster()).find((x) => x.no === Number(body.no))?.demo;
      const n: Note = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString(), ...(practice ? { demo: true } : {}) };
      await db().set("notes", n.id, { ...n });
      await touch("other");
      return NextResponse.json({ note: n });
    }
    if (body.action === "deleteNote") {
      await db().del("notes", String(body.id));
      await touch("other");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "roster") {
      const old = await getRoster();
      const { students, skipped } = readRoster(String(body.text ?? ""), old);
      if (!students.length) return bad("「번호 가명」 모양으로 한 줄에 한 명씩 적어 주세요.");
      // 연습용 가짜 학생을 실제 학생으로 바꾸거나 뺀 번호는, 그 번호에 남은 연습 흔적만 바로 지운다(다른 연습 학생 것은 그대로).
      // 바꾼 번호는 코드도 새로 준다(연습 때 나눠 준 코드로 실제 학생 화면에 들어오지 않게).
      const kept = new Set(students.filter((s) => s.demo).map((s) => s.no));
      const replaced = new Set(old.filter((s) => s.demo && !kept.has(s.no)).map((s) => s.no));
      let list = students;
      if (replaced.size) {
        await purgePractice((no) => replaced.has(no), { onlyThese: true });
        const taken = new Set(students.map((s) => s.code));
        list = students.map((s) => {
          if (!replaced.has(s.no)) return s;
          const code = newCode(taken);
          taken.add(code);
          return { ...s, code };
        });
      }
      const saved = await saveRoster(list, list.some((s) => s.demo));
      // 마지막 연습 학생까지 바뀌었으면 학생에 매이지 않은 연습 자료(자기진단·역량 진단 연습 회차, 활동지 예시)도 정리
      if (replaced.size && !saved.some((s) => s.demo)) await clearPractice();
      if (replaced.size) await touch("wipe"); // 다른 기기 선생님 화면도 지운 기록을 버리고 다시 읽게
      return NextResponse.json({ students: saved, skipped });
    }

    // 보호자 동의서 받음 표시(기록을 막지는 않음): nos 여럿을 한꺼번에 켜거나 끈다
    if (body.action === "consent") {
      const nos = (Array.isArray(body.nos) ? body.nos : []).map(Number).filter(Number.isInteger);
      return NextResponse.json({ students: await setConsent(nos, body.on === true) });
    }

    if (body.action === "newCode") {
      const roster = await getRoster();
      const s = roster.find((x) => x.no === Number(body.no));
      if (!s) return bad("없는 번호예요.");
      s.code = newCode(new Set(roster.map((x) => x.code)));
      // 명단 문서의 연습 표시는 그대로 둔다(rosterIsDemo는 남은 연습 회차까지 보므로, 그 값을 쓰면 실제 명단이 연습 명단으로 바뀐다)
      const keep = (await db().get<{ demo?: boolean }>("meta", "roster"))?.demo === true;
      return NextResponse.json({ students: await saveRoster(roster, keep) });
    }

    if (body.action === "settings") {
      const next = { ...settings, keys: { ...settings.keys }, models: { ...settings.models } };
      if (PROVIDER_IDS.includes(body.provider)) next.provider = body.provider;
      if (typeof body.className === "string" && body.className.trim()) next.className = body.className.trim().slice(0, 20);
      for (const p of PROVIDER_IDS) {
        const m = isDemo() ? undefined : body.models?.[p]; // 체험은 실제 반 키를 빌려 쓰므로 모델 이름도 바꾸지 않는다
        if (typeof m === "string" && m.trim()) next.models[p] = m.trim().slice(0, 80);
        const k = isDemo() ? undefined : body.keys?.[p]; // 체험에서는 키를 바꾸지 않는다
        if (k === "") delete next.keys[p]; // 빈 글자 = 지우기, 안 보내면 그대로
        else if (typeof k === "string" && k.trim()) next.keys[p] = encrypt(k.trim());
      }
      next.vocab = strList(body.vocab, 60, 12) ?? next.vocab;
      next.riskWords = strList(body.riskWords, RISK_WORDS_MAX, RISK_WORD_LEN) ?? next.riskWords; // 기본 목록이 늘어도 잘리지 않게 넉넉히(넘으면 화면이 저장 전에 알림)
      if (["off", "device", "gemini"].includes(body.voiceMode)) next.voiceMode = body.voiceMode;
      if (isRetention(body.retention)) next.retention = body.retention;
      if (body.rules && typeof body.rules === "object") {
        const n = (k: keyof Rules, max: number) => Math.min(max, Math.max(1, Math.round(Number(body.rules[k]) || next.rules[k])));
        next.rules = { streakDays: n("streakDays", 7), dropDays: n("dropDays", 7), reasonTimes: n("reasonTimes", 14), absentDays: n("absentDays", 10) };
      }
      await saveSettings(next);
      return NextResponse.json({ settings: publicSettings(next) });
    }

    if (body.action === "testAI") {
      const ai = await aiConfig(body.provider as Provider);
      if (!ai) return bad(body.provider === "upstage" && hasSharedAi() ? "오늘 공용 키 몫을 다 썼어요. 내일 다시 하거나 업스테이지 키를 넣어 주세요." : "이 AI의 키가 아직 없어요.");
      try {
        return NextResponse.json({ ok: await ping(ai), model: ai.model });
      } catch (e) {
        return bad(`연결 실패: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
      }
    }

    if (body.action === "cheer") {
      const no = Number(body.no);
      const s = (await getRoster()).find((x) => x.no === no);
      if (!s) return bad("없는 번호예요.");
      const ai = await aiConfig();
      if (!ai) return bad("응원 초안은 AI 키가 있어야 만들 수 있어요. 「설정」에서 키를 넣어 주세요.");
      const date = today();
      const recs = (await recordsOf(no)).filter((r) => r.date >= addDays(date, -13));
      if (!recs.length) return bad("최근 2주 기록이 없어요.");
      const signals = watchFlags(recs, date, settings.rules).find((f) => f.no === no)?.reasons ?? [];
      try {
        return NextResponse.json(await cheer(ai, s.alias, recs, settings.vocab, signals, date));
      } catch (e) {
        return bad(`초안을 만들지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
      }
    }

    if (body.action === "saveCheer") {
      const text = String(body.text ?? "").trim().slice(0, 600);
      if (!text) return bad("내용이 비어 있어요.");
      const practice = (await getRoster()).find((x) => x.no === Number(body.no))?.demo;
      const c: Cheer = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString(), ...(practice ? { demo: true } : {}) };
      await db().set("cheers", c.id, { ...c });
      await touch("other");
      return NextResponse.json({ cheer: c });
    }

    // 「먼저 살펴볼 학생」 살펴봤어요: 그 열쇠 하나만 쓴다(다른 기기에서 같은 때 바꾼 설정을 덮어쓰지 않게)
    if (body.action === "checkFlag") {
      const key = String(body.key ?? "");
      if (!/^\d{1,3}_\d{4}-\d{2}-\d{2}$/.test(key)) return bad("모양이 맞지 않아요.");
      await db().setField("meta", "settings", `checks.${key}`, new Date().toISOString());
      await touch("other");
      return NextResponse.json({ ok: true });
    }

    // 위험 표현 「살펴봤어요」: 무엇을 했는지(여럿 고름)·한 날·짧은 메모를 조치 기록에 남기고 알림을 닫는다.
    // 그 뒤에 더 한 일(보호자 연락 등)은 riskAction으로 같은 기록에 이어 적는다. 메모는 AI에 보내지 않는다.
    if (body.action === "checkAlert" || body.action === "riskAction") {
      const kinds = riskKinds(body.kinds);
      if (!kinds.length) return bad("한 일을 하나 이상 골라 주세요.");
      // 무엇을 살펴봤나: 마음 기록(기본) · 「reflect:」 한 주 돌아보기 · 「draft:」 마치지 않은 위험 표현 · 「letter:」 공감 쪽지
      // seen: 선생님이 본 그 글의 판(시각). 그사이 학생이 새로 쓰거나 고쳤으면 닫지 않고 409로 다시 보게 한다(어느 종류든).
      const first = body.action === "checkAlert";
      const id = String(first ? body.id : body.recordId);
      const items = await getRiskActions();
      const pre = id.match(/^(reflect|draft|letter):(.+)$/);
      const kind = (pre?.[1] ?? "record") as "record" | "reflect" | "draft" | "letter";
      const key = pre ? pre[2] : id;
      const r = kind === "record" ? await db().get<MoodRecord>("records", key) : null;
      const ref = kind === "reflect" ? await db().get<Reflect>("reflects", key) : null;
      const d = kind === "draft" ? (await getRiskDrafts()).find((x) => x.id === key) : undefined;
      const l = kind === "letter" ? await db().get<Letter>("letters", key) : null;
      const before = items.find((x) => x.recordId === id); // 보관 기한이 지나 기록을 지운 뒤에도 이어 적을 수 있게
      const target = r ?? ref ?? d ?? l;
      const DRAFT_DONE = "학생이 그 글로 기록을 마쳤어요. 고른 일과 메모는 마음 기록 알림으로 옮겨 둘게요. 기록을 읽고 다시 눌러 주세요.";
      const GONE = "그 글이 지금 없어요(지워졌거나 정리됨). 화면을 새로 읽을게요.";
      // 알림 닫기는 그 글이 있어야 한다(없으면 조치 기록만 남기고 200을 돌려주지 않게).
      // 마치지 않은 글이 그사이 마음 기록이 되어 없어졌으면 409: 화면이 새로 읽고 같은 칸의 마음 기록 알림에서 살펴보게 한다.
      if (first && !target) return kind === "draft" ? bad(DRAFT_DONE, 409) : bad(GONE, 404);
      const no = r?.no ?? ref?.no ?? d?.no ?? l?.from ?? before?.no;
      // 마치지 않은 글에 「조치 더 적기」: 그사이 학생이 그 글로 기록을 마쳐 글과 조치 기록이 마음 기록으로 옮겨 갔으면 409(화면이 새로 읽고 폼을 그 기록으로 옮긴다)
      if (no === undefined) return kind === "draft" ? bad(DRAFT_DONE, 409) : bad("기록이 없어요.");
      const now = new Date().toISOString();
      const seen = typeof body.seen === "string" ? body.seen : null;
      const STALE = "학생이 그사이 새로 쓰거나 고친 글이 있어요. 바뀐 글을 읽고 다시 눌러 주세요.";
      const version = r ? (r.riskAt ?? r.createdAt) : ref ? ref.createdAt : d ? d.at : l ? l.createdAt : null;
      // 남기기 전에 먼저 견준다(그사이 바뀐 것이면 아무것도 남기지 않고 409)
      if (first && seen && version !== seen) return bad(STALE, 409);
      // 조치 기록에는 위험 표현이 있던 그 글을 서버가 골라 남긴다(지금 글이 고쳐 써서 순해졌어도, 선생님이 다듬어 전한 쪽지여도).
      // 그 글이 나중에 지워지거나(34일·보관 기한·마치지 않은 기록 40일) 바뀌어도 조치 기록에 남는다.
      // 글이 둘 이상이면 「[먼저 쓴 글 09:00] … ‖ [다시 쓴 글 09:05] …」(한 글 안의 「 / 」와 헷갈리지 않게 — alerts.ts partsText)
      const text =
        kind === "draft" && d ? partsText([...(d.earlier ?? []).map((e) => ({ text: e.text, hits: e.hits, at: e.at, now: false })), { text: draftText(d), hits: d.hits, at: d.at, now: true }])
        : kind === "reflect" && ref ? reflectSource(ref, settings.riskWords).text
        : kind === "letter" && l ? `${l.from}번 → ${l.to}번: ${l.original ?? l.text}`
        : kind === "record" && r ? riskySource(r).text
        : "";
      // 글이 지워진 뒤 이어 적을 때는 앞 조치 기록의 날짜로. recordDate가 없던 예전 조치 기록이면 그 한 날(정리 기준 actDate와 같게) —
      // undefined를 그대로 쓰면 Firestore가 거래 전체를 거절한다(500)
      const recordDate = r?.date ?? (ref ? today(new Date(ref.createdAt)) : undefined) ?? d?.date ?? (l ? today(new Date(l.createdAt)) : undefined) ?? (before!.recordDate || before!.date);
      // opId: 화면이 폼마다 하나 정해 보내는 이름. 같은 폼에서 다시 눌러도(닫다가 실패해 다시 누름 등) 조치 기록이 두 번 남지 않는다.
      const op = typeof body.opId === "string" && /^[a-z0-9]{8,40}$/i.test(body.opId) ? body.opId : `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      const act: RiskAction = {
        id: `${op}_${no}`, no, recordId: id, recordDate,
        date: isDay(body.date) && body.date <= today() ? body.date : today(), kinds, note: String(body.note ?? "").trim().slice(0, 300),
        createdAt: now,
        ...(kind !== "record" ? { kind } : {}), ...(text ? { text: text.slice(0, 400) } : {}),
        // 연습(시연) 기록에 대한 조치면 연습 표시 → 「연습 데이터만 지우기」가 함께 지운다
        ...((target?.demo ?? before?.demo) ? { demo: true } : {}),
      };
      // 조치 기록을 먼저 남기고(목록을 읽고 고쳐 쓰기를 한 번에 — 두 기기에서 같은 순간 적어도 둘 다 남음) 그다음 알림을 닫는다.
      // 기록을 남기지 못하면 알림도 닫지 않는다. 닫다가 실패하면 기록은 남고 알림은 열려 있어, 다시 누르면 같은 기록(opId)을 고쳐 쓰고 닫는다.
      // 마치지 않은 글에 적는데 그사이 학생이 그 글로 기록을 마쳐 조치 기록이 옮겨 갔으면 이것도 그 마음 기록으로(addRiskAction이 한 번에)
      await addRiskAction(act, { draftAt: d?.at });
      if (first) {
        const closed = await closeAlert(kind, key, seen, now);
        if (closed !== "ok") {
          await deleteRiskAction(act.id); // 닫지 못했으면(그사이 바뀜·없어짐) 방금 남긴 조치 기록도 거둔다
          return closed === "stale" ? bad(STALE, 409) : kind === "draft" ? bad(DRAFT_DONE, 409) : bad(GONE, 404);
        }
      }
      return NextResponse.json({ ok: true, riskActions: await getRiskActions() });
    }
    if (body.action === "riskActionDelete") {
      await deleteRiskAction(String(body.id));
      return NextResponse.json({ ok: true, riskActions: await getRiskActions() });
    }

    // 교과서에서 고른 감정 단어·활동 저장 → 반 감정 단어에 더하고, 활동은 주간 추천 후보로
    if (body.action === "saveLesson") {
      // 목록 칸이 객체가 아니면(null·글자 등) 빈 것으로 본다(x.word를 읽다 500이 나지 않게)
      const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
      const words = (Array.isArray(body.words) ? body.words : []).map((x: unknown) => String(obj(x).word ?? "").trim().slice(0, 12)).filter(Boolean).slice(0, 12);
      const activities = (Array.isArray(body.activities) ? body.activities : []).slice(0, 6).map(obj).map((a: Record<string, unknown>) => ({
        title: String(a.title ?? "").slice(0, 30), how: String(a.how ?? "").slice(0, 120), minutes: Math.min(45, Math.max(1, Number(a.minutes) || 10)),
      })).filter((a: { title: string }) => a.title);
      const lessons = await getLessons();
      lessons.unshift({ id: String(Date.now()), unit: String(body.unit ?? "").slice(0, 40), words, activities, createdAt: new Date().toISOString() });
      await db().set("meta", "lessons", { items: lessons.slice(0, 30) });
      await saveSettings({ ...settings, vocab: [...new Set([...settings.vocab, ...words])].slice(0, 60) });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "deleteLesson") {
      await db().set("meta", "lessons", { items: (await getLessons()).filter((l) => l.id !== String(body.id)) });
      await touch("other");
      return NextResponse.json({ ok: true });
    }

    // 학생별 누적 기록: 처음부터 지금까지의 마음 기록·응원·메모·쪽지·돌아보기·활동지 피드백(교사 화면은 34일만 들고 있음)
    if (body.action === "studentAll") {
      const no = Number(body.no);
      if (!Number.isInteger(no)) return bad("학생 번호가 필요해요.");
      const [records, cheers, notes, sent, got, reflects, runs, actions] = await Promise.all([
        recordsOf(no), db().find<Cheer>("cheers", "no", "==", no), db().find<Note>("notes", "no", "==", no),
        db().find<Letter>("letters", "from", "==", no), db().find<Letter>("letters", "to", "==", no),
        db().find<Reflect>("reflects", "no", "==", no), db().all<SheetRun>("sheets"), getRiskActions(),
      ]);
      const [rounds, selfs, drafts] = await Promise.all([getSelfRounds(), getSelfAnswers(), getRiskDrafts()]);
      const sheets = runs.flatMap((r) => r.items.filter((x) => x.no === no).map((x) => ({ ...x, runId: r.id, date: today(new Date(r.createdAt)) })));
      const byDate = <T extends { createdAt: string }>(xs: T[]) => xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return NextResponse.json({
        records: records.map(lean).sort((a, b) => a.id.localeCompare(b.id)),
        // 연습 학생에게 가던 쪽지(toPractice)는 같은 번호를 새로 받은 실제 학생이 받은 쪽지가 아니다(보낸 학생의 sent·위험 알림에는 남음)
        cheers: byDate(cheers), notes: byDate(notes), sent: byDate(sent), got: byDate(got.filter((l) => !l.toPractice)), reflects: byDate(reflects),
        sheets: sheets.sort((a, b) => b.date.localeCompare(a.date)),
        riskActions: actions.filter((x) => x.no === no),
        drafts: drafts.filter((x) => x.no === no), // 마치지 않은 위험 표현(살펴본 것 포함)
        self: rounds.flatMap((r) => selfs.filter((a) => a.round === r.id && a.no === no).map((a) => ({ round: r.id, title: r.title, openedAt: r.openedAt, answers: a.answers }))),
      });
    }

    // 활동지 피드백 회차: 목록(최근 20회) · 학생에게 줄 말 고치기 · 회차 지우기. 만들기는 /api/teacher/sheet
    if (body.action === "sheets") {
      const runs = (await db().all<SheetRun>("sheets")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
      return NextResponse.json({ runs });
    }
    if (body.action === "sheetEdit") {
      const run = await db().get<SheetRun>("sheets", String(body.id));
      if (!run) return bad("활동지 피드백을 찾지 못했어요.", 404);
      const items = run.items.map((x) => (x.no === Number(body.no) ? { ...x, toStudent: String(body.toStudent ?? "").slice(0, 400) } : x));
      await db().set("sheets", run.id, { ...run, items });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "sheetDelete") {
      await db().del("sheets", String(body.id));
      return NextResponse.json({ ok: true });
    }

    // 학급 사회·정서역량 진단: 회차 목록 · 저장(새로 또는 메모 고치기) · 지우기
    if (body.action === "selChecks") return NextResponse.json({ items: await getSelChecks() });

    // ── 기록 보관 기한: 지난 것 세기 / 선생님이 눌러 지우기(화면이 본 기준 날짜와 지금 기준이 같을 때만) ──
    // held: 기한 앞의 살펴보지 않은 위험 표현 알림 수(있으면 정리하지 않는다 — 먼저 살펴보게). counts와 따로 둔다(화면이 counts를 모두 더해 「모두 ○건」으로 보임).
    if (body.action === "retentionInfo") {
      const cutoff = await cutoffNow();
      return NextResponse.json({ cutoff, counts: await expiredCounts(cutoff), logs: await purgeLogs(), held: await heldRisks(cutoff) });
    }
    if (body.action === "purgeOld") {
      const cutoff = await cutoffNow();
      if (body.cutoff !== cutoff) return bad("보관 기한이 바뀌었어요. 화면을 다시 열어 확인해 주세요.", 409);
      const held = await heldRisks(cutoff);
      if (held) return NextResponse.json({ error: HELD_RISK(held), code: "heldRisk", held }, { status: 409 });
      const log = await purgeBefore(cutoff);
      return NextResponse.json({ cutoff, counts: await expiredCounts(cutoff), logs: await purgeLogs(), done: log, held: 0 });
    }

    // ── 학생 자기진단(마음 점검): 회차 열기·닫기·다시 열기·지우기. 열린 회차는 하나만, 학생 화면에 그 회차만 보인다 ──
    if (body.action === "selfChecks") {
      const [rounds, answers, sel] = await Promise.all([getSelfRounds(), getSelfAnswers(), getSelChecks()]);
      return NextResponse.json({ rounds, answers, sel });
    }
    // 회차 목록은 읽고 고쳐 쓰기를 한 번에(editSelfRounds): 두 기기에서 같은 순간 열어도 열린 회차가 둘이 되지 않는다
    if (["selfOpen", "selfClose", "selfReopen", "selfDelete"].includes(body.action)) {
      const id = String(body.id ?? "");
      const title = String(body.title ?? "").replace(/[<>]/g, "").trim().slice(0, 20);
      if (body.action === "selfOpen" && !title) return bad("회차 이름을 써 주세요.");
      const out: { err?: [string, number] } = {};
      await editSelfRounds((rounds) => {
        out.err = undefined;
        const open = rounds.find((r) => !r.closedAt);
        if ((body.action === "selfOpen" || body.action === "selfReopen") && open && open.id !== id) {
          out.err = [`「${open.title}」 회차가 열려 있어요. 먼저 닫아 주세요.`, 400];
          return undefined;
        }
        if (body.action === "selfOpen") {
          if (rounds.length >= SELF_ROUNDS_MAX) {
            out.err = [`자기진단 회차가 ${SELF_ROUNDS_MAX}개로 꽉 찼어요. 지난 회차를 지운 뒤 새로 열어 주세요.`, 409];
            return undefined;
          }
          const r: SelfRound = { id: `self${Date.now()}`, title, openedAt: today(), closedAt: null };
          return [...rounds, r];
        }
        if (!rounds.some((r) => r.id === id)) {
          out.err = ["회차를 찾지 못했어요.", 404];
          return undefined;
        }
        if (body.action === "selfDelete") return rounds.filter((r) => r.id !== id);
        return rounds.map((r) => (r.id === id ? { ...r, closedAt: body.action === "selfClose" ? today() : null } : r));
      });
      if (out.err) return bad(...out.err);
      if (body.action === "selfDelete") await deleteSelfAnswers((a) => a.round !== id); // 회차를 목록에서 뺀 뒤 답을 지운다(그사이 새 답이 남지 않게)
      return NextResponse.json({ rounds: await getSelfRounds(), answers: await getSelfAnswers() });
    }
    if (body.action === "selSave") {
      const c = cleanCheck(body.check);
      if (!c) return bad("20문항에 모두 답했는지, 날짜가 맞는지 확인해 주세요.");
      const items = await getSelChecks();
      const id = String(body.check?.id ?? "");
      const old = items.find((x) => x.id === id);
      const now = new Date().toISOString();
      // 체험 반에서 넣은 회차는 연습 표시를 붙인다(「처음 판으로」·「연습 데이터만 지우기」가 다음 사람에게 남기지 않게)
      const saved = old
        ? { ...old, ...c, updatedAt: now }
        : { ...c, id: `sel${Date.now().toString(36)}`, createdAt: now, ...(isDemo() ? { demo: true } : {}) };
      await saveSelChecks(old ? items.map((x) => (x.id === id ? saved : x)) : [...items, saved]);
      return NextResponse.json({ check: saved, items: await getSelChecks() });
    }
    if (body.action === "selDelete") {
      await saveSelChecks((await getSelChecks()).filter((x) => x.id !== String(body.id)));
      return NextResponse.json({ items: await getSelChecks() });
    }

    // 이번 주 우리 반 마음 요약 + 다음 주 활동 추천(이름·번호 없이 모은 숫자만 AI로)
    if (body.action === "weekly") {
      const ai = await aiConfig();
      if (!ai) return bad("AI 키가 있어야 요약을 만들 수 있어요.");
      const date = today();
      const weekStart = addDays(date, -6);
      const recs = await recordsFrom(addDays(date, -13));
      const stats = weekStats(recs.filter((r) => r.date >= weekStart), recs.filter((r) => r.date < weekStart), settings.rules, date);
      const lessonActivities = (await getLessons()).flatMap((l) => l.activities.map((a) => ({ ...a, unit: l.unit }))).slice(0, 12);
      try {
        const w = await weeklySummary(ai, stats, lessonActivities);
        const saved = { weekStart, createdAt: new Date().toISOString(), ...w };
        await db().set("meta", "weekly", saved);
        await touch("other");
        return NextResponse.json(saved);
      } catch (e) {
        return bad(`요약을 만들지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
      }
    }

    // 휴대폰 알림 받기(이 기기 등록·해제·시험)
    if (body.action === "subscribe") {
      if (!pushReady()) return bad("서버에 알림 키(VAPID)가 아직 없어요.");
      const sub = body.subscription;
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return bad("알림 등록 정보가 맞지 않아요.");
      await saveSub(sub, String(body.label ?? ""));
      return NextResponse.json({ ok: true, devices: await countSubs() });
    }
    if (body.action === "unsubscribe") {
      if (typeof body.endpoint === "string") await removeSub(body.endpoint);
      return NextResponse.json({ ok: true, devices: await countSubs() });
    }
    // 이 기기의 알림 주소가 이 학급 알림 목록에 지금 있나(브라우저 구독만 보면 다른 기기에서 비밀번호를 바꿔 빠진 뒤에도 「받는 중」으로 보임).
    // 체험에서는 알림을 받지 않으므로 늘 false.
    if (body.action === "pushHas") {
      if (typeof body.endpoint !== "string" || !body.endpoint) return bad("알림 주소가 없어요.");
      return NextResponse.json({ has: !isDemo() && (await hasSub(body.endpoint)) });
    }
    // 알림 받는 기기 모두 끄기(잃어버린 휴대폰 등): 이 학급에 등록된 알림 주소를 모두 지운다
    if (body.action === "pushClear") {
      const removed = await clearSubs();
      return NextResponse.json({ ok: true, removed, devices: await countSubs() });
    }
    if (body.action === "testPush") {
      const r = await notifyTeachers({ title: "마음빛 길잡이 알림 시험", body: "이 알림이 보이면 위험 표현 알림을 받을 수 있어요.", url: "/teacher", tag: "test" });
      return NextResponse.json(r);
    }

    // 시연 데이터 만들기 / 연습 데이터만 지우기 / 모두 지우기
    if (body.action === "demo") {
      // 체험 공간에서는 지우지 않고 언제나 처음 판으로 되돌린다(여러 사람이 함께 쓰는 공간이라).
      // 체험 안내의 「처음 판으로」와 같은 횟수 제한을 건다(모두 합쳐 10분에 한 번, IP마다 1분에 한 번).
      if (isDemo()) {
        const wait = await resetWait(clientIp(req.headers));
        if (wait) return bad(`체험 반은 조금 전에 처음 판으로 되돌렸어요. ${waitText(wait)} 뒤에 다시 해 주세요.`, 429);
      }
      const mode = isDemo() ? "seed" : body.mode;
      if (mode === "clearDemo") await clearPractice(); // 연습 표시가 붙은 것과 연습용 가짜 학생에게 매인 것만
      else if (mode === "seed") await seedPractice();
      else if (mode === "clear") {
        for (const col of ["records", "cheers", "notes", "letters", "reflects", "sheets"] as const) await db().clear(col);
        await db().del("meta", "looks");
        await db().del("meta", "selChecks");
        await db().del("meta", "riskActions");
        await deleteSelfAnswers(() => false);
        await db().del("meta", "selfRounds");
        await db().del("meta", "riskDrafts"); // 마치지 않은 위험 표현도(새 명단의 같은 번호 학생에게 붙지 않게)
        await db().del("meta", "weekly");
        await saveRoster([]);
        await saveSettings({ ...settings, checks: {} });
        await touch("wipe");
        await touch("records");
      } else return bad("알 수 없는 요청이에요."); // 이름이 틀린 요청으로 반 전체가 지워지지 않게
      return NextResponse.json({ ok: true });
    }

    return bad("알 수 없는 요청이에요.");
  } catch (e) {
    console.error(e);
    return bad(e instanceof Error ? e.message : "서버 오류", 500);
  }
}

// 키는 가려서만 보낸다
function publicSettings(s: Awaited<ReturnType<typeof getSettings>>) {
  const keys = Object.fromEntries(PROVIDER_IDS.map((p) => {
    const box = s.keys[p];
    const plain = box ? decrypt(box) : null;
    return [p, box ? (plain ? mask(plain) : "다시 입력 필요") : null];
  }));
  return { ...s, keys, checks: s.checks };
}

// 위험 표현 알림 닫기(살펴본 시각 적기). seen(선생님이 본 판)이 지금 글과 다르면 바꾸지 않는다 — 읽고 견주고 쓰기를 한 번에.
// ok = 닫음, stale = 그사이 학생이 새로 쓰거나 고침, missing = 그 글이 없어짐(마치지 않은 글이 기록이 됨 등)
async function closeAlert(kind: "record" | "reflect" | "draft" | "letter", key: string, seen: string | null, now: string): Promise<"ok" | "stale" | "missing"> {
  if (kind === "draft") return checkRiskDraft(key, seen);
  const out: { res: "ok" | "stale" | "missing" } = { res: "missing" };
  const check = <T,>(cur: T | null, at: (x: T) => string) => {
    out.res = !cur ? "missing" : seen && at(cur) !== seen ? "stale" : "ok";
    return out.res === "ok";
  };
  if (kind === "record") {
    await db().update<MoodRecord>("records", key, (cur) => (check(cur, (x) => x.riskAt ?? x.createdAt) ? { ...cur!, riskChecked: now, updatedAt: Date.now() } : undefined));
    if (out.res === "ok") await touch("records");
  } else if (kind === "reflect") {
    await db().update<Reflect>("reflects", key, (cur) => (check(cur, (x) => x.createdAt) ? { ...cur!, riskChecked: now } : undefined));
  } else {
    await db().update<Letter>("letters", key, (cur) => (check(cur, (x) => x.createdAt) ? { ...cur!, riskChecked: now } : undefined));
  }
  if (out.res === "ok" && kind !== "record") await touch("other");
  return out.res;
}
