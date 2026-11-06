// 학생 API: 코드 로그인, 내 기록, AI 정리(말투 포함), 저장(끊김 대비 포함), 마음 다스리기, 꾸미기,
// 공감 쪽지, 한 주 돌아보기, 반 감정 단어 사전. 요청 전체가 그 학생의 학급 공간에서 돈다(로그인은 코드로 학급을 찾음).
import { NextResponse, after, type NextRequest } from "next/server";
import { analyze, analyzeWithAudio, fallbackQuestion, reflectReply, type Analysis } from "@/lib/ai";
import { RISK_REPLY, isLang, t, type Lang } from "@/lib/i18n";
import { DEMO_COOKIE, OTHER_STUDENT, STUDENT_COOKIE, otherStudent, queueCodeOk, queueToken, readQueueToken, sign, unsign } from "@/lib/auth";
import { addCalm, addLetter, aiConfig, getLooks, getRoster, getSelfRounds, getSettings, locateCode, queuedWhen, rawKey, recordsFrom, recordsOf, saveMoodRecord, timeOf, touch, type Settings } from "@/lib/data";
import { addRiskDraftSummary, draftKept, dropDoneDrafts, getRiskDrafts, moveRiskActions, nearDraftIds, putRiskDraft, saveLook, seenDraft } from "@/lib/data";
import { clientIp, codeAttempt, waitText } from "@/lib/limit";
import { addDays, monday, slotNow, today } from "@/lib/date";
import { db, inSpace, isDemo, spaceId } from "@/lib/db";
import { notifyTeachers } from "@/lib/push";
import { matchRisk } from "@/lib/rules";
import { cleanSelfAnswers, selfDocId, type SelfAnswer } from "@/lib/selfcheck";
import {
  ACC_UNLOCK, CALM_TOOLS, DEFAULT_LOOK, EMOTION_NAMES, FELT, REASON_NAMES, TONES, cleanLook, cleanSaveId, isWordOf,
  type CalmTool, type Felt, type Letter, type MoodRecord, type Reflect, type RiskDraft, type Student,
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
  // 몸이 JSON 객체가 아니면(null·배열·숫자·깨진 JSON) 400 — 아래에서 body.action을 읽다 500이 나지 않게
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("요청이 올바르지 않아요.");
  if (body.action === "login") return codeLogin(req, body);
  return inSpace(await studentSpace(req, body), () => handle(req, body));
}

