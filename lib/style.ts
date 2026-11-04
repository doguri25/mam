// 사람이 쓴 글처럼: AI 글에 자주 나오는 번역투·기계식 단골 표현을 피한다.
// ① STYLE_RULES를 AI 지시문에 붙이고 ② polish()가 확실한 것(이중 피동·「~에 있어서」·끝맺음 공식)만 바로 고치고
// ③ styleHits()가 남은 것(「~를 통해」·「첫째·둘째」·빈말 평가 등)을 찾아 선생님 화면에 「다듬을 표현」으로 알린다.
// 한국어 글에만 쓴다(학생 화면이 다른 언어면 건드리지 않음).

export const STYLE_RULES = `
글투(사람이 쓴 자연스러운 한국어로, 번역투·기계식 표현은 쓰지 마):
- 「~를 통해」 대신 「~로」(예: 활동을 통해 알게 됨 → 활동으로 알게 됨).
- 이중 피동(되어지다·보여지다·쓰여지다) 대신 「된다·보인다·쓰인다」로 바로 끊어.
- 「이에 있어서」「~에 있어서」「~에 관하여」 같은 번역 조사 대신 「여기서」「~에서」「~을」 같은 일상 조사.
- 「다양한 요인에 의해」처럼 뭉뚱그리지 말고 구체적인 이유 1~2개를 바로 써.
- 「그는 그의 ~」「그녀」 같은 영어식 대명사를 쓰지 말고, 필요 없는 대명사는 빼.
- 「첫째·둘째·셋째」 기계식 번호를 붙이지 말고 앞뒤 문맥으로 자연스럽게 이어 써.
- 「결론적으로」「요약하자면」 같은 끝맺음 공식 없이 핵심부터 바로 말해.
- 「시사하는 바가 크다」 같은 빈말 평가 대신 실제로 무엇이 달라지는지 구체적으로.
- 「단순한 ~를 넘어」「새로운 패러다임」 같은 과장 어휘를 걷어 내고 사실만.
- 「~가 아니라 ~다」 대조를 되풀이하지 말고 담백한 평서문으로.`;

// ── 한글 글자에 받침 붙이기(보이 + ㄴ → 보인) ──
const JONG = { "ㄴ": 4, "ㄹ": 8, "ㅂ": 17, "ㅆ": 20 } as const;
function withJong(word: string, j: keyof typeof JONG) {
  const last = word.at(-1)!;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171 || code % 28) return word; // 받침이 이미 있으면 그대로(쓰지 않는 경우)
  return word.slice(0, -1) + String.fromCharCode(0xac00 + code + JONG[j]);
}

// 이중 피동: 「X지다」(X는 이미 피동의 어 꼴) → 피동 원형 B로
const PASSIVE: [string, string][] = [
  ["되어", "되"], ["보여", "보이"], ["쓰여", "쓰이"], ["잊혀", "잊히"], ["읽혀", "읽히"], ["놓여", "놓이"],
  ["닫혀", "닫히"], ["열려", "열리"], ["담겨", "담기"], ["불려", "불리"], ["나뉘어", "나뉘"], ["짜여", "짜이"],
];
function fixPassive(text: string) {
  let s = text;
  for (const [x, b] of PASSIVE) {
    s = s
      .replaceAll(`${x}집니다`, `${withJong(b, "ㅂ")}니다`)
      .replaceAll(`${x}진다`, `${withJong(b, "ㄴ")}다`)
      .replaceAll(`${x}졌`, withJong(x, "ㅆ"))
      .replaceAll(`${x}지는`, `${b}는`)
      .replaceAll(`${x}진`, withJong(b, "ㄴ"))
      .replaceAll(`${x}질`, withJong(b, "ㄹ"))
      .replaceAll(`${x}져`, x)
      .replaceAll(`${x}지`, b);
  }
  return s;
}

// 따옴표 안(학생이 쓴 말을 옮긴 곳)은 건드리지 않는다.
// 짝이 맞는 따옴표만 따옴표로 본다: 닫히지 않은 따옴표가 뒤 글을 통째로 삼키거나, 떨어진 곧은따옴표(")끼리 엉뚱하게 짝지어지지 않게
// 곧은따옴표(" ')는 글 처음이나 띄어쓰기·문장부호 뒤에서 열고, 띄어쓰기 바로 뒤에서는 닫지 않는다(don't 같은 영어 줄임표는 따옴표가 아님).
// split()에 쓰므로 묶음(괄호)은 바깥 하나만 둔다.
const OPENS = String.raw`(?<![^\s(\[{<,.:;!?…·~—-])`;
const QUOTED = new RegExp(
  "(" +
    [
      "“[^“”]*”",
      "「[^「」]*」",
      "『[^『』]*』",
      String.raw`‘(?:[^‘’\n]|’(?=[A-Za-z]))*’(?![A-Za-z])`,
      String.raw`${OPENS}"(?=\S)[^"\n]*?(?<=\S)"`,
      String.raw`${OPENS}'(?=\S)[^'\n]*?(?<=\S)'(?![A-Za-z])`,
    ].join("|") +
    ")",
);
const outside = (text: string, fn: (s: string) => string) => text.split(QUOTED).map((part, i) => (i % 2 ? part : fn(part))).join("");
const unquoted = (text: string) => text.split(QUOTED).filter((_, i) => i % 2 === 0).join(" ");

// 확실히 고쳐도 뜻이 그대로인 것만 바로 고친다
export function polish(text: string): string {
  if (!text) return text;
  return outside(text, fixPlain);
}

