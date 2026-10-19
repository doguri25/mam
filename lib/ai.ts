// AI 호출: 업스테이지·ChatGPT·Gemini는 OpenAI 호환 주소로, Claude는 Anthropic SDK로.
// 학생 이름은 보내지 않는다(가명·기록만).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { leaks } from "./rules.ts";
import { SKIP, fallbackFor, langOf, type Lang } from "./i18n.ts";
import { EMOTION_NAMES, NUANCE, NUANCE_WORDS, REASON_NAMES, TONES, emotionOf, type MoodRecord, type Provider } from "./shared.ts";

const BASE_URL: Record<Exclude<Provider, "claude">, string | undefined> = {
  upstage: "https://api.upstage.ai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  openai: undefined,
};
// 이 모델들은 거절 시 서버가 다른 모델로 이어 받는 fallbacks를 켠다
const CLAUDE_FALLBACK = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export interface AI {
  provider: Provider;
  model: string;
  key: string;
}

export async function callJSON(ai: AI, system: string, user: string, name: string, schema: Record<string, unknown>) {
  let text: string | null | undefined;
  if (ai.provider === "claude") {
    const client = new Anthropic({ apiKey: ai.key, timeout: 40_000, maxRetries: 1 });
    const params = {
      model: ai.model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user" as const, content: user }],
      output_config: { format: { type: "json_schema" as const, schema }, effort: "low" as const },
    };
    const res = CLAUDE_FALLBACK.has(ai.model)
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as never)
      : await client.messages.create(params);
    const msg = res as Anthropic.Message;
    if (msg.stop_reason === "refusal") throw new Error("AI가 이 요청에 답하지 않았어요.");
    text = msg.content.find((b) => b.type === "text")?.text;
  } else {
    const client = new OpenAI({ apiKey: ai.key, baseURL: BASE_URL[ai.provider], timeout: 40_000, maxRetries: 1 });
    const res = await client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      // 업스테이지는 추론을 꺼서 빠르게(아이가 기다리는 화면)
      ...(ai.provider === "upstage" ? { reasoning_effort: "none" as never, temperature: 0.4 } : {}),
    });
    text = res.choices[0]?.message.content;
  }
  if (!text) throw new Error("AI 답이 비어 있어요.");
  return JSON.parse(text);
}

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const ANALYZE_SCHEMA = obj({
  emotion: { type: "string", enum: EMOTION_NAMES },
  intensity: { type: "integer", description: "1(조금)~5(아주 많이)" },
  reason: { type: "string", enum: REASON_NAMES },
  summary: { type: "string", description: "학생 말을 한 줄로, 30자 안" },
  question: { type: "string", description: "공감 한 마디 + 질문 하나, 반말, 30자 안" },
  options: { type: "array", items: { type: "string" }, description: "question에 대한 짧은 답 보기 2개" },
  risk: { type: "boolean" },
  word: { type: "string", enum: ["", ...NUANCE_WORDS], description: "emotion에 맞는 더 꼭 맞는 말(nuance 중 하나), 없으면 빈 글자" },
});

const ANALYZE_SYSTEM = `너는 초등학교 3학년 학생의 「마음 친구」야. 학생이 남긴 마음 기록을 정리하고, 까닭을 조금 더 알 수 있는 질문을 딱 하나 만들어.
- card가 있으면 emotion·intensity·reason은 card 값을 그대로 써.
- text가 있으면 그 말에서 emotion(목록 중 하나), intensity(1 조금 ~ 5 아주 많이), reason(친구·공부·집·몸·그냥 중 하나)을 골라. summary는 학생 말을 30자 안 한 줄로.
  "몰라"처럼 마음을 전혀 알 수 없을 때만 emotion은 "그저 그래요", intensity는 2. 사라지고 싶다·힘들다 같은 말은 슬퍼요 쪽으로.
- question: 공감 한 마디 + 질문 하나. 반말, 25자 안. 예: "억울했구나, 그때 누구랑 있었어?"
  판단·충고·진단하는 말, "~해야 해", "괜찮아질 거야"는 쓰지 마.
  집·가족·몸 이야기는 무슨 일이 있었는지 캐묻지 말고 지금 마음만 물어. 예: "잠을 못 자서 힘들겠다. 지금은 좀 어때?"
- options: 학생이 그대로 누르는 짧은 대답 2개(반말, 12자 안). 질문이 아니라 대답이어야 하고, question에 바로 맞는 말이어야 해.
  예: question "그때 누구랑 있었어?" → options ["친구들이랑", "혼자 있었어"]
- risk: 자기를 해치고 싶다, 사라지고 싶다, 누군가에게 맞거나 괴롭힘을 당한다는 내용이면 true, 아니면 false.
- vocab에 있는 감정 단어가 어울리면 question에 자연스럽게 써도 좋아.
- voiceTone이 있으면 말할 때 목소리 기운이야(예: "가라앉음 · 평소보다 작게, 낮게"). 말 내용이 먼저지만, 감정과 세기를 고를 때 참고해.
  목소리 이야기를 question에 꺼내지는 마.
- word: emotion을 정한 뒤, nuance[emotion] 세 말 중 학생 말에 더 꼭 맞는 하나. card만 있고 단서가 없으면 빈 글자.
- lang이 ko가 아니면 학생은 그 언어를 써(en English, zh 简体中文, vi Tiếng Việt, ja 日本語).
  question과 options는 그 언어로, 그 나라 3학년 아이에게 말하듯 쉽게. summary는 늘 한국어로(선생님이 읽어) — 학생 말을 한국어로 옮겨 한 줄로.`;

