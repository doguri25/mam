// 교사 API: 비밀번호 로그인 뒤에만 쓸 수 있다
import { NextResponse, type NextRequest } from "next/server";
import { cheer, ping, weeklySummary } from "@/lib/ai";
import { TEACHER_COOKIE, TEACHER_HOURS, checkPassword, encrypt, decrypt, isTeacher, makePin, mask, newCode, teacherToken, validPin } from "@/lib/auth";
import {
  aiConfig, allRecords, getLessons, getLooks, getPin, getRoster, getSettings, getStamp, parseRoster, putRecord, recordsChangedAfter, recordsFrom, recordsOf,
  rosterIsDemo, saveLooks, savePin, saveRoster, saveSettings, touch,
} from "@/lib/data";
import { addDays, today } from "@/lib/date";
import { db } from "@/lib/db";
import { demoLooks, demoRecords, demoStudents } from "@/lib/demo";
import { countSubs, notifyTeachers, pushPublicKey, pushReady, removeSub, saveSub } from "@/lib/push";
import { watchFlags, weekStats } from "@/lib/rules";
import { PROVIDER_IDS, type Cheer, type MoodRecord, type Note, type Provider, type Rules } from "@/lib/shared";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60) : null);
const lean = (r: MoodRecord) => ({ ...r, voice: undefined }); // 목소리 숫자는 화면에 필요 없음
const DAYS = 34; // 교사 화면이 들고 있는 기록 범위(월간 그래프 30일 + 여유)

