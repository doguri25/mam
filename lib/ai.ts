// AI 호출: 업스테이지·ChatGPT·Gemini는 OpenAI 호환 주소로, Claude는 Anthropic SDK로.
// 학생 이름은 보내지 않는다(가명·기록만).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { leaks } from "./rules.ts";
import { EMOTION_NAMES, REASON_NAMES, TONES, emotionOf, type MoodRecord, type Provider } from "./shared.ts";

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
  목소리 이야기를 question에 꺼내지는 마.`;

// 위험한 마음이 보이면 아이에게 더 묻지 않는다(교사 화면 알림으로 넘김)
export const RISK_REPLY = "말해 줘서 정말 고마워. 선생님이 꼭 알고 있을게.";

export interface Analysis {
  emotion: string;
  intensity: number;
  reason: string;
  summary: string;
  question: string;
  options: string[];
  risk: boolean;
}

const SKIP = "말하기 싫어요";

// AI 없이도 되묻기가 되도록 까닭별 기본 질문
const FALLBACK_Q: Record<string, [string, string[]]> = {
  친구: ["그때 친구랑 무슨 일이 있었어?", ["같이 놀았어", "다툼이 있었어"]],
  공부: ["어떤 시간 때문이었어?", ["수학 시간", "국어 시간"]],
  집: ["지금 마음은 어때?", ["조금 괜찮아", "아직 힘들어"]], // 집 일은 캐묻지 않는다
  몸: ["몸 어디가 그랬어?", ["머리", "배"]],
  그냥: ["지금 제일 하고 싶은 건 뭐야?", ["쉬고 싶어", "놀고 싶어"]],
};

export function fallbackQuestion(reason: string, emotion: string) {
  const [q, opts] = FALLBACK_Q[reason] ?? FALLBACK_Q["그냥"];
  const lead = emotionOf(emotion)?.group === "joy" ? "좋았겠다! " : "그랬구나. ";
  return { question: lead + q, options: [...opts, SKIP] };
}

type AnalyzeInput = { text?: string; card?: { emotion: string; intensity: number; reason: string }; vocab: string[]; voiceTone?: string };

export async function analyze(ai: AI, input: AnalyzeInput): Promise<Analysis> {
  return shape(input, await callJSON(ai, ANALYZE_SYSTEM, JSON.stringify(input), "mood", ANALYZE_SCHEMA));
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
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavBase64 } }, { text: JSON.stringify(input) }] }],
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
  const opts = Array.isArray(out.options) ? out.options.filter((o): o is string => typeof o === "string" && !!o.trim()).slice(0, 2) : [];
  return {
    emotion,
    reason,
    intensity: card?.intensity ?? Math.min(5, Math.max(1, Math.round(Number(out.intensity) || 3))),
    summary: String(out.summary ?? input.text ?? "").slice(0, 80),
    question: String(out.question ?? "").slice(0, 60) || fallbackQuestion(reason, emotion).question,
    options: [...(opts.length ? opts : fallbackQuestion(reason, emotion).options.slice(0, 2)), SKIP],
    risk: out.risk === true,
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