const NUANCE_JSON = JSON.stringify(NUANCE);

export interface Analysis {
  emotion: string;
  intensity: number;
  reason: string;
  summary: string;
  question: string;
  options: string[];
  risk: boolean;
  word: string;
}

// AI 없이도 되묻기가 되도록 까닭별 기본 질문(학생 언어로)
export function fallbackQuestion(reason: string, emotion: string, lang: Lang = "ko") {
  return fallbackFor(lang, reason, emotionOf(emotion)?.group === "joy");
}

type AnalyzeInput = {
  text?: string; card?: { emotion: string; intensity: number; reason: string }; vocab: string[]; voiceTone?: string; lang?: Lang;
};

export async function analyze(ai: AI, input: AnalyzeInput): Promise<Analysis> {
  return shape(input, await callJSON(ai, ANALYZE_SYSTEM, JSON.stringify({ ...input, nuance: NUANCE_JSON }), "mood", ANALYZE_SCHEMA));
}

// Gemini가 목소리를 직접 듣고 말투까지 판단(녹음은 보내기만 하고 저장하지 않음)
const AUDIO_SCHEMA = obj({
  ...ANALYZE_SCHEMA.properties,
  tone: { type: "string", enum: [...TONES] },
  toneWhy: { type: "string", description: "목소리가 어떻게 들렸는지 15자 안(예: 작고 느리게)" },
});

export async function analyzeWithAudio(key: string, model: string, input: AnalyzeInput, wavBase64: string) {
  const system = `${ANALYZE_SYSTEM}
- 함께 온 녹음은 학생이 방금 한 말이야. tone은 목소리 기운(들떠 있음·차분함·가라앉음·떨림) 중 하나, toneWhy는 어떻게 들렸는지 짧게.
  목소리만으로 감정을 단정하지 말고 말 내용과 함께 판단해.`;
  const body = (schemaKey: "responseJsonSchema" | "responseSchema", schema: unknown) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavBase64 } }, { text: JSON.stringify({ ...input, nuance: NUANCE_JSON }) }] }],
    generationConfig: { responseMimeType: "application/json", [schemaKey]: schema },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const post = (b: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: b, signal: AbortSignal.timeout(40_000) });
  let res = await post(body("responseJsonSchema", AUDIO_SCHEMA));
  // 옛 API는 responseSchema(additionalProperties 없음)만 받는다
  if (res.status === 400) res = await post(body("responseSchema", JSON.parse(JSON.stringify(AUDIO_SCHEMA, (k, v) => (k === "additionalProperties" ? undefined : v)))));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini 답이 비어 있어요.");
  const out = JSON.parse(text);
  return {
    ...shape(input, out),
    tone: (TONES as readonly string[]).includes(out.tone) ? (out.tone as string) : null,
    toneWhy: String(out.toneWhy ?? "").slice(0, 30),
  };
}

