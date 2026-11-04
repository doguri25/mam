// 교사 API: 비밀번호 로그인 뒤에만 쓸 수 있다
import { NextResponse, after, type NextRequest } from "next/server";
import { cheer, ping, referralDraft, translateNotice, weeklySummary } from "@/lib/ai";
import { SELF_ROUNDS_MAX, addRiskAction, deleteRiskAction, editSelfRounds, noteTeacherLogin, setConsent } from "@/lib/data";
import { clientIp, passwordAttempt, resetWait, trialEditWait, waitText } from "@/lib/limit";
import { clearSubs } from "@/lib/push";
import { TEACHER_COOKIE, TEACHER_HOURS, checkPassword, encrypt, decrypt, isTeacher, makePin, mask, newCode, teacherSpace, teacherToken, validPin } from "@/lib/auth";
import {
  DEMO_AI_PER_DAY, SHARED_AI_PER_DAY, accountName, aiConfig, hasSharedAi, sharedAiUsed, allRecords, createAccount, demoAiUsed, demoProvider, findAccount, trialAiSource, getLessons, getSelChecks, saveSelChecks, getRiskActions, getRiskDrafts, checkRiskDraft, getSelfRounds, getSelfAnswers, deleteSelfAnswers, cutoffNow, expiredCounts, purgeBefore, purgeLogs, getLooks, getPin, getRoster, getSettings, getStamp, readRoster, purgePractice, clearPractice, recordsChangedAfter, recordsFrom, recordsOf,
  rosterIsDemo, savePin, saveRoster, saveSettings, seedPractice, touch,
} from "@/lib/data";
import { addDays, monday, slotNow, today } from "@/lib/date";
import { db, inSpace, isDemo, spaceId } from "@/lib/db";
import { countSubs, notifyTeachers, pushPublicKey, pushReady, removeSub, saveSub } from "@/lib/push";
import { classWeather, watchFlags, weekStats } from "@/lib/rules";
import { isLang } from "@/lib/i18n";
import { cleanCheck } from "@/lib/selcheck";
import type { SelfRound } from "@/lib/selfcheck";
import { cutoffOf, isRetention } from "@/lib/retention";
import { CALM_KO, FELT_KO, PROVIDER_IDS, riskKinds, type Cheer, type Letter, type MoodRecord, type Note, type Provider, type Reflect, type RiskAction, type Rules, type SheetRun } from "@/lib/shared";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60) : null);
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
const tooMany = (wait: number) => bad(`너무 많이 틀렸어요. ${waitText(wait)} 뒤에 다시 해 주세요.`, 429);

