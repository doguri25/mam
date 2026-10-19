// 학생 API: 코드 로그인, 내 기록, AI 정리(말투 포함), 저장(끊김 대비 포함), 마음 다스리기, 꾸미기,
// 공감 쪽지, 한 주 돌아보기, 반 감정 단어 사전. 요청 전체가 그 학생의 학급 공간에서 돈다(로그인은 코드로 학급을 찾음).
import { NextResponse, after, type NextRequest } from "next/server";
import { analyze, analyzeWithAudio, fallbackQuestion, reflectReply, type Analysis } from "@/lib/ai";
import { RISK_REPLY, isLang, t, type Lang } from "@/lib/i18n";
import { DEMO_COOKIE, STUDENT_COOKIE, queueToken, readQueueToken, sign, unsign } from "@/lib/auth";
import { aiConfig, getLooks, getRoster, getSettings, locateCode, putRecord, rawKey, recordsFrom, recordsOf, saveLooks, touch, type Settings } from "@/lib/data";
import { addDays, monday, slotNow, today } from "@/lib/date";
import { db, inSpace, isDemo, spaceId } from "@/lib/db";
import { notifyTeachers } from "@/lib/push";
import { matchRisk } from "@/lib/rules";
import {
  ACC_UNLOCK, CALM_TOOLS, DEFAULT_LOOK, EMOTION_NAMES, FELT, NUANCE, REASON_NAMES, TONES, cleanLook,
  type CalmTool, type Felt, type Letter, type MoodRecord, type Reflect, type Student,
} from "@/lib/shared";
import { baseline, cleanFeatures, toneOf } from "@/lib/tone";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const MAX_AUDIO = 900_000; // base64 글자 수(16kHz 모노 15초 ≈ 64만)
const LETTERS_PER_DAY = 5;

async function me(req: NextRequest): Promise<Student | null> {
  const v = unsign(req.cookies.get(STUDENT_COOKIE)?.value);
  if (!v) return null;
  const [no, code] = v.split(":");
  // 교사가 코드를 새로 만들면 예전 코드로 들어온 기기는 자동으로 나가진다
  return (await getRoster()).find((s) => s.no === Number(no) && s.code === code) ?? null;
}

// 선생님 휴대폰 알림(응답은 기다리지 않게 뒤에서). 번호만 보내고 이름·글은 보내지 않는다. 체험 공간에서는 보내지 않는다.
function alertTeacher(no: number, what: string, tag: string) {
  if (isDemo()) return;
  after(() => notifyTeachers({ title: "⚠️ 바로 살펴봐 주세요", body: `${no}번 학생 ${what}에 위험 표현이 있어요. 선생님 화면에서 확인해 주세요.`, url: "/teacher", tag }));
}

const wordsOf = (rs: MoodRecord[]) => [...new Set(rs.map((r) => r.word).filter((w): w is string => !!w))];

export async function POST(req: NextRequest) {
  // 화면은 늘 JSON으로 보낸다. 다른 사이트의 form으로 몰래 로그인시켜 엉뚱한 학급에 쓰게 하는 것(로그인 CSRF)을 막는다.
  if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "요청이 올바르지 않아요." }, { status: 415 });
  const body = await req.json().catch(() => ({}));
  return inSpace(await studentSpace(req, body), () => handle(req, body));
}

// 학생 쿠키 「번호:코드:공간」. 로그인은 코드 색인으로, 끊김 기록은 qtoken에 적힌 공간으로.
type Body = Awaited<ReturnType<NextRequest["json"]>>; // 요청 몸(any) — 동작마다 아래에서 걸러 쓴다
async function studentSpace(req: NextRequest, body: Body) {
  if (body.action === "login") return (await locateCode(String(body.code ?? "").trim().toUpperCase())) ?? "";
  if (body.action === "saveQueued") return readQueueToken(body.qtoken)?.space ?? "";
  const parts = unsign(req.cookies.get(STUDENT_COOKIE)?.value)?.split(":") ?? [];
  if (parts.length >= 3) return parts[2];
  return req.cookies.get(DEMO_COOKIE)?.value === "1" ? "demo" : ""; // 공간이 적히기 전 쿠키
}