function shape(input: AnalyzeInput, out: Record<string, unknown>): Analysis {
  const card = input.card;
  const emotion = card?.emotion ?? (EMOTION_NAMES.includes(String(out.emotion)) ? String(out.emotion) : "그저 그래요");
  const reason = card?.reason ?? (REASON_NAMES.includes(String(out.reason)) ? String(out.reason) : "그냥");
  const lang = input.lang ?? "ko";
  const opts = Array.isArray(out.options) ? out.options.filter((o): o is string => typeof o === "string" && !!o.trim() && o !== SKIP[lang]).slice(0, 2) : [];
  const fb = fallbackQuestion(reason, emotion, lang);
  const word = String(out.word ?? "");
  return {
    emotion,
    reason,
    intensity: card?.intensity ?? Math.min(5, Math.max(1, Math.round(Number(out.intensity) || 3))),
    summary: String(out.summary ?? input.text ?? "").slice(0, 80),
    question: String(out.question ?? "").slice(0, 80) || fb.question,
    options: [...(opts.length ? opts : fb.options.slice(0, 2)), SKIP[lang]],
    risk: out.risk === true,
    word: NUANCE[emotion]?.includes(word) ? word : "", // 고른 감정의 말이 아니면 버림
  };
}

const CHEER_SYSTEM = `너는 초등학교 3학년 담임 선생님이 학생에게 건넬 응원 한마디 초안을 쓰는 도우미야.
- 「최근3일」 마음을 가장 중요하게 봐. 힘든 마음이 이어지고 있으면 밝은 이야기로 덮지 말고, 그 마음을 알아주는 말로 시작해.
- 「선생님이본신호」가 있으면 그 내용과 어긋나는 말(예: 친구 때문에 힘든데 "친구랑 신나는구나")은 쓰지 마.
- 기록에 적힌 감정·까닭·한줄만 써. 기록에 없는 장소·사건·감정("집에 가서", "고마운 마음" 등)을 지어내지 마.
- 「선생님이본신호」는 선생님이 참고할 내용이야. 아이에게 횟수·날수("두 번", "사흘째")나 "한줄", "기록" 같은 말을 그대로 옮기지 마.
- 까닭이 「집」인 일은 꺼내지 말고, 필요하면 "힘든 일"처럼 돌려 말해.
- 선생님이 아이에게 말하는 따뜻한 말투(~구나, ~해 줘서 고마워), 2~3문장, 한 문장은 40자 안.
- vocab의 감정 단어를 하나 이상 자연스럽게 넣어. 진단·평가·다른 친구와의 비교는 하지 마.
- acknowledge: 마음을 알아주는 데 중심을 둔 초안. encourage: 작은 응원이나 함께 해 볼 일을 건네는 초안. 두 초안은 문장이 겹치지 않게.`;

export async function cheer(ai: AI, alias: string, records: MoodRecord[], vocab: string[], signals: string[], today: string) {
  const row = (r: MoodRecord) => ({
    날짜: r.date, 시점: r.slot === "am" ? "아침" : "하교 전", 감정: r.emotion, 세기: r.intensity, 까닭: r.reason,
    한줄: r.summary || undefined, 되묻기답: r.answer || undefined,
  });
  const newest = [...records].sort((a, b) => b.id.localeCompare(a.id));
  const recent = new Set([...new Set(newest.map((r) => r.date))].slice(0, 3));
  const input = {
    가명: alias, 오늘: today, 선생님이본신호: signals, vocab,
    최근3일: newest.filter((r) => recent.has(r.date)).map(row),
    그전기록: newest.filter((r) => !recent.has(r.date)).map(row),
  };
  const schema = obj({ acknowledge: { type: "string" }, encourage: { type: "string" } });
  const ask = async (extra = "") => {
    const out = await callJSON(ai, CHEER_SYSTEM + extra, JSON.stringify(input), "cheer", schema);
    return [out.acknowledge, out.encourage].filter((d): d is string => typeof d === "string" && !!d.trim()).map((d) => d.trim());
  };
  let drafts = await ask();
  // 선생님용 숫자·말이 섞이면 한 번만 다시 쓰게 하고, 그래도 남으면 화면에 표시
  const found = [...new Set(drafts.flatMap(leaks))];
  if (found.length) {
    const again = await ask(`\n- 지난 초안에 「${found.join("」, 「")}」 같은 말이 들어갔어. 이런 말은 빼고 다시 써.`).catch(() => drafts);
    if (again.flatMap(leaks).length < drafts.flatMap(leaks).length) drafts = again;
  }
  return { drafts, warns: drafts.map((d) => leaks(d).join(", ")) };
}

