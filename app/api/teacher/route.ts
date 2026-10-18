// 교사 API: 비밀번호 로그인 뒤에만 쓸 수 있다
import { NextResponse, type NextRequest } from "next/server";
import { cheer, ping } from "@/lib/ai";
import { TEACHER_COOKIE, TEACHER_HOURS, checkPassword, encrypt, decrypt, isTeacher, mask, newCode, teacherToken } from "@/lib/auth";
import { aiConfig, allRecords, getRoster, getSettings, parseRoster, saveRoster, saveSettings } from "@/lib/data";
import { addDays, today } from "@/lib/date";
import { db } from "@/lib/db";
import { demoRecords, demoStudents } from "@/lib/demo";
import { absentStudents, watchFlags } from "@/lib/rules";
import { PROVIDER_IDS, type Cheer, type MoodRecord, type Note, type Provider, type Rules } from "@/lib/shared";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 60) : null);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "login") {
      const r = checkPassword(String(body.password ?? ""));
      if (r.wait) return bad(`너무 많이 틀렸어요. ${r.wait}초 뒤에 다시 해 주세요.`, 429);
      if (!r.ok) return bad("비밀번호가 맞지 않아요.", 401);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(TEACHER_COOKIE, teacherToken(), {
        httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: TEACHER_HOURS * 3600, path: "/",
      });
      return res;
    }
    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(TEACHER_COOKIE);
      return res;
    }
    if (!isTeacher(req.cookies.get(TEACHER_COOKIE)?.value)) return bad("선생님 비밀번호를 입력해 주세요.", 401);

    const settings = await getSettings();

    if (body.action === "overview") {
      const date = today();
      const [students, records, cheers, notes] = await Promise.all([getRoster(), allRecords(), db().all<Cheer>("cheers"), db().all<Note>("notes")]);
      const recent = records.filter((r) => r.date >= addDays(date, -34)).map((r) => ({ ...r, voice: undefined }));
      const newest = <T extends { createdAt: string }>(xs: T[]) => xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return NextResponse.json({
        today: date,
        weekStart: addDays(date, -6),
        storage: db().kind,
        students,
        records: recent,
        flags: watchFlags(recent, date, settings.rules),
        absent: absentStudents(recent, students.map((s) => s.no), date, settings.rules.absentDays),
        cheers: newest(cheers).slice(0, 200),
        notes: newest(notes),
        settings: publicSettings(settings),
      });
    }

    // 기록 내보내기(전체). 화면에서 CSV로 만든다.
    if (body.action === "export") {
      return NextResponse.json({ records: (await allRecords()).map((r) => ({ ...r, voice: undefined })), students: await getRoster() });
    }

    // 면담 메모: 교사만 보고 AI에는 보내지 않는다
    if (body.action === "note") {
      const text = String(body.text ?? "").trim().slice(0, 1000);
      if (!text) return bad("메모가 비어 있어요.");
      const n: Note = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString() };
      await db().set("notes", n.id, { ...n });
      return NextResponse.json({ note: n });
    }
    if (body.action === "deleteNote") {
      await db().del("notes", String(body.id));
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
      await saveRoster(roster);
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
      const recs = (await allRecords()).filter((r) => r.no === no && r.date >= addDays(date, -13));
      if (!recs.length) return bad("최근 2주 기록이 없어요.");
      const signals = watchFlags(recs, date, settings.rules).find((f) => f.no === no)?.reasons ?? [];
      try {
        return NextResponse.json({ drafts: await cheer(ai, s.alias, recs, settings.vocab, signals, date) });
      } catch (e) {
        return bad(`초안을 만들지 못했어요: ${e instanceof Error ? e.message : e}`.slice(0, 300), 502);
      }
    }

    if (body.action === "saveCheer") {
      const text = String(body.text ?? "").trim().slice(0, 600);
      if (!text) return bad("내용이 비어 있어요.");
      const c: Cheer = { id: `${Date.now()}_${body.no}`, no: Number(body.no), text, createdAt: new Date().toISOString() };
      await db().set("cheers", c.id, { ...c });
      return NextResponse.json({ cheer: c });
    }

    if (body.action === "checkFlag") {
      const next = { ...settings, checks: { ...settings.checks, [String(body.key)]: new Date().toISOString() } };
      await saveSettings(next);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "checkAlert") {
      const r = await db().get<MoodRecord>("records", String(body.id));
      if (!r) return bad("기록이 없어요.");
      await db().set("records", r.id, { ...r, riskChecked: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "demo") {
      await db().clear("records");
      await db().clear("cheers");
      await db().clear("notes");
      if (body.mode === "seed") {
        const taken = new Set<string>();
        await saveRoster(demoStudents(() => {
          const c = newCode(taken);
          taken.add(c);
          return c;
        }));
        for (const r of demoRecords(today())) await db().set("records", r.id, { ...r });
      } else {
        await saveRoster([]);
      }
      await saveSettings({ ...settings, checks: {} });
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