async function handle(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
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

    if (body.action === "overview") {
      const date = today();
      const stamp = await getStamp();
      const from = addDays(date, -DAYS);
      // 교사 기기에 기록을 저장해 두었으면(같은 저장 공간, 그 뒤 지운 적 없음) 그 뒤에 바뀐 기록만 읽는다 → 읽기량을 크게 줄임
      const partial = Number(body.since) > 0 && body.prefix === db().prefix && Number(body.wipe ?? 0) === (stamp.wipe ?? 0);
      const recordsP = partial ? recordsChangedAfter(Number(body.since)).then((rs) => rs.filter((r) => r.date >= from)) : recordsFrom(from);
      const [students, records, cheers, notes, demo, subs, lessons, weekly, looks, letters, recentReflects, riskyReflects, aiUsed, riskActions, drafts] = await Promise.all([
        getRoster(), recordsP, db().all<Cheer>("cheers"), db().all<Note>("notes"), rosterIsDemo(), countSubs(),
        getLessons(), db().get<{ weekStart: string }>("meta", "weekly"), getLooks(),
        db().all<Letter>("letters"), db().find<Reflect>("reflects", "weekStart", ">=", addDays(monday(date), -7)),
        db().find<Reflect>("reflects", "risk", "==", true), isDemo() ? demoAiUsed() : 0,
        getRiskActions(), getRiskDrafts(),
      ]);
      // 위험 표현이 있는 돌아보기는 오래돼도 선생님이 살펴볼 때까지 보낸다
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
        riskDrafts: drafts.filter((x) => !x.checked), // 학생이 기록을 마치지 않고 나간 위험 표현
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
      const l = await db().get<Letter>("letters", String(body.id));
      if (!l || !["ok", "no"].includes(body.status)) return bad("쪽지를 찾지 못했어요.", 404);
      const text = typeof body.text === "string" && body.text.trim().length >= 2 ? body.text.trim().slice(0, 120) : l.text;
      await db().set("letters", l.id, { ...l, text, status: body.status, checkedAt: new Date().toISOString() });
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
      return NextResponse.json({ records: (await allRecords()).map(lean), students: await getRoster() });
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

    if (isDemo() && (body.action === "roster" || body.action === "newCode")) {
      const wait = await trialEditWait(clientIp(req.headers));
      if (wait) return bad(`체험 반에서는 잠시 뒤에 다시 바꿔 주세요(${waitText(wait)}).`, 429);
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
      return NextResponse.json({ students: await saveRoster(roster, await rosterIsDemo()) });
    }

    if (body.action === "settings") {
      const next = { ...settings, keys: { ...settings.keys }, models: { ...settings.models } };
      if (PROVIDER_IDS.includes(body.provider)) next.provider = body.provider;
      if (typeof body.className === "string" && body.className.trim()) next.className = body.className.trim().slice(0, 20);
      for (const p of PROVIDER_IDS) {
        const m = body.models?.[p];
        if (typeof m === "string" && m.trim()) next.models[p] = m.trim().slice(0, 80);
        const k = isDemo() ? undefined : body.keys?.[p]; // 체험에서는 키를 바꾸지 않는다
        if (k === "") delete next.keys[p]; // 빈 글자 = 지우기, 안 보내면 그대로
        else if (typeof k === "string" && k.trim()) next.keys[p] = encrypt(k.trim());
      }
      next.vocab = strList(body.vocab) ?? next.vocab;
      next.riskWords = strList(body.riskWords) ?? next.riskWords;
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

    if (body.action === "checkFlag") {
      await saveSettings({ ...settings, checks: { ...settings.checks, [String(body.key)]: new Date().toISOString() } });
      return NextResponse.json({ ok: true });
    }

    // 위험 표현 「살펴봤어요」: 무엇을 했는지(여럿 고름)·한 날·짧은 메모를 조치 기록에 남기고 알림을 닫는다.
    // 그 뒤에 더 한 일(보호자 연락 등)은 riskAction으로 같은 기록에 이어 적는다. 메모는 AI에 보내지 않는다.
    if (body.action === "checkAlert" || body.action === "riskAction") {
      const kinds = riskKinds(body.kinds);
      if (!kinds.length) return bad("한 일을 하나 이상 골라 주세요.");
      // 무엇을 살펴봤나: 마음 기록(기본) · 「reflect:」 한 주 돌아보기 · 「draft:」 마치지 않은 위험 표현
      const id = String(body.action === "checkAlert" ? body.id : body.recordId);
      const items = await getRiskActions();
      const reflectId = id.startsWith("reflect:") ? id.slice(8) : null;
      const draftId = id.startsWith("draft:") ? id.slice(6) : null;
      const r = reflectId || draftId ? null : await db().get<MoodRecord>("records", id);
      const ref = reflectId ? await db().get<Reflect>("reflects", reflectId) : null;
      const before = items.find((x) => x.recordId === id); // 보관 기한이 지나 기록을 지운 뒤에도 이어 적을 수 있게
      const d = draftId ? (await getRiskDrafts()).find((x) => x.id === draftId) : undefined;
      const who = r ?? ref ?? d ?? before;
      if (!who) return bad("기록이 없어요.");
      const now = new Date().toISOString();
      if (body.action === "checkAlert") {
        if (r) {
          // 선생님이 본 그 기록일 때만 닫는다. 그사이 학생이 같은 칸에 새로 남겼으면(위험한 말일 수도) 닫지 않고 다시 보게 한다.
          const seen = typeof body.seen === "string" ? body.seen : null;
          let stale = false;
          await db().update<MoodRecord>("records", id, (cur) => {
            if (!cur) return undefined;
            if (seen && cur.createdAt !== seen) {
              stale = true;
              return undefined;
            }
            return { ...cur, riskChecked: now, updatedAt: Date.now() };
          });
          if (stale) return bad("학생이 그사이 같은 칸에 새로 남긴 기록이 있어요. 새 글을 먼저 읽어 주세요.", 409);
          await touch("records");
        } else if (ref) {
          await db().update<Reflect>("reflects", reflectId!, (cur) => (cur ? { ...cur, riskChecked: now } : undefined));
          await touch("other");
        } else if (d) await checkRiskDraft(d.id);
      }
      const recordDate = r?.date ?? (ref ? today(new Date(ref.createdAt)) : undefined) ?? d?.date ?? before!.recordDate;
      const act: RiskAction = {
        id: `${Date.now()}_${who.no}`, no: who.no, recordId: id, recordDate,
        date: isDay(body.date) && body.date <= today() ? body.date : today(), kinds, note: String(body.note ?? "").trim().slice(0, 300),
        createdAt: now,
        // 연습(시연) 기록에 대한 조치면 연습 표시 → 「연습 데이터만 지우기」가 함께 지운다
        ...(who.demo ? { demo: true } : {}),
      };
      await addRiskAction(act); // 목록을 읽고 고쳐 쓰기를 한 번에(두 기기에서 같은 순간 적어도 둘 다 남음)
      return NextResponse.json({ ok: true, riskActions: await getRiskActions() });
    }
    if (body.action === "riskActionDelete") {
      await deleteRiskAction(String(body.id));
      return NextResponse.json({ ok: true, riskActions: await getRiskActions() });
    }

    // 교과서에서 고른 감정 단어·활동 저장 → 반 감정 단어에 더하고, 활동은 주간 추천 후보로
    if (body.action === "saveLesson") {
      const words = (Array.isArray(body.words) ? body.words : []).map((x: { word?: unknown }) => String(x.word ?? "").trim().slice(0, 12)).filter(Boolean).slice(0, 12);
      const activities = (Array.isArray(body.activities) ? body.activities : []).slice(0, 6).map((a: { title?: unknown; how?: unknown; minutes?: unknown }) => ({
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
      const [rounds, selfs] = await Promise.all([getSelfRounds(), getSelfAnswers()]);
      const sheets = runs.flatMap((r) => r.items.filter((x) => x.no === no).map((x) => ({ ...x, runId: r.id, date: today(new Date(r.createdAt)) })));
      const byDate = <T extends { createdAt: string }>(xs: T[]) => xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return NextResponse.json({
        records: records.map(lean).sort((a, b) => a.id.localeCompare(b.id)),
        cheers: byDate(cheers), notes: byDate(notes), sent: byDate(sent), got: byDate(got), reflects: byDate(reflects),
        sheets: sheets.sort((a, b) => b.date.localeCompare(a.date)),
        riskActions: actions.filter((x) => x.no === no),
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
    if (body.action === "retentionInfo") {
      const cutoff = await cutoffNow();
      return NextResponse.json({ cutoff, counts: await expiredCounts(cutoff), logs: await purgeLogs() });
    }
    if (body.action === "purgeOld") {
      const cutoff = await cutoffNow();
      if (body.cutoff !== cutoff) return bad("보관 기한이 바뀌었어요. 화면을 다시 열어 확인해 주세요.", 409);
      const log = await purgeBefore(cutoff);
      return NextResponse.json({ cutoff, counts: await expiredCounts(cutoff), logs: await purgeLogs(), done: log });
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
      const saved = old ? { ...old, ...c, updatedAt: now } : { ...c, id: `sel${Date.now().toString(36)}`, createdAt: now };
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