// 코드 로그인: 틀린 코드는 IP마다 세어 너무 많으면 잠시 막는다(코드를 마구 넣어 맞히기 막기). 맞힌 로그인은 세지 않는다.
// 학교는 태블릿 여럿이 공인 IP 하나를 함께 쓰므로 넉넉히(10분에 30번) — lib/limit.ts. 코드 색인을 읽기 전에 막는다.
async function codeLogin(req: NextRequest, body: Body) {
  // 들어가기에 실패하면 이 기기에 남아 있던 앞 친구 로그인도 끊는다(다른 코드로 들어오려던 것이므로).
  // 그대로 두면 「코드로 들어가기」를 눌렀을 때 첫 화면이 앞 친구 화면으로 바로 넘어간다.
  const gate = await codeAttempt(clientIp(req.headers));
  const out = (res: NextResponse) => {
    if (!res.ok) res.cookies.delete(STUDENT_COOKIE);
    return res;
  };
  if (gate.wait) return out(bad(`코드를 너무 여러 번 틀렸어요. ${waitText(gate.wait)} 뒤에 다시 해 주세요.`, 429));
  const res = await inSpace(await studentSpace(req, body), () => handle(req, body));
  await gate.done(res.status !== 401); // 401 = 없는 코드
  return out(res);
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
    // 기록은 담아 둔 날짜로 저장한다(다음 날 연결돼도 버리지 않음). 표는 만든 날부터 사흘까지만 쓴다(공용 태블릿에 남은 표로 다른 날 기록을 써 넣지 못하게).
    // 기기 시계가 틀려 만든 때(madeAt)가 표를 받은 날보다 앞이거나 지금보다 뒤면 버리지 않고 그 사이로 당긴다(lib/data.ts queuedWhen) —
    // 버리면 끊긴 채 쓴 위험한 글이 선생님께 닿지 않는다(마치지 않은 글도 남지 않았으므로).
    if (body.action === "saveQueued") {
      const q = readQueueToken(body.qtoken);
      if (!q) return bad("보낼 수 없는 기록이에요.", 410);
      const s = (await getRoster()).find((x) => x.no === q.no && queueCodeOk(x.code, q.code));
      if (!s) return bad("학생 코드가 바뀌었어요.", 410);
      const when = queuedWhen(body.madeAt, q.date);
      if (!when) return bad("너무 오래전에 담아 둔 기록이에요.", 410);
      return saveRecord(s, body.record ?? {}, await getSettings(), { date: when.date, madeAt: when.madeAt, saveId: body.saveId });
    }

    // 같은 기기 다른 탭에서 다른 친구가 들어와 쿠키가 바뀌었으면, 화면이 아는 학생(screenNo·screenSpace)과 다르다 →
    // 명단·기록을 읽거나 쓰기 전에 409로 돌려보낸다(앞 탭의 저장·쪽지가 다른 친구 이름으로 들어가지 않게). 「me」는 누가 들어와 있는지 묻는 것이라 뺀다.
    if (body.action !== "me" && otherStudent(req.cookies.get(STUDENT_COOKIE)?.value, body)) {
      return NextResponse.json({ error: OTHER_STUDENT, code: "otherStudent" }, { status: 409 });
    }

    const s = await me(req);
    if (!s) return bad("다시 들어와 주세요.", 401);
    const settings = await getSettings();

    if (body.action === "me") {
      const date = today();
      const week = monday(date);
      const [mine, looks, inbox, ref, round] = await Promise.all([
        recordsOf(s.no), getLooks(), db().find<Letter>("letters", "to", "==", s.no), db().get<Reflect>("reflects", `${s.no}_${week}`),
        getSelfRounds().then((rs) => rs.find((r) => !r.closedAt)),
      ]);
      const answered = round ? !!(await db().get("meta", selfDocId(round.id, s.no))) : false;
      // 마음 꽃: 이번 달 기록한 날마다 한 송이(그날 마지막 마음 색)
      const month = new Map<string, string>();
      for (const r of mine.filter((r) => r.date.startsWith(date.slice(0, 7))).sort((a, b) => a.id.localeCompare(b.id))) month.set(r.date, r.emotion);
      return NextResponse.json({
        no: s.no, alias: s.alias, className: settings.className, vocab: settings.vocab, voiceMode: settings.voiceMode,
        slot: slotNow(), today: date, records: mine.filter((r) => r.date === date).map(publicRecord),
        flowers: [...month].map(([d, emotion]) => ({ date: d, emotion })),
        look: looks[s.no] ?? DEFAULT_LOOK,
        words: wordsOf(mine), // 마음 친구 성장: 써 본 서로 다른 감정 단어
        unread: inbox.filter((l) => l.status === "ok" && !l.readAt && !l.toPractice).length, // 받은 쪽지(letters)와 같은 것만 센다
        reflected: !!ref,
        selfCheck: round ? { id: round.id, title: round.title, done: answered } : null, // 선생님이 연 마음 점검 회차
        demo: isDemo(),
        qtoken: queueToken(s.no, s.code, date), // 끊김 대비 그날 표(쿠키로 바로 들어온 날에도)
        space: spaceId(), // 같은 태블릿을 여러 반이 쓸 때 학생 화면 언어 같은 기기 설정을 반마다 따로
      });
    }

    // 마음 점검(학생 자기진단): 열린 회차와 내가 낸 답 / 내기(회차가 열려 있는 동안은 다시 내면 고쳐짐)
    if (body.action === "selfCheck" || body.action === "selfSave") {
      const round = (await getSelfRounds()).find((r) => !r.closedAt);
      if (!round) return body.action === "selfCheck" ? NextResponse.json({ round: null, answers: null }) : bad("지금은 마음 점검을 하는 때가 아니에요.", 409);
      const id = selfDocId(round.id, s.no);
      if (body.action === "selfCheck") {
        const mineAns = await db().get<SelfAnswer>("meta", id);
        return NextResponse.json({ round: { id: round.id, title: round.title }, answers: mineAns?.answers ?? null });
      }
      // 답하는 사이 선생님이 새 회차를 열었으면 앞 회차 답을 새 회차에 넣지 않고 알린다(화면이 새 회차를 다시 읽는다)
      if (body.round !== round.id) return bad("마음 점검이 새로 열렸어요. 처음부터 다시 해 주세요.", 409);
      const answers = cleanSelfAnswers(body.answers);
      if (!answers) return bad("답이 다 채워지지 않았어요.");
      const a: SelfAnswer = { kind: "selfAnswer", round: round.id, no: s.no, answers, at: new Date().toISOString(), ...(isDemo() || s.demo ? { demo: true } : {}) };
      await db().set("meta", id, { ...a });
      await touch("other");
      return NextResponse.json({ ok: true });
    }

    // 마음 다스리기 도구를 써 본 느낌을 이 시간의 기록에 붙인다(선생님이 어떤 도구가 도움이 되는지 보게)
    if (body.action === "calm") {
      const tool = body.tool as CalmTool, felt = body.felt as Felt;
      if (!CALM_TOOLS.includes(tool) || !FELT.includes(felt) || !["am", "pm"].includes(body.slot)) return bad("모양이 맞지 않아요.");
      // 읽고 고쳐 쓰기를 한 번에(그사이 늦게 온 기록이 끼워 넣은 위험한 글을 덮지 않게)
      const next = await addCalm(`${s.no}_${today()}_${body.slot}`, { tool, felt, at: new Date().toISOString() });
      if (!next) return bad("먼저 마음을 남겨 주세요.", 404);
      return NextResponse.json({ record: publicRecord(next) });
    }

    // 내 마음 친구 꾸미기. 꾸미개는 써 본 감정 단어 수만큼 열린다(이미 쓰고 있던 것은 그대로 둠).
    // 반 전체 모습이 문서 하나에 모여 있어 내 칸만 바꾼다(여럿이 같은 순간 저장해도 서로 묻히지 않음).
    if (body.action === "look") {
      const look = cleanLook(body.look);
      const looks = await getLooks();
      const n = wordsOf(await recordsOf(s.no)).length;
      if (ACC_UNLOCK[look.acc] > n && looks[s.no]?.acc !== look.acc) return bad("아직 열리지 않은 꾸미개예요.");
      await saveLook(s.no, look);
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
      const risk = matchRisk(text, settings.riskWords).length > 0;
      // 하루 수 세기와 저장을 한 번에(lib/data.ts addLetter): 한꺼번에 보내도 5통을 넘지 않고, 넘친 쪽지는 저장하지 않고 429
      const letter = await addLetter({
        from: s.no, to, text, showName: body.showName !== false, status: "wait",
        createdAt: new Date().toISOString(), risk, lang: isLang(body.lang) ? body.lang : "ko", ...(isDemo() || s.demo ? { demo: true } : {}),
      }, LETTERS_PER_DAY);
      if (!letter) return bad(`쪽지는 하루에 ${LETTERS_PER_DAY}통까지 보낼 수 있어요.`, 429);
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
        // 연습 학생에게 가던 쪽지(toPractice)는 같은 번호를 새로 받은 실제 학생에게 보이지 않게
        inbox: inbox.filter((l) => l.status === "ok" && !l.toPractice).sort(newest).map((l) => ({
          id: l.id, text: l.text, from: l.showName ? name(l.from) : null, at: l.checkedAt ?? l.createdAt, read: !!l.readAt,
        })),
        sent: sent.sort(newest).slice(0, 20).map((l) => ({ id: l.id, text: l.text, to: name(l.to), status: l.status, at: l.createdAt })),
      });
    }
    // 읽음 표시만 한 번에 고친다(읽고 통째로 다시 쓰면 그 사이 선생님이 살펴본 표시·고친 글을 덮는다). 없는 쪽지는 만들지 않는다.
    // 연습 학생에게 가던 쪽지는 같은 번호의 새 학생이 읽은 것으로 적지 않는다
    if (body.action === "readLetter") {
      const at = new Date().toISOString();
      await db().update<Letter>("letters", String(body.id), (l) => (l && l.to === s.no && !l.readAt && !l.toPractice ? { ...l, readAt: at } : undefined));
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
      // 고쳐 쓰면 앞 글은 prev에 남기고, 선생님이 아직 살펴보지 않은 위험 표시는 이어받는다(고쳐 써서 알림이 사라지지 않게)
      const id = `${s.no}_${ws}`;
      await db().update<Reflect>("reflects", id, (old) => {
        const carry = !!old?.risk && !old.riskChecked;
        // 앞 글마다 그 글 자체의 위험만 적고(이어받은 표시는 빼고), 넘치면 위험하지 않은 오래된 글부터 뺀다
        const prev = old ? [...(old.prev ?? []), { text: old.text, risk: old.riskSelf ?? !!old.risk, createdAt: old.createdAt }] : [];
        while (prev.length > 5) {
          const i = prev.findIndex((p) => !p.risk);
          if (i < 0) break;
          prev.splice(i, 1);
        }
        return {
          id, no: s.no, weekStart: ws, text, reply, createdAt: new Date().toISOString(), lang,
          risk: risk || carry, riskSelf: risk, riskChecked: risk || carry ? null : (old?.riskChecked ?? null),
          ...(prev.length ? { prev: prev.slice(-10) } : {}),
          ...(isDemo() || s.demo ? { demo: true } : {}),
        };
      });
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

      const ruleHits = matchRisk(text, settings.riskWords);
      const ruleRisk = ruleHits.length > 0;
      const slot = body.slot === "am" || body.slot === "pm" ? body.slot : slotNow();
      // 쓴 문장에 위험한 말이 있으면 기록을 마치기 전에 바로 남기고 선생님께 알린다(학생이 중간에 나가도 놓치지 않게).
      // 그 칸을 저장하면 saveRecord가 이 글을 기록에 접어 넣는다. 남기다 실패해도 정리하기는 이어 간다(알림은 저장 때 다시).
      let drafted: RiskDraft | null = null;
      const draft = async (summaryKo = "", hits = ruleHits) => {
        if (!text) return;
        const ko = lang !== "ko" ? summaryKo.slice(0, 120) : "";
        if (drafted) {
          // 규칙에 걸려 AI보다 먼저 남긴 글: 선생님이 읽을 한국어 정리만 덧붙인다(그 자리에 아직 같은 글이 있을 때만, 한 번에).
          // 시각·살펴본 표시·앞 글은 그대로 두고, 알림은 다시 보내지 않는다.
          if (ko) {
            try {
              await addRiskDraftSummary(drafted.id, drafted.text, ko);
            } catch (e) {
              console.error("마치지 않은 위험 표현에 한국어 정리 덧붙이기 실패", e);
            }
          }
          return;
        }
        const d: RiskDraft = {
          id: `${s.no}_${today()}_${slot}`, no: s.no, date: today(), slot, text, hits, lang, at: new Date().toISOString(), checked: null,
          ...(ko ? { summaryKo: ko } : {}), ...(isDemo() || s.demo ? { demo: true } : {}),
        };
        drafted = d;
        try {
          // 같은 글을 다시 정리한 것(말로 → 카드로)이면 살펴본 표시를 그대로 두고 알림도 다시 보내지 않는다
          if (await putRiskDraft(d)) alertTeacher(s.no, "기록", `risk-${d.id}`);
        } catch (e) {
          console.error("마치지 않은 위험 표현 남기기 실패", e);
        }
      };
      // 규칙에 걸리면 AI를 기다리지 않고 먼저 남긴다(AI가 오래 걸리거나 실패해도 놓치지 않게)
      if (ruleRisk) await draft();
      // 위험한 마음이면 되묻지 않고 고맙다는 말만 남긴 채 바로 저장(skipAsk).
      // 외국어 글은 AI가 쓴 한국어 정리도 늘 살피는 말(RISK_CORE)로 살핀다(AI가 위험을 놓쳐도). 선생님 목록 전체로 보지 않는 까닭:
      // 번역은 「I hit a home run」→「홈런을 때렸어요」처럼 평범한 말을 목록의 말로 바꿔 놓는다(원래 글은 위에서 목록 전체로 본다).
      // 카드만 고른 경우(글 없음)는 AI 정리·판단만으로 위험이라 하지 않는다(선생님이 읽을 글도 남지 않으므로).
      const finish = async (r: Analysis, ai: boolean) => {
        const out = { ...r, ai, tone: tone?.tone ?? null, toneWhy: tone?.why ?? "", toneBy: tone?.by ?? null, voice: features };
        const koHits = lang !== "ko" && text && r.summary ? matchRisk(r.summary, []) : [];
        const risky = ruleRisk || koHits.length > 0 || (r.risk === true && !!text);
        if (!risky) return NextResponse.json({ ...out, risk: false });
        await draft(r.summary ?? "", ruleHits.length ? ruleHits : koHits);
        return NextResponse.json({ ...out, risk: true, question: RISK_REPLY[lang], options: [], skipAsk: true });
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
      // 문장만 있고 AI가 정리하지 못함: 카드로 고르게 한다. 위험한 말이 있었으면 바로 남기고 고맙다는 말을 보여 준다.
      if (!card) {
        return NextResponse.json({ needCard: true, risk: ruleRisk, summary: text, tone: tone?.tone ?? null, toneWhy: tone?.why ?? "", toneBy: tone?.by ?? null, voice: features });
      }
      return finish({ ...card, summary: "", ...fallbackQuestion(card.reason, card.emotion, lang), risk: false, word: "" }, false);
    }

    if (body.action === "save") return saveRecord(s, body.record ?? {}, settings, { saveId: body.saveId });

    return bad("알 수 없는 요청이에요.");
  } catch (e) {
    console.error(e);
    return bad(e instanceof Error ? e.message : "서버 오류", 500);
  }
}

