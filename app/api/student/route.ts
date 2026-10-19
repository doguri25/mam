// 학생 API: 코드 로그인, 내 기록, AI 정리(말투 포함), 저장
import { NextResponse, after, type NextRequest } from "next/server";
import { analyze, analyzeWithAudio, fallbackQuestion, type Analysis } from "@/lib/ai";
import { RISK_REPLY, isLang, type Lang } from "@/lib/i18n";
import { STUDENT_COOKIE, decrypt, sign, unsign } from "@/lib/auth";
import { aiConfig, getLooks, getRoster, getSettings, putRecord, recordsOf, saveLooks } from "@/lib/data";
import { slotNow, today } from "@/lib/date";
import { notifyTeachers } from "@/lib/push";
import { matchRisk } from "@/lib/rules";
import { DEFAULT_LOOK, EMOTION_NAMES, NUANCE, REASON_NAMES, TONES, cleanLook, type MoodRecord, type Student } from "@/lib/shared";
import { baseline, cleanFeatures, toneOf } from "@/lib/tone";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const MAX_AUDIO = 900_000; // base64 글자 수(16kHz 모노 15초 ≈ 64만)

async function me(req: NextRequest): Promise<Student | null> {
  const v = unsign(req.cookies.get(STUDENT_COOKIE)?.value);
  if (!v) return null;
  const [no, code] = v.split(":");
  // 교사가 코드를 새로 만들면 예전 코드로 들어온 기기는 자동으로 나가진다
  return (await getRoster()).find((s) => s.no === Number(no) && s.code === code) ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "login") {
      const code = String(body.code ?? "").trim().toUpperCase();
      const s = (await getRoster()).find((x) => x.code === code);
      if (!s) return bad("코드를 다시 확인해 주세요.", 401);
      const res = NextResponse.json({ no: s.no, alias: s.alias });
      res.cookies.set(STUDENT_COOKIE, sign(`${s.no}:${s.code}`), {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/",
      });
      return res;
    }
    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(STUDENT_COOKIE);
      return res;
    }

    const s = await me(req);
    if (!s) return bad("다시 들어와 주세요.", 401);
    const settings = await getSettings();

    if (body.action === "me") {
      const date = today();
      const [mine, looks] = await Promise.all([recordsOf(s.no), getLooks()]);
      // 마음 꽃: 이번 달 기록한 날마다 한 송이(그날 마지막 마음 색)
      const month = new Map<string, string>();
      for (const r of mine.filter((r) => r.date.startsWith(date.slice(0, 7))).sort((a, b) => a.id.localeCompare(b.id))) month.set(r.date, r.emotion);
      return NextResponse.json({
        no: s.no, alias: s.alias, className: settings.className, vocab: settings.vocab, voiceMode: settings.voiceMode,
        slot: slotNow(), today: date, records: mine.filter((r) => r.date === date).map(publicRecord),
        flowers: [...month].map(([d, emotion]) => ({ date: d, emotion })),
        look: looks[s.no] ?? DEFAULT_LOOK,
      });
    }

    // 내 마음 친구 꾸미기
    // ponytail: 문서 하나를 읽고 고쳐 쓰므로 두 학생이 같은 순간 저장하면 한쪽이 묻힐 수 있다. 반 하나·태블릿 돌려쓰기면 충분.
    if (body.action === "look") {
      const look = cleanLook(body.look);
      await saveLooks({ ...(await getLooks()), [s.no]: look });
      return NextResponse.json({ look });
    }

    if (body.action === "records") {
      const month = String(body.month ?? today().slice(0, 7));
      const mine = (await recordsOf(s.no)).filter((r) => r.date.startsWith(month));
      return NextResponse.json({ records: mine.map(publicRecord) });
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
        const t = toneOf(features, baseline(history));
        if (t) tone = { tone: t.tone, why: t.why, by: "device" };
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
      const gemKey = settings.keys.gemini ? decrypt(settings.keys.gemini) : null;
      if (settings.voiceMode === "gemini" && audio && gemKey) {
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

    if (body.action === "save") {
      const r = body.record ?? {};
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
      };
      await putRecord(rec);
      // 위험 표현이면 교사 휴대폰에 알림(응답은 기다리지 않게 뒤에서). 번호만 보내고 이름·글은 보내지 않는다.
      if (rec.risk) after(() => notifyTeachers({ title: "⚠️ 바로 살펴봐 주세요", body: `${rec.no}번 학생 기록에 위험 표현이 있어요. 선생님 화면에서 확인해 주세요.`, url: "/teacher", tag: `risk-${rec.id}` }));
      return NextResponse.json({ record: publicRecord(rec) });
    }

    return bad("알 수 없는 요청이에요.");
  } catch (e) {
    console.error(e);
    return bad(e instanceof Error ? e.message : "서버 오류", 500);
  }
}

function validCard(c: { emotion?: unknown; intensity?: unknown; reason?: unknown }) {
  return EMOTION_NAMES.includes(String(c.emotion)) && REASON_NAMES.includes(String(c.reason))
    && Number.isInteger(c.intensity) && Number(c.intensity) >= 1 && Number(c.intensity) <= 5;
}

// 학생 화면에는 위험 표시와 말투 판단을 보내지 않는다
function publicRecord(r: MoodRecord) {
  return { ...r, risk: undefined, riskHits: undefined, riskChecked: undefined, tone: undefined, toneWhy: undefined, toneBy: undefined, voice: undefined };
}