function withTeacherCookie(v: number) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, teacherToken(v), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: TEACHER_HOURS * 3600, path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(TEACHER_COOKIE);
      return res;
    }
    const pin = await getPin();
    if (body.action === "login") {
      const r = checkPassword(String(body.password ?? ""), pin);
      if (r.wait) return bad(`너무 많이 틀렸어요. ${r.wait}초 뒤에 다시 해 주세요.`, 429);
      if (!r.ok) return bad("비밀번호가 맞지 않아요.", 401);
      return withTeacherCookie(pin?.v ?? 0);
    }
    if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value, pin?.v ?? 0)) return bad("선생님 비밀번호를 입력해 주세요.", 401);

    // 비밀번호 바꾸기: 지금 비밀번호를 확인하고, 바꾼 기기만 계속 열려 있게 새 표를 준다
    if (body.action === "changePin") {
      const next = String(body.next ?? "");
      if (!validPin(next)) return bad("새 비밀번호는 숫자 4~12자리로 해 주세요.");
      const r = checkPassword(String(body.current ?? ""), pin);
      if (r.wait) return bad(`너무 많이 틀렸어요. ${r.wait}초 뒤에 다시 해 주세요.`, 429);
      if (!r.ok) return bad("지금 비밀번호가 맞지 않아요.", 401);
      const np = makePin(next, (pin?.v ?? 0) + 1);
      await savePin(np);
      return withTeacherCookie(np.v);
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
      const [students, records, cheers, notes, demo, subs, lessons, weekly, looks] = await Promise.all([
        getRoster(), recordsP, db().all<Cheer>("cheers"), db().all<Note>("notes"), rosterIsDemo(), countSubs(),
        getLessons(), db().get<{ weekStart: string }>("meta", "weekly"), getLooks(),
      ]);
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
        settings: publicSettings(settings),
      });
    }

    // 기록 내보내기(전체). 화면에서 CSV로 만든다.
    if (body.action === "export") {
      return NextResponse.json({ records: (await allRecords()).map(lean), students: await getRoster() });
    }

    // 면담 메모: 교사만 보고 AI에는 보내지 않는다
    if (body.action === "note") {
      const text = String(body.text ?? "").trim().slice(0, 1000);
      if (!text) return bad("메모가 비어 있어요.");
      const n: Note = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString() };
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
      const students = parseRoster(String(body.text ?? ""), await getRoster());
      if (!students.length) return bad("「번호 가명」 모양으로 한 줄에 한 명씩 적어 주세요.");
      await saveRoster(students);
      return NextResponse.json({ students });
    }

    if (body.action === "newCode") {
      const roster = await getRoster();
      const s = roster.find((x) => x.no === Number(body.no));
      if (!s) return bad("없는 번호예요.");
      s.code = newCode(new Set(roster.map((x) => x.code)));
      await saveRoster(roster, await rosterIsDemo());
      return NextResponse.json({ students: roster });
    }

    if (body.action === "settings") {
      const next = { ...settings, keys: { ...settings.keys }, models: { ...settings.models } };
      if (PROVIDER_IDS.includes(body.provider)) next.provider = body.provider;
      if (typeof body.className === "string" && body.className.trim()) next.className = body.className.trim().slice(0, 20);
      for (const p of PROVIDER_IDS) {
        const m = body.models?.[p];
        if (typeof m === "string" && m.trim()) next.models[p] = m.trim().slice(0, 80);
        const k = body.keys?.[p];
        if (k === "") delete next.keys[p]; // 빈 글자 = 지우기, 안 보내면 그대로
        else if (typeof k === "string" && k.trim()) next.keys[p] = encrypt(k.trim());
      }
      next.vocab = strList(body.vocab) ?? next.vocab;
      next.riskWords = strList(body.riskWords) ?? next.riskWords;
      if (["off", "device", "gemini"].includes(body.voiceMode)) next.voiceMode = body.voiceMode;
      if (body.rules && typeof body.rules === "object") {
        const n = (k: keyof Rules, max: number) => Math.min(max, Math.max(1, Math.round(Number(body.rules[k]) || next.rules[k])));
        next.rules = { streakDays: n("streakDays", 7), dropDays: n("dropDays", 7), reasonTimes: n("reasonTimes", 14), absentDays: n("absentDays", 10) };
      }
      await saveSettings(next);
      return NextResponse.json({ settings: publicSettings(next) });
    }

    if (body.action === "testAI") {
      const ai = await aiConfig(body.provider as Provider);
      if (!ai) return bad("이 AI의 키가 아직 없어요.");
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
      const c: Cheer = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString() };
      await db().set("cheers", c.id, { ...c });
      await touch("other");
      return NextResponse.json({ cheer: c });
    }

    if (body.action === "checkFlag") {
      await saveSettings({ ...settings, checks: { ...settings.checks, [String(body.key)]: new Date().toISOString() } });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "checkAlert") {
      const r = await db().get<MoodRecord>("records", String(body.id));
      if (!r) return bad("기록이 없어요.");
      await putRecord({ ...r, riskChecked: new Date().toISOString() });
      return NextResponse.json({ ok: true });
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
    if (body.action === "testPush") {
      const r = await notifyTeachers({ title: "마음빛 길잡이 알림 시험", body: "이 알림이 보이면 위험 표현 알림을 받을 수 있어요.", url: "/teacher", tag: "test" });
      return NextResponse.json(r);
    }

    // 시연 데이터 만들기 / 연습 데이터만 지우기 / 모두 지우기
    if (body.action === "demo") {
      const mode = body.mode;
      if (mode === "clearDemo") {
        // 연습 기록(demo 표시)만 지운다. 연습용 명단이면 명단·응원·메모도 함께.
        const demoRecs = await db().find<MoodRecord>("records", "demo", "==", true);
        for (const r of demoRecs) await db().del("records", r.id);
        if (await rosterIsDemo()) {
          await db().clear("cheers");
          await db().clear("notes");
          await db().del("meta", "looks");
          await saveRoster([]);
        }
      } else {
        await db().clear("records");
        await db().clear("cheers");
        await db().clear("notes");
        await db().del("meta", "looks");
        if (mode === "seed") {
          await saveLooks(demoLooks());
          const taken = new Set<string>();
          await saveRoster(demoStudents(() => {
            const c = newCode(taken);
            taken.add(c);
            return c;
          }), true);
          const now = Date.now();
          for (const r of demoRecords(today())) await db().set("records", r.id, { ...r, updatedAt: now });
        } else {
          await saveRoster([]);
        }
      }
      await saveSettings({ ...settings, checks: {} });
      await touch("wipe"); // 기록을 지웠으니 교사 기기에 저장해 둔 기록도 버리게
      await touch("records");
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