async function handle(req: NextRequest, body: Body) {
  try {
    if (body.action === "login") {
      const code = String(body.code ?? "").trim().toUpperCase();
      const s = (await getRoster()).find((x) => x.code === code);
      if (!s) return bad("코드를 다시 확인해 주세요.", 401);
      // qtoken: 와이파이가 끊겨 기기에 담아 둔 오늘 기록을, 다른 친구가 들어온 뒤에도 보낼 수 있게
      const res = NextResponse.json({ no: s.no, alias: s.alias, qtoken: queueToken(s.no, s.code, today()) });
      res.cookies.set(STUDENT_COOKIE, sign(`${s.no}:${s.code}:${spaceId()}`), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/",
      });
      return res;
    }
    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(STUDENT_COOKIE);
      return res;
    }

    // 끊겼을 때 담아 둔 기록 보내기: 로그인 쿠키 대신 그날의 qtoken으로
    if (body.action === "saveQueued") {
      const q = readQueueToken(body.qtoken);
      if (!q || q.date !== today()) return bad("그날 안에 보내지 못한 기록이에요.", 410);
      const s = (await getRoster()).find((x) => x.no === q.no && x.code === q.code);
      if (!s) return bad("학생 코드가 바뀌었어요.", 410);
      return saveRecord(s, body.record ?? {}, await getSettings());
    }

    const s = await me(req);
    if (!s) return bad("다시 들어와 주세요.", 401);
    const settings = await getSettings();

    if (body.action === "me") {
      const date = today();
      const week = monday(date);
      const [mine, looks, inbox, ref] = await Promise.all([
        recordsOf(s.no), getLooks(), db().find<Letter>("letters", "to", "==", s.no), db().get<Reflect>("reflects", `${s.no}_${week}`),
      ]);
      // 마음 꽃: 이번 달 기록한 날마다 한 송이(그날 마지막 마음 색)
      const month = new Map<string, string>();
      for (const r of mine.filter((r) => r.date.startsWith(date.slice(0, 7))).sort((a, b) => a.id.localeCompare(b.id))) month.set(r.date, r.emotion);
      return NextResponse.json({
        no: s.no, alias: s.alias, className: settings.className, vocab: settings.vocab, voiceMode: settings.voiceMode,
        slot: slotNow(), today: date, records: mine.filter((r) => r.date === date).map(publicRecord),
        flowers: [...month].map(([d, emotion]) => ({ date: d, emotion })),
        look: looks[s.no] ?? DEFAULT_LOOK,
        words: wordsOf(mine), // 마음 친구 성장: 써 본 서로 다른 감정 단어
        unread: inbox.filter((l) => l.status === "ok" && !l.readAt).length,
        reflected: !!ref,
        demo: isDemo(),
      });
    }

    // 마음 다스리기 도구를 써 본 느낌을 이 시간의 기록에 붙인다(선생님이 어떤 도구가 도움이 되는지 보게)
    if (body.action === "calm") {
      const tool = body.tool as CalmTool, felt = body.felt as Felt;
      if (!CALM_TOOLS.includes(tool) || !FELT.includes(felt) || !["am", "pm"].includes(body.slot)) return bad("모양이 맞지 않아요.");
      const rec = (await recordsOf(s.no)).find((r) => r.id === `${s.no}_${today()}_${body.slot}`);
      if (!rec) return bad("먼저 마음을 남겨 주세요.", 404);
      const next = { ...rec, calm: [...(rec.calm ?? []), { tool, felt, at: new Date().toISOString() }].slice(-10) };
      await putRecord(next);
      return NextResponse.json({ record: publicRecord(next) });
    }

    // 내 마음 친구 꾸미기. 꾸미개는 써 본 감정 단어 수만큼 열린다(이미 쓰고 있던 것은 그대로 둠).
    // ponytail: 문서 하나를 읽고 고쳐 쓰므로 두 학생이 같은 순간 저장하면 한쪽이 묻힐 수 있다. 반 하나·태블릿 돌려쓰기면 충분.
    if (body.action === "look") {
      const look = cleanLook(body.look);
      const looks = await getLooks();
      const n = wordsOf(await recordsOf(s.no)).length;
      if (ACC_UNLOCK[look.acc] > n && looks[s.no]?.acc !== look.acc) return bad("아직 열리지 않은 꾸미개예요.");
      await saveLooks({ ...looks, [s.no]: look });
      return NextResponse.json({ look });
    }

    if (body.action === "records") {
      const month = String(body.month ?? today().slice(0, 7));
      const mine = (await recordsOf(s.no)).filter((r) => r.date.startsWith(month));
      return NextResponse.json({ records: mine.map(publicRecord) });
    }

    // ── 공감 쪽지 ──
    if (body.action === "classmates") {
      return NextResponse.json({ friends: (await getRoster()).filter((x) => x.no !== s.no).map((x) => ({ no: x.no, alias: x.alias })) });
    }
    if (body.action === "letter") {
      const to = Number(body.to);
      const text = String(body.text ?? "").trim().slice(0, 120);
      if (to === s.no || !(await getRoster()).some((x) => x.no === to) || text.length < 2) return bad("받는 친구와 쪽지 내용을 확인해 주세요.");
      const date = today();
      const sentToday = (await db().find<Letter>("letters", "from", "==", s.no)).filter((l) => today(new Date(l.createdAt)) === date).length;
      if (sentToday >= LETTERS_PER_DAY) return bad(`쪽지는 하루에 ${LETTERS_PER_DAY}통까지 보낼 수 있어요.`, 429);
      const risk = matchRisk(text, settings.riskWords).length > 0;
      const letter: Letter = {
        id: `${s.no}_${Date.now()}`, from: s.no, to, text, showName: body.showName !== false, status: "wait",
        createdAt: new Date().toISOString(), risk, lang: isLang(body.lang) ? body.lang : "ko", ...(isDemo() ? { demo: true } : {}),
      };
      await db().set("letters", letter.id, { ...letter });
      await touch("other"); // 선생님 화면에 「허락 기다리는 쪽지」가 바로 보이게
      if (risk) alertTeacher(s.no, "공감 쪽지", `letter-${letter.id}`);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "letters") {
      const [inbox, sent, roster] = await Promise.all([
        db().find<Letter>("letters", "to", "==", s.no), db().find<Letter>("letters", "from", "==", s.no), getRoster(),
      ]);
      const name = (no: number) => `${no}번 ${roster.find((x) => x.no === no)?.alias ?? ""}`.trim();
      const newest = (a: Letter, b: Letter) => b.createdAt.localeCompare(a.createdAt);
      return NextResponse.json({
        inbox: inbox.filter((l) => l.status === "ok").sort(newest).map((l) => ({
          id: l.id, text: l.text, from: l.showName ? name(l.from) : null, at: l.checkedAt ?? l.createdAt, read: !!l.readAt,
        })),
        sent: sent.sort(newest).slice(0, 20).map((l) => ({ id: l.id, text: l.text, to: name(l.to), status: l.status, at: l.createdAt })),
      });
    }
    if (body.action === "readLetter") {
      const l = await db().get<Letter>("letters", String(body.id));
      if (l && l.to === s.no && !l.readAt) await db().set("letters", l.id, { ...l, readAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    // ── 한 주 돌아보기(월요일부터 오늘까지) ──
    if (body.action === "week") {
      const date = today();
      const ws = monday(date);
      const [mine, ref] = await Promise.all([recordsOf(s.no), db().get<Reflect>("reflects", `${s.no}_${ws}`)]);
      return NextResponse.json({
        weekStart: ws, today: date, records: mine.filter((r) => r.date >= ws).map(publicRecord),
        reflect: ref ? { text: ref.text, reply: ref.reply } : null,
      });
    }
    if (body.action === "reflect") {
      const text = String(body.text ?? "").trim().slice(0, 100);
      const lang: Lang = isLang(body.lang) ? body.lang : "ko";
      if (text.length < 2) return bad("한 줄을 적어 주세요.");
      const ws = monday(today());
      const week = (await recordsOf(s.no)).filter((r) => r.date >= ws);
      const risk = matchRisk(text, settings.riskWords).length > 0;
      let reply = t(lang, "reflectThanks");
      if (risk) {
        reply = RISK_REPLY[lang];
        alertTeacher(s.no, "한 주 돌아보기", `reflect-${s.no}-${ws}`);
      } else {
        const ai = await aiConfig();
        if (ai) {
          try {
            reply = await reflectReply(ai, { lang, text, week: week.map((r) => ({ emotion: r.emotion, word: r.word })) });
          } catch (e) {
            console.error("돌아보기 답 실패", e);
          }
        }
      }
      const ref: Reflect = { id: `${s.no}_${ws}`, no: s.no, weekStart: ws, text, reply, createdAt: new Date().toISOString(), lang, risk, ...(isDemo() ? { demo: true } : {}) };
      await db().set("reflects", ref.id, { ...ref });
      await touch("other");
      return NextResponse.json({ reply });
    }

    // ── 반 감정 단어 사전: 최근 두 달 우리 반이 쓴 감정 단어 수(이름·번호 없이) ──
    if (body.action === "dictionary") {
      const [recent, mine] = await Promise.all([recordsFrom(addDays(today(), -60)), recordsOf(s.no)]);
      const counts: Record<string, number> = {};
      for (const r of recent) if (r.word) counts[r.word] = (counts[r.word] ?? 0) + 1;
      return NextResponse.json({ counts, mine: wordsOf(mine), vocab: settings.vocab });
    }

    if (body.action === "analyze") {
      const text = typeof body.text === "string" ? body.text.trim().slice(0, 180) : "";
      const card = body.card && validCard(body.card) ? body.card : undefined;
      const lang: Lang = isLang(body.lang) ? body.lang : "ko";
      if (!text && !card) return bad("카드나 문장이 필요해요.");

      // 말투: 이 학생의 평소 목소리(이전 말하기 기록)와 비교
      const features = settings.voiceMode === "off" ? null : cleanFeatures(body.voice);
      let tone: { tone: string; why: string; by: "device" | "gemini" } | null = null;
      if (features) {
        const history = (await recordsOf(s.no)).filter((r) => r.voice).map((r) => r.voice!);
        const tn = toneOf(features, baseline(history));
        if (tn) tone = { tone: tn.tone, why: tn.why, by: "device" };
      }

      const ruleRisk = matchRisk(text, settings.riskWords).length > 0;
      // 위험한 마음이면 되묻지 않고 고맙다는 말만 남긴 채 바로 저장(skipAsk)
      const finish = (r: Analysis, ai: boolean) => {
        const out = { ...r, ai, tone: tone?.tone ?? null, toneWhy: tone?.why ?? "", toneBy: tone?.by ?? null, voice: features };
        return NextResponse.json(r.risk || ruleRisk ? { ...out, risk: true, question: RISK_REPLY[lang], options: [], skipAsk: true } : out);
      };
      const input = { text: text || undefined, card, vocab: settings.vocab, voiceTone: tone ? `${tone.tone} · ${tone.why}` : undefined, lang };

      // Gemini가 직접 듣기: 녹음을 보내되 저장하지 않는다. 실패하면 아래 기본 길로.
      const audio = typeof body.audio === "string" && body.audio.length < MAX_AUDIO ? body.audio : null;
      const gemKey = settings.voiceMode === "gemini" && audio ? await rawKey("gemini") : null;
      if (audio && gemKey) {
        try {
          const r = await analyzeWithAudio(gemKey, settings.models.gemini, input, audio);
          if (r.tone) tone = { tone: r.tone, why: r.toneWhy || "Gemini가 들은 목소리", by: "gemini" };
          return finish(r, true);
        } catch (e) {
          console.error("Gemini 음성 분석 실패", e);
        }
      }

      const ai = await aiConfig();
      if (ai) {
        try {
          return finish(await analyze(ai, input), true);
        } catch (e) {
          console.error("AI 정리 실패", e);
        }
      }
      // AI가 없거나 실패: 카드는 기본 되묻기로, 문장은 카드 단계로 돌려 학생이 직접 고르게
      if (!card) return NextResponse.json({ needCard: true, summary: text, tone: tone?.tone ?? null, toneWhy: tone?.why ?? "", toneBy: tone?.by ?? null, voice: features });
      return finish({ ...card, summary: "", ...fallbackQuestion(card.reason, card.emotion, lang), risk: false, word: "" }, false);
    }

    if (body.action === "save") return saveRecord(s, body.record ?? {}, settings);

    return bad("알 수 없는 요청이에요.");
  } catch (e) {
    console.error(e);
    return bad(e instanceof Error ? e.message : "서버 오류", 500);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 화면에서 온 그대로의 기록, 아래에서 하나씩 검사한다
async function saveRecord(s: Student, r: any, settings: Settings) {
  if (!validCard(r) || !["am", "pm"].includes(r.slot) || !["card", "voice"].includes(r.method)) return bad("기록 모양이 맞지 않아요.");
  const date = today();
  const summary = String(r.summary ?? "").slice(0, 180);
  const answer = String(r.answer ?? "").slice(0, 120);
  const hits = matchRisk(`${summary} ${answer}`, settings.riskWords);
  const voice = r.method === "voice" ? cleanFeatures(r.voice) : null;
  const rec: MoodRecord = {
    id: `${s.no}_${date}_${r.slot}`, no: s.no, date, slot: r.slot, method: r.method,
    emotion: r.emotion, intensity: r.intensity, reason: r.reason, summary,
    question: String(r.question ?? "").slice(0, 80), answer,
    risk: hits.length > 0 || r.aiRisk === true, riskHits: hits, riskChecked: null,
    createdAt: new Date().toISOString(),
    tone: voice && (TONES as readonly string[]).includes(r.tone) ? r.tone : null,
    toneWhy: voice ? String(r.toneWhy ?? "").slice(0, 40) : "",
    toneBy: voice && (r.toneBy === "device" || r.toneBy === "gemini") ? r.toneBy : null,
    voice,
    word: NUANCE[r.emotion]?.includes(r.word) ? r.word : "",
    lang: isLang(r.lang) ? r.lang : "ko",
    summaryKo: isLang(r.lang) && r.lang !== "ko" ? String(r.summaryKo ?? "").slice(0, 120) : "",
    ...(isDemo() ? { demo: true } : {}),
  };
  await putRecord(rec);
  if (rec.risk) alertTeacher(rec.no, "기록", `risk-${rec.id}`);
  return NextResponse.json({ record: publicRecord(rec) });
}

function validCard(c: { emotion?: unknown; intensity?: unknown; reason?: unknown }) {
  return EMOTION_NAMES.includes(String(c.emotion)) && REASON_NAMES.includes(String(c.reason))
    && Number.isInteger(c.intensity) && Number(c.intensity) >= 1 && Number(c.intensity) <= 5;
}

// 학생 화면에는 위험 표시와 말투 판단을 보내지 않는다
function publicRecord(r: MoodRecord) {
  return { ...r, risk: undefined, riskHits: undefined, riskChecked: undefined, tone: undefined, toneWhy: undefined, toneBy: undefined, voice: undefined };
}