export async function ping(ai: AI) {
  const out = await callJSON(ai, "요청대로 JSON만 답해.", '{"ok": true}를 그대로 돌려줘.', "ping", obj({ ok: { type: "boolean" } }));
  return out.ok === true;
}

// ── 교과서·학습지에서 감정 단어와 활동 뽑기 ──
export interface Lesson {
  unit: string;
  words: { word: string; emotion: string; meaning: string }[];
  activities: { title: string; how: string; minutes: number }[];
}

const LESSON_SYSTEM = `너는 초등 3학년 도덕·창체 수업 자료를 정리하는 도우미야. 받은 자료(마크다운)에서
- unit: 차시나 단원 이름(없으면 자료 주제를 짧게).
- words: 자료에 나오거나 자료가 다루는 감정 단어(「~해요」 꼴, 3학년이 쓰는 말) 최대 8개. emotion은 12개 큰 감정 중 가장 가까운 것, meaning은 3학년 눈높이 뜻풀이 20자 안.
- activities: 자료에 나오는 활동을 교실에서 바로 할 수 있게 최대 4개. title 15자 안, how 한 문장, minutes 분.
자료에 없는 내용은 지어내지 마.`;

export async function extractLesson(ai: AI, markdown: string): Promise<Lesson> {
  const schema = obj({
    unit: { type: "string" },
    words: { type: "array", items: obj({ word: { type: "string" }, emotion: { type: "string", enum: EMOTION_NAMES }, meaning: { type: "string" } }) },
    activities: { type: "array", items: obj({ title: { type: "string" }, how: { type: "string" }, minutes: { type: "integer" } }) },
  });
  const out = await callJSON(ai, LESSON_SYSTEM, markdown.slice(0, 20_000), "lesson", schema);
  return {
    unit: String(out.unit ?? "").slice(0, 40),
    words: (Array.isArray(out.words) ? out.words : []).slice(0, 8).map((x: Lesson["words"][number]) => ({
      word: String(x.word ?? "").slice(0, 12), emotion: EMOTION_NAMES.includes(x.emotion) ? x.emotion : "그저 그래요", meaning: String(x.meaning ?? "").slice(0, 40),
    })).filter((x: { word: string }) => x.word),
    activities: (Array.isArray(out.activities) ? out.activities : []).slice(0, 4).map((x: Lesson["activities"][number]) => ({
      title: String(x.title ?? "").slice(0, 30), how: String(x.how ?? "").slice(0, 120), minutes: Math.min(45, Math.max(1, Number(x.minutes) || 10)),
    })).filter((x: { title: string }) => x.title),
  };
}

// ── 이번 주 우리 반 마음 요약 + 다음 주 활동 추천(학생 이름·번호 없이 모은 숫자만 보냄) ──
export interface Weekly {
  lines: string[];
  activities: { title: string; why: string; how: string; minutes: number }[];
}

const WEEKLY_SYSTEM = `너는 초등 3학년 담임 선생님의 학급 운영을 돕는 도우미야. 이번 주 우리 반 마음 기록을 모은 숫자(학생 이름 없음)를 보고
- lines: 이번 주 마음 흐름을 3줄로. 숫자 근거를 넣되 진단·평가 말은 쓰지 마. 각 줄 50자 안.
- activities: 다음 주 아침 활동이나 도덕·창체 시간에 할 활동 2개. why는 이번 주 흐름과 이어지는 까닭 한 문장, how는 하는 방법 한 문장, minutes 분.
  lessonActivities(선생님이 올린 교과서 활동)가 있으면 그중에서 먼저 고르고, 없으면 회복적 서클·감정 카드 놀이·칭찬 릴레이처럼 교실에서 흔히 하는 활동으로.
특정 학생을 떠올리게 하는 말은 쓰지 마.`;

export async function weeklySummary(ai: AI, stats: unknown, lessonActivities: unknown[]): Promise<Weekly> {
  const schema = obj({
    lines: { type: "array", items: { type: "string" } },
    activities: { type: "array", items: obj({ title: { type: "string" }, why: { type: "string" }, how: { type: "string" }, minutes: { type: "integer" } }) },
  });
  const out = await callJSON(ai, WEEKLY_SYSTEM, JSON.stringify({ stats, lessonActivities }), "weekly", schema);
  return {
    lines: (Array.isArray(out.lines) ? out.lines : []).slice(0, 3).map((l: unknown) => String(l).slice(0, 90)),
    activities: (Array.isArray(out.activities) ? out.activities : []).slice(0, 2).map((a: Weekly["activities"][number]) => ({
      title: String(a.title ?? "").slice(0, 30), why: String(a.why ?? "").slice(0, 120), how: String(a.how ?? "").slice(0, 160), minutes: Math.min(45, Math.max(1, Number(a.minutes) || 10)),
    })),
  };
}

