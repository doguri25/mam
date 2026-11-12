// AI 호출: 업스테이지·ChatGPT·Gemini는 OpenAI 호환 주소로, Claude는 Anthropic SDK로.
// 학생 이름은 보내지 않는다(가명·기록만).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { leaks } from "./rules.ts";
import { STYLE_RULES, polish, polishAll, styleHits } from "./style.ts";
import { SKIP, fallbackFor, langOf, type Lang } from "./i18n.ts";
import { ALL_SUB_WORDS, EMOTION_NAMES, REASON_NAMES, SUB_WORDS, isWordOf, SEL_AREAS, TONES, emotionOf, type MoodRecord, type Provider, type SheetItem, type SheetPoint } from "./shared.ts";

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

export const BAD_JSON = "AI 답을 읽지 못했어요. 다시 눌러 주세요.";

// 여는 괄호({ 또는 [) 자리에서 짝이 맞는 닫는 괄호 자리. 따옴표 안의 괄호는 세지 않는다. 끝이 잘렸으면 -1.
function closeOf(s: string, start: number) {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

// AI 답에서 JSON 꺼내기: ```json 울타리나 앞뒤 설명 글이 붙어도 가장 바깥 JSON 객체(또는 배열) 하나를 찾는다.
// 끝이 잘렸거나 JSON이 없으면 선생님이 읽을 한국어 오류.
export function extractJSON(text: string): unknown {
  const s = text.trim(); // trim()은 맨 앞 BOM도 걷어 낸다
  try {
    return JSON.parse(s);
  } catch {
    // 아래에서 울타리·설명 글을 걷어 내고 다시
  }
  for (let i = s.search(/[{[]/), n = 0; i >= 0 && n < 20; n++) {
    const end = closeOf(s, i);
    if (end < 0) break; // 끝이 잘림: 안쪽 작은 객체를 답으로 잘못 고르지 않게 여기서 멈춤
    try {
      return JSON.parse(s.slice(i, end + 1));
    } catch {
      const next = s.slice(end + 1).search(/[{[]/);
      i = next < 0 ? -1 : end + 1 + next;
    }
  }
  throw new Error(BAD_JSON);
}

// 스키마가 모두 객체라 답도 객체여야 한다([{…}] 하나로 감싸 오면 벗긴다)
export function parseJSON(text: string): Record<string, unknown> {
  let out = extractJSON(text);
  if (Array.isArray(out) && out.length === 1) out = out[0];
  if (!out || typeof out !== "object" || Array.isArray(out)) throw new Error(BAD_JSON);
  return out as Record<string, unknown>;
}

// SDK·네트워크 오류(영어)를 선생님 화면에 그대로 보여 줄 짧은 한국어로. 이미 한국어로 만든 오류는 그대로.
export function aiError(e: unknown): Error {
  const err = (e ?? {}) as { name?: unknown; status?: unknown; message?: unknown };
  const name = String(err.name ?? "");
  const message = String(err.message ?? "");
  if (/abort|timeout/i.test(name) || /timed? ?out|aborted/i.test(message)) return new Error("AI 답이 너무 늦어요. 잠시 뒤 다시 눌러 주세요.");
  const status = Number(err.status) || 0;
  if (status === 401 || status === 403) return new Error("AI 키가 맞지 않아요. 「설정」에서 키를 확인해 주세요.");
  if (status === 404) return new Error("AI 모델을 찾지 못했어요. 「설정」에서 모델 이름을 확인해 주세요.");
  if (status === 429) return new Error("AI 사용량이 잠시 넘쳤어요. 조금 뒤 다시 눌러 주세요.");
  if (status >= 500) return new Error(`AI 서버가 잠시 답하지 않아요(${status}). 조금 뒤 다시 눌러 주세요.`);
  if (status) return new Error(`AI가 요청을 받지 않았어요(${status}). 잠시 뒤 다시 눌러 주세요.`);
  if (/connection|fetch failed|network|ECONN|ENOTFOUND/i.test(`${name} ${message}`)) return new Error("AI 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
  if (e instanceof Error && /[가-힣]/.test(message)) return e;
  return new Error("AI를 부르지 못했어요. 다시 눌러 주세요.");
}

// 문서 읽기(업스테이지)와 AI를 잇달아 부르는 라우트(교과서·활동지)용: 정한 시간이 지나면 기다리지 않고 멈춘다.
// Vercel이 maxDuration에서 함수를 끊으면 화면에는 알아보기 어려운 오류만 가므로, 그 전에 한국어로 답하려고.
export function inTime<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

// 그 라우트가 선생님께 보일 오류 한 줄. late: 라우트의 남은 시간이 다 됨, tooLong: 그때 보일 말
export function docError(e: unknown, late: boolean, tooLong: string): string {
  const err = (e ?? {}) as { name?: unknown; message?: unknown };
  // 업스테이지 쪽 시간 초과는 SDK를 거치지 않아 DOMException(TimeoutError)으로 온다
  if (late || /abort|timeout/i.test(String(err.name ?? ""))) return tooLong;
  const m = /Document Parse (\d+)/.exec(String(err.message ?? ""));
  if (m) {
    const status = Number(m[1]);
    if (status === 401 || status === 403) return "업스테이지 키가 맞지 않아요. 「설정」에서 키를 확인해 주세요.";
    if (status === 413) return "파일이 너무 커서 읽지 못했어요. 필요한 쪽만 잘라서 올려 주세요.";
    if (status === 429) return "업스테이지 사용량이 잠시 넘쳤어요. 조금 뒤 다시 해 주세요.";
    return `업스테이지 문서 읽기가 실패했어요(${status}). 잠시 뒤 다시 해 주세요.`;
  }
  return `읽지 못했어요: ${aiError(e).message}`.slice(0, 300);
}

// images: JPEG base64(data: 머리 없이). 그림을 볼 수 있는 Claude·ChatGPT·Gemini에서만 쓴다(Solar는 글만).
// signal: 부르는 쪽(라우트)의 남은 시간. 끊기면 다시 시도하지 않고 바로 오류.
export async function callJSON(
  ai: AI, system: string, user: string, name: string, schema: Record<string, unknown>, images: string[] = [], signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let text: string | null | undefined;
  try {
    text = await ask(ai, system, user, name, schema, images, signal);
  } catch (e) {
    const out = aiError(e);
    if (out !== e) console.error("AI 호출 실패", e);
    throw out;
  }
  if (!text) throw new Error("AI 답이 비어 있어요. 다시 눌러 주세요.");
  return parseJSON(text);
}

async function ask(ai: AI, system: string, user: string, name: string, schema: Record<string, unknown>, images: string[], signal?: AbortSignal) {
  const timeout = images.length ? 55_000 : 40_000;
  if (ai.provider === "claude") {
    const client = new Anthropic({ apiKey: ai.key, timeout, maxRetries: images.length ? 0 : 1 });
    const content = images.length
      ? [...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })), { type: "text" as const, text: user }]
      : user;
    const params = {
      model: ai.model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user" as const, content }],
      output_config: { format: { type: "json_schema" as const, schema }, effort: "low" as const },
    };
    const res = CLAUDE_FALLBACK.has(ai.model)
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as never, { signal })
      : await client.messages.create(params, { signal });
    const msg = res as Anthropic.Message;
    if (msg.stop_reason === "refusal") throw new Error("AI가 이 요청에 답하지 않았어요.");
    return msg.content.find((b) => b.type === "text")?.text;
  }
  const client = new OpenAI({ apiKey: ai.key, baseURL: BASE_URL[ai.provider], timeout, maxRetries: images.length ? 0 : 1 });
  const res = await client.chat.completions.create({
    model: ai.model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: images.length
          ? [...images.map((data) => ({ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${data}` } })), { type: "text" as const, text: user }]
          : user,
      },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    // 업스테이지는 추론을 꺼서 빠르게(아이가 기다리는 화면)
    ...(ai.provider === "upstage" ? { reasoning_effort: "none" as never, temperature: 0.4 } : {}),
  }, { signal });
  return res.choices[0]?.message.content;
}

// AI가 준 배열에서 객체·글자만 골라 쓴다(null·숫자가 섞여 와도 멈추지 않게)
const objs = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
const strs = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && !!x.trim());
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

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
  word: { type: "string", enum: ["", ...ALL_SUB_WORDS], description: "emotion에 맞는 더 꼭 맞는 말(nuance[emotion] 중 하나), 없으면 빈 글자" },
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
- word: emotion을 정한 뒤, nuance[emotion] 말 중 학생 말에 더 꼭 맞는 하나. card만 있고 단서가 없으면 빈 글자.
- lang이 ko가 아니면 학생은 그 언어를 써(en English, zh 简体中文, vi Tiếng Việt, ja 日本語).
  question과 options는 그 언어로, 그 나라 3학년 아이에게 말하듯 쉽게. summary는 늘 한국어로(선생님이 읽어) — 학생 말을 한국어로 옮겨 한 줄로.
- question과 options를 한국어로 쓸 때는 아래 글투를 지켜.${STYLE_RULES}`;

const NUANCE_JSON = JSON.stringify(SUB_WORDS);

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
  const out = parseJSON(text);
  return {
    ...shape(input, out),
    tone: (TONES as readonly string[]).includes(str(out.tone)) ? str(out.tone) : null,
    toneWhy: str(out.toneWhy).slice(0, 30),
  };
}

// 되묻기 질문과 대답 보기는 늘 같은 곳에서: 둘 다 AI 것이 쓸 만하면 AI 것, 하나라도 비면 둘 다 기본 되묻기
export function shape(input: AnalyzeInput, out: Record<string, unknown>): Analysis {
  const card = input.card;
  const emotion = card?.emotion ?? (EMOTION_NAMES.includes(str(out.emotion)) ? str(out.emotion) : "그저 그래요");
  const reason = card?.reason ?? (REASON_NAMES.includes(str(out.reason)) ? str(out.reason) : "그냥");
  const lang = input.lang ?? "ko";
  const ko = (s: string) => (lang === "ko" ? polish(s) : s);
  const opts = [...new Set(strs(out.options).map((o) => o.trim()).filter((o) => o !== SKIP[lang]))].slice(0, 2).map(ko);
  const question = ko(str(out.question).trim()).slice(0, 80);
  const fb = fallbackQuestion(reason, emotion, lang);
  const fromAI = !!question && opts.length > 0;
  const word = str(out.word);
  return {
    emotion,
    reason,
    intensity: card?.intensity ?? Math.min(5, Math.max(1, Math.round(Number(out.intensity) || 3))),
    summary: (out.summary == null ? input.text ?? "" : str(out.summary)).slice(0, 80),
    question: fromAI ? question : fb.question,
    options: [...(fromAI ? opts : fb.options.slice(0, 2)), SKIP[lang]],
    risk: out.risk === true,
    word: isWordOf(emotion, word) ? word : "", // 고른 감정의 말이 아니면 버림
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
- acknowledge: 마음을 알아주는 데 중심을 둔 초안. encourage: 작은 응원이나 함께 해 볼 일을 건네는 초안. 두 초안은 문장이 겹치지 않게.${STYLE_RULES}`;

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
    return [out.acknowledge, out.encourage].filter((d): d is string => typeof d === "string" && !!d.trim()).map((d) => polish(d.trim()));
  };
  let drafts = await ask();
  // 선생님용 숫자·말이 섞이면 한 번만 다시 쓰게 하고, 그래도 남으면 화면에 표시
  const found = [...new Set(drafts.flatMap(leaks))];
  if (found.length) {
    const again = await ask(`\n- 지난 초안에 「${found.join("」, 「")}」 같은 말이 들어갔어. 이런 말은 빼고 다시 써.`).catch(() => drafts);
    if (again.flatMap(leaks).length < drafts.flatMap(leaks).length) drafts = again;
  }
  // styles: 바로 고치지 못한 번역투·기계식 표현(선생님이 보고 다듬게)
  return { drafts, warns: drafts.map((d) => leaks(d).join(", ")), styles: drafts.map((d) => styleHits(d)) };
}

// ── 학급 역량 진단 피드백 초안: 영역별 수준과 학생이 고른 문장만 보낸다(이름·번호·선생님 메모는 보내지 않음) ──
const SEL_FEEDBACK_SYSTEM = `너는 초등학교 3학년 담임 선생님이 사회정서역량 「마음 점검」(32문장 자기 점검)을 마친 학생에게 건넬 피드백 초안을 쓰는 도우미야.
- 「영역」에는 학생이 스스로 답한 수준과, 있으면 선생님이 관찰한 수준이 있어. 「잘한다고고른문장」「어렵다고고른문장」은 학생이 직접 고른 답이야.
- 잘하고 있는 점 하나를 그 문장에 맞게 구체적으로 알아주고, 더 자랄 점 하나는 함께 해 볼 작은 일로 건네.
- 수준 이름(아주 잘함, 잘함, 자라나는 중, 도움 필요)·점수·"검사" "진단" "결과" 같은 말은 아이에게 쓰지 마. 다른 친구와 비교하거나 꾸짖지 마.
- 입력에 없는 사건·장소·감정을 지어내지 마. 「집」 이야기는 꺼내지 마.
- 선생님이 아이에게 말하는 따뜻한 말투(~구나, ~해 줘서 고마워), 3문장 안팎, 한 문장은 40자 안.
- praise: 잘하는 점을 알아주는 데 중심을 둔 초안. grow: 함께 해 볼 일을 건네는 데 중심을 둔 초안. 두 초안은 문장이 겹치지 않게.${STYLE_RULES}`;
const SEL_LEAK = /아주 ?잘함|자라나는 ?중|도움 ?필요|점수|진단|검사|결과|\d+ ?점/g;
export interface SelDraftInput {
  영역: { 이름: string; 스스로: string; 선생님관찰?: string }[];
  잘한다고고른문장: string[];
  어렵다고고른문장: string[];
}
export async function selFeedback(ai: AI, input: SelDraftInput) {
  const schema = obj({ praise: { type: "string" }, grow: { type: "string" } });
  const ask = async (extra = "") => {
    const out = await callJSON(ai, SEL_FEEDBACK_SYSTEM + extra, JSON.stringify(input), "selfeedback", schema);
    return [out.praise, out.grow].filter((d): d is string => typeof d === "string" && !!d.trim()).map((d) => polish(d.trim()));
  };
  const hits = (ds: string[]) => [...new Set(ds.flatMap((d) => d.match(SEL_LEAK) ?? []))];
  let drafts = await ask();
  const found = hits(drafts);
  if (found.length) {
    const again = await ask(`\n- 지난 초안에 「${found.join("」, 「")}」 같은 말이 들어갔어. 이런 말은 빼고 다시 써.`).catch(() => drafts);
    if (hits(again).length < found.length) drafts = again;
  }
  return { drafts, warns: drafts.map((d) => (d.match(SEL_LEAK) ?? []).join(", ")), styles: drafts.map((d) => styleHits(d)) };
}

// ── 서면 검사지 읽기: 기기가 확신하지 못한 문장의 체크 칸, 빈 검사지의 손글씨 번호(이름 등 다른 글은 옮기지 않음) ──
const PAPER_SYSTEM = `너는 초등학교 선생님이 학생이 손으로 표시한 종이 검사지를 옮겨 적도록 돕는 도우미야.
검사지는 문장마다 다섯 칸(1 전혀 그렇지 않아요 · 2 그렇지 않아요 · 3 보통이에요 · 4 그래요 · 5 매우 그래요) 가운데 하나에 학생이 ✔·○·×·색칠 같은 표시를 한 것이야.
- 받은 「읽을문장」(문장 번호와 글)마다 학생이 표시한 칸을 1~5로 적어. 표시가 없거나, 두 칸 이상이라 고를 수 없거나, 알아볼 수 없으면 0.
- 「번호도」가 true면 검사지의 번호 칸(손글씨)이나 찍힌 번호를 숫자로 적고, 알아볼 수 없으면 0.
- 보이는 것만 옮겨. 짐작해서 채우지 말고, 이름 같은 다른 글은 옮기지 마.`;
export interface PaperAsk { 읽을문장: { 번호: number; 글: string }[]; 번호도: boolean }
export async function readPaper(ai: AI, ask: PaperAsk, images: string[], parsed?: string, signal?: AbortSignal) {
  const schema = obj({ no: { type: "integer" }, answers: { type: "array", items: obj({ item: { type: "integer" }, value: { type: "integer" } }) } });
  const system = PAPER_SYSTEM + (parsed ? "\n- 그림 대신 검사지를 글로 읽은 결과(마크다운)가 온다. 표의 칸에 남은 ✔·V·O·● 같은 글자로 표시를 판단해." : "");
  const out = await callJSON(ai, system, JSON.stringify({ ...ask, ...(parsed ? { 검사지글: parsed.slice(0, 12000) } : {}) }), "paper", schema, parsed ? [] : images, signal);
  return cleanPaperRead(out, ask);
}
export function cleanPaperRead(out: Record<string, unknown>, ask: PaperAsk) {
  const want = new Set(ask.읽을문장.map((x) => x.번호));
  const answers: Record<number, number> = {};
  for (const a of objs(out.answers)) {
    const i = Number(a.item), v = Number(a.value);
    if (want.has(i) && Number.isInteger(v) && v >= 1 && v <= 5) answers[i] = v;
  }
  const n = Number(out.no);
  return { no: ask.번호도 && Number.isInteger(n) && n >= 1 && n <= 99 ? n : null, answers };
}

// ── 선생님 도우미(챗봇): 화면이 모은 자료(학생 기록·할 일·자료 카드·대응 안내)만 근거로 답한다 ──
export const ASSIST_SYSTEM = `너는 초등학교 선생님을 돕는 「마음빛 길잡이」 선생님 도우미야. 선생님과 한국어로 이야기해.
할 일: 사회정서교육 자료 안내, 우리 반 학생에 대한 물음, 학교 업무 물음, 글 쓰기(가정통신문·상담 기록 정리·문자 안내·공문 초안 등)와 생활지도 방법, 해야 할 업무 안내, 위기 학생·학교폭력·아동학대 대응 안내.
지킬 것:
- 결론부터 짧게. 필요하면 짧은 목록(- 로 시작)을 써. 굵은 글씨는 꼭 필요한 곳에만 **두 별표**.
- 근거는 받은 [자료]·[대응 안내]·[학생]·[할 일] 안의 내용만 써. 거기에 없는 법 조항·숫자·날짜·연락처를 지어내지 마. 모르면 모른다고 하고 확인할 곳(공문, 교육지원청 담당, 학교 계획)을 알려 줘.
- 학생은 번호와 가명으로만 불러. 진단명을 붙이지 말고, 기록에 있는 사실과 다음에 해 볼 일을 말해. 면담 메모·조치 기록은 필요한 만큼만 짧게 옮겨.
- 위기(학교폭력·아동학대·자살/자해)는 [대응 안내]를 따라 「지금 안전한지」와 「바로 할 일」을 먼저 말해. 법적 판단을 단정하지 말고 학교 절차와 담당자를 함께 안내해.
- 글을 써 달라면 바로 쓸 수 있는 초안을 주고, 학생 이름 자리는 ○○로 비워 둬.
- 선생님이 해야 할 일이나 마감을 말하면 todos에 짧은 제목과 날짜(YYYY-MM-DD, 모르면 빈 글자)로 넣어. 선생님이 부탁하지 않은 일은 넣지 마.
- 관련된 앱 화면이 있으면 go에 넣어(tab은 정해진 이름만, no는 그 학생 번호 또는 0).
- sources에는 실제로 쓴 [자료]·[대응 안내]의 이름만 그대로 적어.
${STYLE_RULES}`;
const ASSIST_TABS = ["map", "cheer", "letters", "referral", "student", "sel", "report", "home", "lesson", "sheet", "roster", "settings", "guide"];
export async function assistReply(ai: AI, user: string, signal?: AbortSignal) {
  const schema = obj({
    reply: { type: "string" },
    todos: { type: "array", items: obj({ title: { type: "string" }, due: { type: "string" } }) },
    go: { type: "array", items: obj({ tab: { type: "string", enum: ASSIST_TABS }, no: { type: "integer" } }) },
    sources: { type: "array", items: { type: "string" } },
  });
  const out = await callJSON(ai, ASSIST_SYSTEM, user, "assist", schema, [], signal);
  return { ...out, reply: polish(String(out.reply ?? "")) };
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
자료에 없는 내용은 지어내지 마.${STYLE_RULES}`;

export async function extractLesson(ai: AI, markdown: string, signal?: AbortSignal): Promise<Lesson> {
  const schema = obj({
    unit: { type: "string" },
    words: { type: "array", items: obj({ word: { type: "string" }, emotion: { type: "string", enum: EMOTION_NAMES }, meaning: { type: "string" } }) },
    activities: { type: "array", items: obj({ title: { type: "string" }, how: { type: "string" }, minutes: { type: "integer" } }) },
  });
  return cleanLesson(await callJSON(ai, LESSON_SYSTEM, markdown.slice(0, 20_000), "lesson", schema, [], signal));
}

const minutesOf = (v: unknown) => Math.min(45, Math.max(1, Number(v) || 10));
export function cleanLesson(out: Record<string, unknown>): Lesson {
  return {
    unit: str(out.unit).slice(0, 40),
    words: objs(out.words).map((x) => ({
      word: str(x.word).trim().slice(0, 12), emotion: EMOTION_NAMES.includes(str(x.emotion)) ? str(x.emotion) : "그저 그래요", meaning: str(x.meaning).slice(0, 40),
    })).filter((x) => x.word).slice(0, 8),
    activities: objs(out.activities).map((x) => ({
      title: polish(str(x.title)).slice(0, 30), how: polish(str(x.how)).slice(0, 120), minutes: minutesOf(x.minutes),
    })).filter((x) => x.title).slice(0, 4),
  };
}

// ── 이번 주 우리 반 마음 요약 + 다음 주 활동 추천(학생 이름·번호 없이 모은 숫자만 보냄) ──
export interface Weekly {
  lines: string[];
  activities: { title: string; why: string; how: string; minutes: number }[];
  style?: string[]; // 바로 고치지 못한 번역투·기계식 표현
}

const WEEKLY_SYSTEM = `너는 초등 3학년 담임 선생님의 학급 운영을 돕는 도우미야. 이번 주 우리 반 마음 기록을 모은 숫자(학생 이름 없음)를 보고
- lines: 이번 주 마음 흐름을 3줄로. 숫자 근거를 넣되 진단·평가 말은 쓰지 마. 각 줄 50자 안.
- activities: 다음 주 아침 활동이나 도덕·창체 시간에 할 활동 2개. why는 이번 주 흐름과 이어지는 까닭 한 문장, how는 하는 방법 한 문장, minutes 분.
  lessonActivities(선생님이 올린 교과서 활동)가 있으면 그중에서 먼저 고르고, 없으면 회복적 서클·감정 카드 놀이·칭찬 릴레이처럼 교실에서 흔히 하는 활동으로.
특정 학생을 떠올리게 하는 말은 쓰지 마.${STYLE_RULES}`;

export async function weeklySummary(ai: AI, stats: unknown, lessonActivities: unknown[]): Promise<Weekly> {
  const schema = obj({
    lines: { type: "array", items: { type: "string" } },
    activities: { type: "array", items: obj({ title: { type: "string" }, why: { type: "string" }, how: { type: "string" }, minutes: { type: "integer" } }) },
  });
  return cleanWeekly(await callJSON(ai, WEEKLY_SYSTEM, JSON.stringify({ stats, lessonActivities }), "weekly", schema));
}

export function cleanWeekly(out: Record<string, unknown>): Weekly {
  const lines = strs(out.lines).slice(0, 3).map((l) => polish(l.trim()).slice(0, 90));
  const activities = objs(out.activities).map((a) => ({
    title: polish(str(a.title)).slice(0, 30), why: polish(str(a.why)).slice(0, 120), how: polish(str(a.how)).slice(0, 160), minutes: minutesOf(a.minutes),
  })).filter((a) => a.title || a.how).slice(0, 2);
  const style = [...new Set([...lines, ...activities.flatMap((a) => [a.title, a.why, a.how])].flatMap(styleHits))];
  return { lines, activities, style };
}

// ── 한 주 돌아보기: 학생이 쓴 한 줄에 마음 친구가 짧게 답한다(학생이 고른 언어로) ──
const REFLECT_SYSTEM = `너는 초등학교 3학년 학생의 「마음 친구」야. 학생이 이번 주를 돌아보며 쓴 한 줄과 이번 주 감정 기록을 받아,
학생에게 1~2문장으로 다정하게 답해. 규칙:
- 학생이 쓴 내용을 구체적으로 알아주고 칭찬해. 평가·충고·훈계·약속은 하지 마.
- 힘들었다고 하면 그 마음을 알아주고, 필요하면 선생님께 이야기해도 된다고 덧붙여.
- 이름·번호·횟수·「기록」이라는 말은 쓰지 마. 3학년이 읽을 쉬운 말로, 반말로 따뜻하게.
- reply는 반드시 지정한 언어(lang)로 써. 한국어로 쓸 때는 아래 글투를 지켜.${STYLE_RULES}`;
export async function reflectReply(ai: AI, input: { lang: Lang; text: string; week: { emotion: string; word?: string }[] }) {
  const out = await callJSON(ai, REFLECT_SYSTEM, JSON.stringify({ ...input, lang: langOf(input.lang).ai }), "reflect", obj({ reply: { type: "string" } }));
  const raw = str(out.reply).trim();
  const reply = (input.lang === "ko" ? polish(raw) : raw).slice(0, 160);
  if (!reply || leaks(reply).length) throw new Error("답이 알맞지 않아요"); // 빈 배열도 참이라 .length로 본다
  return reply;
}

// ── 상담 연계 의견서 초안: 최근 2주 기록만 보고 관찰한 사실을 정리한다(진단하지 않음) ──
export interface Referral { flow: string; reasons: string; helps: string; style?: string[] }
const REFERRAL_SYSTEM = `너는 초등학교 담임 선생님이 Wee클래스·상담교사에게 보낼 「학생 관찰 의견」 초안을 돕는 도우미야.
학생 가명과 최근 2주 마음 기록(학생이 스스로 고른 감정·크기·까닭·한 문장, 마음 다스리기 도구 사용)과 살펴보기 신호를 받아 세 칸을 써.
- flow: 2주 동안 관찰된 정서 흐름 3~5문장(날짜·아침/하교 전 변화를 근거로, 사실 위주)
- reasons: 학생이 스스로 말한 까닭·상황 요약 2~3문장(학생이 쓴 말은 따옴표로)
- helps: 도움이 된 것으로 보이는 것(마음 다스리기 도구·좋았던 날의 까닭 등) 1~2문장
규칙: 진단명·병명·성격 단정(예: 우울증, ADHD, 불안장애, 공격적인 아이) 절대 쓰지 마. 추측은 「~로 보임」처럼 조심스럽게.
학생은 가명으로만 부르고, 가족에 관한 추측은 쓰지 마. 높임말(~함, ~보임 같은 개조식 말투)로 간결하게. 한국어로.${STYLE_RULES}`;
export async function referralDraft(ai: AI, input: { alias: string; records: unknown[]; signals: string[] }): Promise<Referral> {
  const schema = obj({ flow: { type: "string" }, reasons: { type: "string" }, helps: { type: "string" } });
  const out = await callJSON(ai, REFERRAL_SYSTEM, JSON.stringify(input), "referral", schema);
  const { value, hits } = polishAll({ flow: str(out.flow), reasons: str(out.reasons), helps: str(out.helps) }, ["flow", "reasons", "helps"]);
  return { flow: value.flow.slice(0, 700), reasons: value.reasons.slice(0, 500), helps: value.helps.slice(0, 300), style: hits };
}

// ── 가정 소식지 번역: 이주배경학생 가정에 보낼 같은 내용을 다른 언어로 ──
export async function translateNotice(ai: AI, text: string, lang: Exclude<Lang, "ko">) {
  const system = `너는 초등학교 가정 안내문을 번역하는 도우미야. 받은 한국어 안내문을 ${langOf(lang).ai}로 자연스럽게 번역해.
줄 나눔과 제목·목록 모양은 그대로 두고, 학부모가 읽기 쉬운 공손한 말로. 새 내용을 더하지 마.`;
  const out = await callJSON(ai, system, text.slice(0, 4000), "translate", obj({ text: { type: "string" } }));
  return str(out.text).slice(0, 6000);
}

// ── 활동지 피드백: 스캔한 활동지(글·그림)를 보고 사회정서교육 4대 핵심역량에 비추어 피드백과 그 이유를 쓴다 ──
const SHEET_SYSTEM = `너는 초등학교 3학년 담임 선생님이 학생 활동지(글·그림)에 피드백을 쓰도록 돕는 도우미야.
기준은 교육부 한국형 사회정서교육의 4대 핵심역량이야.
- 자기감정 인식·관리: 내 감정을 알아차리고 이름 붙이며, 알맞게 표현하고 다스림
- 관계 인식·관리: 다른 사람의 마음을 헤아리고(공감), 배려하며 이야기 나누고 함께 어울림, 갈등을 풀어 감
- 공동체 가치 인식·관리: 약속·규칙·존중·책임·나눔처럼 함께 살아가는 가치를 알고 실천함
- 정신건강 인식·관리: 힘든 마음·스트레스를 알아차리고 스스로 돌보거나 도움을 청함
받는 것: 선생님이 적은 topic(활동 주제)·content(활동 내용)·criteria(피드백 기준). 빈 칸이면 활동지를 보고 네가 알맞게 판단해.
그리고 활동지 이미지, 또는 업스테이지 Document Parse가 읽어 낸 글(그림은 설명 글로 옴). 여러 쪽이면 모두 한 학생의 활동지(앞뒤·이어지는 쪽)야.
쓸 것:
- read: 활동지에서 읽은 내용 2~3문장. 글은 학생이 쓴 말을 따옴표로 짧게 옮기고, 그림은 무엇을 그렸는지(사람·표정·색·장면) 보이는 대로.
  선생님이 AI가 제대로 읽었는지 확인하는 칸이야. 활동지에 적힌 학생 이름은 옮기지 마. 글씨를 알아보기 어려우면 지어내지 말고 「알아보기 어려움」이라고 써.
- topic: 선생님이 적은 주제가 있으면 그대로, 없으면 활동지를 보고 짐작한 주제 15자 안.
- criteria: 실제로 적용한 피드백 기준 한 문장(선생님 기준이 있으면 그것을 줄여서, 없으면 네가 세운 기준).
- strengths: 잘 드러난 점 1~2개. area는 4대 역량 중 가장 가까운 것, point는 무엇이 잘 드러났는지 한 문장, evidence는 근거가 된 활동지 속 말이나 그림.
- grow: 더 키워 볼 점 0~1개(같은 꼴). 모자람을 꼬집지 말고 다음에 해 볼 한 걸음으로.
- toStudent: 학생에게 돌려줄 피드백 2~3문장. 선생님이 3학년에게 말하는 다정한 말투로, 「~했구나」로 알아줘도 되지만 문장 끝은 「~해요」「~해 볼까요?」로(「~했어」「~거야」 같은 반말로 끝내지 마).
  활동지의 구체적인 내용을 짚어 알아주고, grow가 있으면 부드럽게 권해. 이름·점수·등급·다른 친구와 비교·진단하는 말은 쓰지 마.
- why: 이 피드백을 쓴 이유(선생님용) 2~3문장. 어떤 기준과 역량에 비추어, 활동지의 어떤 부분을 보고 그렇게 썼는지.
- check: 자해·사라지고 싶다·괴롭힘·폭력·학대가 걱정되는 글이나 그림이 있으면 무엇이 보였는지 한 문장(선생님이 직접 살펴보게). 없으면 빈 글자.
- blank: 활동지가 비었거나 거의 읽을 수 없으면 true(그때 strengths·grow는 비우고 toStudent는 빈 글자).
선생님이 읽는 칸(read·criteria·point·evidence·why)도 「~했어요」「~보여요」처럼 부드러운 높임말로 맞춰. 한국어로.
evidence와 read 속 학생 말은 학생이 쓴 그대로 따옴표 안에 옮기고, 나머지 글은 아래 글투를 지켜.${STYLE_RULES}`;

const POINT = obj({ area: { type: "string", enum: [...SEL_AREAS] }, point: { type: "string" }, evidence: { type: "string" } });
const SHEET_SCHEMA = obj({
  read: { type: "string" }, topic: { type: "string" }, criteria: { type: "string" },
  strengths: { type: "array", items: POINT }, grow: { type: "array", items: POINT },
  toStudent: { type: "string" }, why: { type: "string" }, check: { type: "string" }, blank: { type: "boolean" },
});

export type SheetFeedback = Omit<SheetItem, "no" | "pages">;
export async function sheetFeedback(
  ai: AI,
  input: { topic: string; content: string; criteria: string; parsed?: string },
  images: string[],
  signal?: AbortSignal,
): Promise<SheetFeedback> {
  const { parsed, ...teacher } = input;
  const user = JSON.stringify({ ...teacher, ...(parsed ? { parsed: parsed.slice(0, 8000) } : {}) });
  return cleanSheet(await callJSON(ai, SHEET_SYSTEM, user, "sheet", SHEET_SCHEMA, parsed ? [] : images, signal));
}

export function cleanSheet(out: Record<string, unknown>): SheetFeedback {
  // 학생 말을 옮긴 evidence는 고치지 않는다(read는 따옴표 밖만 고침)
  const points = (v: unknown, n: number): SheetPoint[] => objs(v).map((p) => ({
    area: (SEL_AREAS as readonly string[]).includes(str(p.area)) ? (str(p.area) as SheetPoint["area"]) : SEL_AREAS[0],
    point: polish(str(p.point)).slice(0, 160), evidence: str(p.evidence).slice(0, 160),
  })).filter((p) => p.point).slice(0, n);
  const { value: t, hits } = polishAll({ read: str(out.read), criteria: str(out.criteria), toStudent: str(out.toStudent), why: str(out.why) }, ["read", "criteria", "toStudent", "why"]);
  const strengths = points(out.strengths, 2), grow = points(out.grow, 1);
  const style = [...new Set([...hits, ...[...strengths, ...grow].flatMap((p) => styleHits(p.point))])];
  return {
    read: t.read.slice(0, 400), topic: str(out.topic).slice(0, 40), criteria: t.criteria.slice(0, 200),
    strengths, grow,
    toStudent: t.toStudent.slice(0, 300), why: t.why.slice(0, 400),
    check: str(out.check).slice(0, 200), blank: out.blank === true,
    ...(style.length ? { style } : {}),
  };
}