// 같은 칸(아침·하교 전)에 다시 남기면 새 기록으로 바꾸되, 앞 기록은 prev에 모아 선생님이 볼 수 있게 한다(합치기는 lib/data.ts mergeRecord).
// 선생님이 아직 살펴보지 않은 위험 표시와 마음 다스리기 기록은 새 기록에도 그대로 남긴다(다시 남겨서 알림이 사라지지 않게).
// 끊겼을 때 담아 둔 기록(madeAt)이 이미 저장된 기록보다 먼저 만든 것이면 덮어쓰지 않고 앞 기록으로만 끼워 넣는다.
// 같은 칸 저장 둘이 겹쳐도(담아 둔 기록과 바로 보낸 기록·태블릿 두 대) 읽고 고쳐 쓰기를 한 번에 해서 서로 잇는다(위험한 글을 잃지 않게).
// 같은 기록이 두 번 오면(답만 잃은 화면이 다시 보냄) 그대로 둔다: 앞 기록·살펴볼 판·휴대폰 알림을 다시 만들지 않는다.
// saveId: 화면이 저장마다 새로 다는 이름(기록 안 record.saveId, 없으면 요청의 saveId). 답을 잃어 담아 두었다가 다시 보낸 같은 저장은
// 이 이름으로 알아본다(lib/data.ts mergeRecord). 모양이 다르면 없는 것으로.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 화면에서 온 그대로의 기록, 아래에서 하나씩 검사한다
async function saveRecord(s: Student, r: any, settings: Settings, opt: { date?: string; madeAt?: number; saveId?: unknown } = {}) {
  if (!validCard(r) || !["am", "pm"].includes(r.slot) || !["card", "voice"].includes(r.method)) return bad("기록 모양이 맞지 않아요.");
  const saveId = cleanSaveId(r.saveId ?? opt.saveId);
  const date = opt.date ?? today();
  const summary = String(r.summary ?? "").slice(0, 180);
  const answer = String(r.answer ?? "").slice(0, 120);
  const lang: Lang = isLang(r.lang) ? r.lang : "ko";
  const summaryKo = lang !== "ko" ? String(r.summaryKo ?? "").slice(0, 120) : "";
  // 학생이 쓴 글(말한 문장·되묻기 답)은 선생님 목록 전체로, AI가 옮긴 한국어 정리는 늘 살피는 말(RISK_CORE)로만 본다
  // (정리하기와 같은 까닭: 「I hit a home run」→「홈런을 때렸어요」처럼 번역이 평범한 말을 목록의 말로 바꿔 놓는다).
  // 카드만 고른 기록(학생 글 없음)은 AI 정리만으로 위험이라 하지 않는다.
  const koHits = summaryKo && summary ? matchRisk(summaryKo, []) : [];
  const hits = [...new Set([...matchRisk([summary, answer].filter(Boolean).join(" "), settings.riskWords), ...koHits])];
  const own = hits.length > 0 || r.aiRisk === true;
  const voice = r.method === "voice" ? cleanFeatures(r.voice) : null;
  const id = `${s.no}_${date}_${r.slot}`;
  const createdAt = new Date(opt.madeAt ?? Date.now()).toISOString();
  // 선생님이 이미 「살펴봤어요」한 마치지 않은 글과 같은 글로 기록을 마쳤나(새로 위험한 글이 없을 때만 — lib/data.ts seenDraft).
  // 그렇다면 살펴본 것으로 이어받는다: 위험 표시·걸린 말은 그대로(누적 기록·리포트·CSV에 살펴본 위험 표현으로 남음), 알림·휴대폰 알림은 다시 내지 않는다.
  let seen: RiskDraft | null = null;
  if (own) {
    try {
      // 이 칸과 그 무렵 다른 칸(정오·자정을 넘김 — 23시 59분에 정리한 글은 어제 날짜로 남는다)의 마치지 않은 글
      const near = new Set([id, ...nearDraftIds(id)]);
      const drafts = (await getRiskDrafts()).filter((d) => near.has(d.id));
      seen = seenDraft({
        summary, answer, hits, aiRisk: r.aiRisk === true,
        summaryHits: [...new Set([...matchRisk(summary, settings.riskWords), ...koHits])], answerHits: matchRisk(answer, settings.riskWords),
      }, drafts, id, timeOf(createdAt));
    } catch (e) {
      console.error("살펴본 마치지 않은 글 찾기 실패(그대로 알림)", e); // 못 찾으면 지금처럼 알린다
    }
  }
  const alertNew = own && !seen; // 선생님이 아직 보지 않은 위험한 글이 이 기록에 있다
  const rec: MoodRecord = {
    id, no: s.no, date, slot: r.slot, method: r.method,
    emotion: r.emotion, intensity: r.intensity, reason: r.reason, summary,
    question: String(r.question ?? "").slice(0, 80), answer,
    risk: own, riskSelf: own, riskHits: hits, riskChecked: null,
    createdAt,
    tone: voice && (TONES as readonly string[]).includes(r.tone) ? r.tone : null,
    toneWhy: voice ? String(r.toneWhy ?? "").slice(0, 40) : "",
    toneBy: voice && (r.toneBy === "device" || r.toneBy === "gemini") ? r.toneBy : null,
    voice,
    word: isWordOf(r.emotion, r.word) ? r.word : "", // 더 꼭 맞는 말·카드에 더한 낱말
    lang,
    summaryKo,
    ...(saveId ? { saveId } : {}), // Firestore는 undefined를 받지 않으므로 없으면 칸을 넣지 않는다
    ...(isDemo() || s.demo ? { demo: true } : {}),
  };
  const { record: saved, same } = await saveMoodRecord({ rec, own, alertNew, seenChecked: seen?.checked ?? undefined, queued: opt.madeAt !== undefined });
  const reply = hits.length ? { reply: RISK_REPLY[lang] } : {};
  // 같은 기록이 이미 있었으면 저장해 둔 그대로 돌려준다(위험한 글이면 같은 고맙다는 말). 조치 기록 옮기기·마치지 않은 글 정리·휴대폰 알림도 하지 않는다
  // (다시 정리하며 새로 남긴 마치지 않은 글이 있으면 그 알림은 그대로 둔다).
  if (same) return NextResponse.json({ record: publicRecord(saved), ...reply });
  // 살펴본 마치지 않은 글을 이어받았으면 그 글에 남긴 조치 기록을 이 기록으로 옮긴다(그 글이 모두 이 기록에 담겼을 때만 — 그래야 지워도 글을 잃지 않음).
  // 담기지 않은 앞서 쓴 글이 있으면 그 글(살펴본 것)과 조치 기록은 그대로 둔다.
  const moveFrom = seen && draftKept(seen, summary, answer) ? seen : null;
  if (moveFrom) {
    try {
      await moveRiskActions(`draft:${moveFrom.id}`, saved.id, saved.date);
    } catch (e) {
      console.error("살펴본 마치지 않은 글의 조치 기록 옮기기 실패", e); // 옮기지 못해도 조치 기록은 그 이름으로 남는다
    }
  }
  // 마치지 않은 위험 표현: 이번에 저장한 글이 바로 그 글(위험 표시까지)이면 기록에 담긴 것이니 지운다.
  // 다른 글이나 카드만 저장했으면 그대로 둔다(선생님 알림에 「기록을 마치지 않고 나감」으로 남아, 알림만 가고 글이 사라지지 않게).
  // 견주기는 지우는 그 순간의 글로 한다(그사이 새로 쓴 위험한 글이 함께 지워지지 않게).
  // 살펴본 글은 이어받은 바로 그 판(at)일 때만 지운다(그사이 학생이 새로 쓴 글은 살펴보지 않은 알림으로 남게) → 같은 일이 한 번만 보인다.
  try {
    const done = (d: RiskDraft) => draftKept(d, summary, answer) && (!d.checked || (d.id === moveFrom?.id && d.at === moveFrom.at));
    // 정리하는 사이 정오를 넘기면 글은 아침 칸으로 먼저 남고 기록은 하교 전 칸에 저장된다. 자정을 넘기면 글은 어제 칸으로 남고 기록은 오늘 칸에.
    // → 그 무렵 다른 칸의 같은 글도 함께 지운다(한 글에 알림이 둘 남지 않게). 몇 시간 앞서 따로 남긴 글은 그 칸의 알림으로 그대로 둔다(lib/data.ts dropDoneDrafts).
    if (own) await dropDoneDrafts(saved.id, timeOf(createdAt), done);
  } catch (e) {
    console.error("마치지 않은 위험 표현 정리 실패", e);
  }
  if (alertNew) alertTeacher(saved.no, "기록", `risk-${saved.id}`);
  // 학생이 쓴 글(되묻기 답·말한 문장)에 위험한 말이 있었으면 화면이 응원·축하 대신 고맙다는 말을 보이게 그 말만 보낸다(위험 표시·걸린 말은 보내지 않음)
  return NextResponse.json({ record: publicRecord(saved), ...reply });
}

function validCard(c: { emotion?: unknown; intensity?: unknown; reason?: unknown }) {
  return EMOTION_NAMES.includes(String(c.emotion)) && REASON_NAMES.includes(String(c.reason))
    && Number.isInteger(c.intensity) && Number(c.intensity) >= 1 && Number(c.intensity) <= 5;
}

// 학생 화면에는 위험 표시와 말투 판단을 보내지 않는다. 바뀐 시각(updatedAt)도 빼고(선생님이 「살펴봤어요」를 누르면 바뀌어 알림이 닫힌 것을 알려 준다),
// 저장소 판 표(_v)·저장 이름(saveId)도 학생 화면에 쓸 데가 없으니 뺀다.
function publicRecord(r: MoodRecord) {
  const {
    prev: _p, riskSelf: _rs, riskAt: _ra, riskSrc: _rc, risk: _r, riskHits: _rh, riskChecked: _rk, tone: _t, toneWhy: _tw, toneBy: _tb, voice: _vo,
    updatedAt: _u, saveId: _id, _v, ...out
  } = r as MoodRecord & { _v?: unknown };
  void [_p, _rs, _ra, _rc, _r, _rh, _rk, _t, _tw, _tb, _vo, _u, _id, _v];
  return out;
}