// ── 한 주 돌아보기: 학생이 쓴 한 줄에 마음 친구가 짧게 답한다(학생이 고른 언어로) ──
const REFLECT_SYSTEM = `너는 초등학교 3학년 학생의 「마음 친구」야. 학생이 이번 주를 돌아보며 쓴 한 줄과 이번 주 감정 기록을 받아,
학생에게 1~2문장으로 다정하게 답해. 규칙:
- 학생이 쓴 내용을 구체적으로 알아주고 칭찬해. 평가·충고·훈계·약속은 하지 마.
- 힘들었다고 하면 그 마음을 알아주고, 필요하면 선생님께 이야기해도 된다고 덧붙여.
- 이름·번호·횟수·「기록」이라는 말은 쓰지 마. 3학년이 읽을 쉬운 말로, 반말로 따뜻하게.
- reply는 반드시 지정한 언어(lang)로 써.`;
export async function reflectReply(ai: AI, input: { lang: Lang; text: string; week: { emotion: string; word?: string }[] }) {
  const out = await callJSON(ai, REFLECT_SYSTEM, JSON.stringify({ ...input, lang: langOf(input.lang).ai }), "reflect", obj({ reply: { type: "string" } }));
  const reply = String(out.reply ?? "").trim().slice(0, 160);
  if (!reply || leaks(reply)) throw new Error("답이 알맞지 않아요");
  return reply;
}

// ── 상담 연계 의견서 초안: 최근 2주 기록만 보고 관찰한 사실을 정리한다(진단하지 않음) ──
export interface Referral { flow: string; reasons: string; helps: string }
const REFERRAL_SYSTEM = `너는 초등학교 담임 선생님이 Wee클래스·상담교사에게 보낼 「학생 관찰 의견」 초안을 돕는 도우미야.
학생 가명과 최근 2주 마음 기록(학생이 스스로 고른 감정·크기·까닭·한 문장, 마음 다스리기 도구 사용)과 살펴보기 신호를 받아 세 칸을 써.
- flow: 2주 동안 관찰된 정서 흐름 3~5문장(날짜·아침/하교 전 변화를 근거로, 사실 위주)
- reasons: 학생이 스스로 말한 까닭·상황 요약 2~3문장(학생이 쓴 말은 따옴표로)
- helps: 도움이 된 것으로 보이는 것(마음 다스리기 도구·좋았던 날의 까닭 등) 1~2문장
규칙: 진단명·병명·성격 단정(예: 우울증, ADHD, 불안장애, 공격적인 아이) 절대 쓰지 마. 추측은 「~로 보임」처럼 조심스럽게.
학생은 가명으로만 부르고, 가족에 관한 추측은 쓰지 마. 높임말(~함, ~보임 같은 개조식 말투)로 간결하게. 한국어로.`;
export async function referralDraft(ai: AI, input: { alias: string; records: unknown[]; signals: string[] }): Promise<Referral> {
  const schema = obj({ flow: { type: "string" }, reasons: { type: "string" }, helps: { type: "string" } });
  const out = await callJSON(ai, REFERRAL_SYSTEM, JSON.stringify(input), "referral", schema);
  return { flow: String(out.flow ?? "").slice(0, 700), reasons: String(out.reasons ?? "").slice(0, 500), helps: String(out.helps ?? "").slice(0, 300) };
}

// ── 가정 소식지 번역: 다문화 가정에 보낼 같은 내용을 다른 언어로 ──
export async function translateNotice(ai: AI, text: string, lang: Exclude<Lang, "ko">) {
  const system = `너는 초등학교 가정 안내문을 번역하는 도우미야. 받은 한국어 안내문을 ${langOf(lang).ai}로 자연스럽게 번역해.
줄 나눔과 제목·목록 모양은 그대로 두고, 학부모가 읽기 쉬운 공손한 말로. 새 내용을 더하지 마.`;
  const out = await callJSON(ai, system, text.slice(0, 4000), "translate", obj({ text: { type: "string" } }));
  return String(out.text ?? "").slice(0, 6000);
}