// 낱말 앞: 글 처음이거나 띄어쓰기·문장부호 뒤(「사이에」「종이에」「매점에」「뒷면에」처럼 더 긴 낱말의 끝은 아님)
const WORD_START = String.raw`(^|[\s(\[“"'‘「『,.!?·…])`;
// 「~에 있어(서)」 바로 뒤는 띄어쓰기나 쉼표(「있어요」「있었어요」는 건드리지 않음)
const PARTICLE = String.raw`에 있어서?(?=[\s,])`;
// 장소가 될 수 없는 말: 「관계에 있어서」는 늘 번역투
const ABSTRACT = "관계|학습|생활|발달|측면|과정|교육|상담|활동|표현|관리|인식|태도";
// 「점·면·부분」은 「이 점에 있어서」처럼 가리키는 말 뒤에서만(「빨간 점에 있어서 잘 보였어요」는 실제로 「있는」 말)
const POINTER = "이|그|저|이런|그런|이러한|그러한|여러|모든|어떤|다양한|많은";
// 「지도」는 가르침일 때만(「학교 지도에 있어서 찾기 쉬웠어요」는 실제로 「있는」 말)
const GUIDE = "생활|학생|인성|진로|교과|학습|개별|상담";
const ENDING = new RegExp(
  String.raw`(^|[.!?。]\s*|\n\s*)` +
    // 「결론적으로 말하면,」처럼 이어지는 말까지 함께 뺀다(남으면 「말하면,」만 덩그러니 남음)
    String.raw`(?:결론적으로(?:\s*(?:말하면|말하자면|이야기하면|얘기하면|보면|볼 때))?` +
    String.raw`|종합적으로\s*(?:말하면|말하자면|이야기하면|얘기하면|보면|볼 때)` + // 「종합적으로 생각하는 힘」은 그대로
    String.raw`|요약하자면|요약하면|요약해 보면|정리하자면|정리해 보면|종합하자면|종합해 보면)` +
    // 낱말 중간이면 빼지 않는다: 「결론적으로는」「정리해 보면서」「요약하자면요」(빼면 「는 잘했어요」「서 나누기」만 남음),
    // 「요약하면 돼요」「정리해 보면 좋겠어요」처럼 그 말 자체가 하려는 일이면 그대로
    String.raw`(?![가-힣])(?!\s*(?:돼|된|될|되|좋|어때|괜찮|안\s?돼))` +
    String.raw`,?\s*`,
  "g",
);

function fixPlain(text: string): string {
  let s = fixPassive(text);
  // 「이에 있어서」는 따로 쓴 낱말일 때만(「친구 사이에 있어서」「종이에 있어요」는 그대로)
  s = s.replace(new RegExp(`${WORD_START}이${PARTICLE}`, "g"), "$1여기서");
  s = s.replace(new RegExp(`${WORD_START}(${ABSTRACT})${PARTICLE}`, "g"), "$1$2에서");
  s = s.replace(new RegExp(String.raw`${WORD_START}((?:${POINTER})\s)(점|면|부분)${PARTICLE}`, "g"), "$1$2$3에서");
  s = s.replace(new RegExp(String.raw`${WORD_START}((?:${GUIDE})\s?)지도${PARTICLE}`, "g"), "$1$2지도에서");
  // 문장 앞 끝맺음 공식은 빼고 바로 핵심으로
  s = s.replace(ENDING, "$1");
  return s;
}

// 「첫째, …」처럼 문장·줄 첫머리에서 번호로 늘어놓을 때만(「첫째 언니」「둘째 오빠」 같은 가족은 빼고)
const ENUM = (n: string) => String.raw`(?:^|[.!?。:]\s*|\n\s*|[-•·]\s*)${n}(?:(?:로|는)?\s*[,:)]|로\s)`;

// 남아 있으면 선생님께 알려 줄 것(바로 고치면 뜻이 바뀔 수 있는 것)
const HITS: [RegExp, string][] = [
  [/[을를]\s?통(해|하여|한)/, "「~를 통해」 → 「~로」"],
  [/에 (관하여|관해서|대하여)/, "「~에 관하여」 → 「~에서·~을」"],
  [/다양한 (요인|이유|원인)/, "「다양한 요인」 → 구체적인 이유"],
  // 따로 쓴 낱말만(「블로그의」「그녀석」은 빼고)
  [/(?<![가-힣])(?:그녀(?=[은는이가의를도와에께들\s.,!?]|$)|그의\s)/, "영어식 대명사(그의·그녀)"],
  [new RegExp(`${ENUM("첫째")}[\\s\\S]*${ENUM("둘째")}`), "「첫째·둘째」 번호 → 이어 쓰기"],
  [/시사하는 바|시사점이 크/, "「시사하는 바가 크다」 → 무엇이 달라지는지"],
  [/단순한 .{1,12}[을를] 넘어|패러다임/, "과장 어휘(「~를 넘어」·패러다임)"],
];
const CONTRAST = /[가이]\s?아니라/g;

export function styleHits(raw: string): string[] {
  if (!raw) return [];
  const text = unquoted(raw);
  const out = HITS.filter(([re]) => re.test(text)).map(([, name]) => name);
  if ((text.match(CONTRAST) ?? []).length >= 2) out.push("「~가 아니라 ~다」 대조 되풀이");
  return out;
}

// 여러 칸을 한꺼번에: 고친 글과 남은 표현(겹치지 않게)
export function polishAll<T extends Record<string, unknown>>(o: T, keys: (keyof T)[]): { value: T; hits: string[] } {
  const value = { ...o };
  const hits = new Set<string>();
  for (const k of keys) {
    const v = value[k];
    if (typeof v !== "string") continue;
    const p = polish(v);
    (value as Record<keyof T, unknown>)[k] = p;
    for (const h of styleHits(p)) hits.add(h);
  }
  return { value, hits: [...hits] };
}
