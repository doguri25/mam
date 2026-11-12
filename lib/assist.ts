// 선생님 도우미(AI 챗봇): 화면·서버가 함께 쓰는 순수 함수(앱이 찾은 할 일, 학생 찾기, 자료함 찾기, AI 답 정리)
import { rank } from "./kb.ts";
import type { CrisisId } from "./crisis.ts";

// 챗봇이 열어 줄 수 있는 화면(선생님 메뉴 탭 id)
export const GO_TABS = {
  map: "마음 지도", cheer: "응원 한마디", letters: "공감 쪽지", referral: "상담 의견서", student: "학생별 누적 기록", sel: "학급 역량 진단",
  report: "주간 리포트", home: "가정 소식지", lesson: "교과서 연결", sheet: "활동지 피드백", roster: "학생 코드·QR", settings: "설정", guide: "사용 설명서",
} as const;
export type GoTab = keyof typeof GO_TABS;
export const isGoTab = (v: unknown): v is GoTab => typeof v === "string" && v in GO_TABS;

export interface Go { tab: GoTab; no?: number }
export interface TodoTip { title: string; due: string } // 챗봇이 권한 할 일(선생님이 「할 일에 넣기」를 눌러야 저장)
export interface ChatMsg {
  role: "me" | "bot";
  text: string;
  at: string;
  sources?: string[];
  todos?: TodoTip[];
  go?: Go[];
  crisis?: CrisisId[];
  nos?: number[]; // 이 답이 살펴본 학생 번호
}
export interface ChatThread { kind: "chat"; id: string; title: string; msgs: ChatMsg[]; createdAt: string; updatedAt: string }
export const CHAT_DAYS = 30; // 대화는 마지막으로 쓴 날부터 30일 지나면 지운다
export const CHAT_MAX = 30; // 학급마다 남기는 대화 수
export const MSG_MAX = 40; // 한 대화의 말 수
export const ASK_MAX = 1500; // 한 번에 물을 수 있는 글자 수

// ── 선생님 업무 목록 ──
export interface Todo { id: string; title: string; due: string; done: boolean; at: string; from?: "chat" }
export const TODO_MAX = 200;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const cleanTitle = (v: unknown, n = 120) => String(v ?? "").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, n);
export const cleanDue = (v: unknown) => (isDay(v) ? v : "");
// 다가오는 차례: 마치지 않은 것 먼저, 날짜 있는 것(이른 날) → 날짜 없는 것, 같으면 만든 차례
export function sortTodos(xs: Todo[]): Todo[] {
  return [...xs].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999") || a.at.localeCompare(b.at));
}
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  if (!due) return { text: "", late: false };
  const d = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (d < 0) return { text: `${-d}일 지남`, late: true };
  if (d === 0) return { text: "오늘", late: false };
  if (d === 1) return { text: "내일", late: false };
  return { text: `${d}일 남음`, late: false };
}

// ── 학교 연락처(위기 대응 때 바로 보이게) ──
export interface Contact { label: string; num: string }
export const CONTACT_SLOTS = ["Wee클래스(전문상담교사)", "교육지원청 학교폭력 담당", "Wee센터", "학교전담경찰관(SPO)", "아동보호전문기관", "정신건강복지센터", "보건실"];
export function cleanContacts(v: unknown): Contact[] {
  const xs = Array.isArray(v) ? v : [];
  return xs.flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const label = cleanTitle(o.label, 30), num = cleanTitle(o.num, 40);
    return label && num ? [{ label, num }] : [];
  }).slice(0, 20);
}

// ── 자료함(선생님이 올린 업무 문서·자료) ──
export type DocKind = "업무" | "사회정서" | "기타";
export const DOC_KINDS: DocKind[] = ["업무", "사회정서", "기타"];
export interface DocMeta { id: string; title: string; kind: DocKind; chars: number; at: string }
export const DOC_MAX = 20; // 학급마다 자료 수
export const DOC_CHARS = 120_000; // 자료 한 개의 글자 수(넘으면 자른다)
export const DOC_TOTAL = 600_000; // 학급 전체
export function cleanDocText(v: unknown): string {
  return String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" || c === "\t" ? c : " ")).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, DOC_CHARS);
}
// 글을 조금씩 겹치게 잘라 찾기 단위로(문단 경계를 되도록 지킨다)
export function chunks(text: string, size = 900, overlap = 150): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    if (end < text.length) {
      const cut = text.lastIndexOf("\n", end);
      if (cut > i + size * 0.5) end = cut;
    }
    out.push(text.slice(i, end).trim());
    if (end >= text.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out.filter(Boolean);
}
export interface DocHit { id: string; title: string; kind: DocKind; text: string; s: number }
export function searchDocs(query: string, docs: { meta: DocMeta; text: string }[], n = 4, min = 0.6): DocHit[] {
  const all = docs.flatMap((d) => chunks(d.text).map((text) => ({ d, text })));
  const s = rank(query, all.map((x) => ({ head: x.d.meta.title, body: x.text })));
  const hits = all.map((x, i) => ({ id: x.d.meta.id, title: x.d.meta.title, kind: x.d.meta.kind, text: x.text, s: s[i] })).filter((h) => h.s >= min);
  // 한 자료에서 너무 많이 가져오지 않게(자료마다 둘까지)
  const per = new Map<string, number>();
  return hits.sort((a, b) => b.s - a.s).filter((h) => {
    const k = (per.get(h.id) ?? 0) + 1;
    per.set(h.id, k);
    return k <= 2;
  }).slice(0, n);
}

// ── 물음에서 학생 찾기: 「3번」「3 번」, 가명(학생 코드·QR의 이름) ──
export function mentionedNos(text: string, students: { no: number; alias: string }[]): number[] {
  const out = new Set<number>();
  const known = new Set(students.map((s) => s.no));
  for (const m of text.matchAll(/(\d{1,2})\s?번/g)) {
    const n = Number(m[1]);
    if (known.has(n)) out.add(n);
  }
  for (const s of students) if (s.alias.length >= 2 && text.includes(s.alias)) out.add(s.no);
  return [...out].slice(0, 4);
}
export const meansThis = (text: string) => /(이|그|요)\s?(학생|아이|친구)|얘|이\s?녀석|지금\s?보는/.test(text);
export const isClassWide = (text: string) => /우리\s?반|반\s?(아이|애|학생|전체|분위기)|학생들|아이들|누가|누구|전체\s?(학생|적)|요즘\s?반|학급\s?(분위기|전체)|살펴볼\s?학생/.test(text);
export const wantsTodo = (text: string) => /할\s?일|업무|해야|마감|일정|언제까지|챙길|잊지|오늘\s?(뭐|무엇)|이번\s?주/.test(text);
// 선생님이 할 일·마감을 말했을 때만 「할 일로 적어 둘까요?」를 띄운다(AI가 앱이 찾은 일을 그대로 다시 권하지 않게)
export const saysTodo = (text: string) => /까지|마감|제출|챙겨|적어\s?(둬|줘|놔)|기억해|할\s?일에|잊지|\d+\s?월\s?\d+\s?일|다음\s?주|내일|모레/.test(text);

// ── 앱이 찾은 할 일 ──
export interface AppTodo { key: string; text: string; tab: GoTab; no?: number; urgent?: boolean }

// ── AI 답 정리: 정한 꼴만, 길이 제한, 모르는 화면은 버린다 ──
const strs = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && !!x.trim());
const objs = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
export function cleanAssist(out: Record<string, unknown>, opts: { nos: number[]; sources: string[] }) {
  const reply = String(out.reply ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 4000);
  const todos = objs(out.todos).map((t) => ({ title: cleanTitle(t.title), due: cleanDue(t.due) })).filter((t) => t.title).slice(0, 5);
  const seen = new Set<string>();
  const go = objs(out.go).flatMap((g) => {
    if (!isGoTab(g.tab)) return [];
    const no = Number(g.no);
    const item: Go = { tab: g.tab, ...(Number.isInteger(no) && opts.nos.includes(no) ? { no } : {}) };
    const k = `${item.tab}:${item.no ?? ""}`;
    if (seen.has(k)) return [];
    seen.add(k);
    return [item];
  }).slice(0, 3);
  // 자료 이름은 넘겨준 것 가운데서만(AI가 지어낸 출처가 보이지 않게)
  const sources = [...new Set(strs(out.sources).map((s) => s.trim()))].filter((s) => opts.sources.includes(s)).slice(0, 5);
  return { reply, todos, go, sources };
}
// 대화 제목: 첫 물음 앞부분
export const threadTitle = (text: string) => cleanTitle(text, 40) || "새 대화";

// 화면에서 실명을 번호로 바꿔 보낸다(실명은 이 기기에만 있다). 긴 이름부터 바꿔 「김민」이 「김민준」 일부를 먼저 바꾸지 않게.
export function hideNames(text: string, names: Record<number, string>): { text: string; hit: boolean } {
  let out = text, hit = false;
  const list = Object.entries(names).filter(([, n]) => n && n.trim().length >= 2).sort((a, b) => b[1].length - a[1].length);
  for (const [no, name] of list) {
    const n = name.trim();
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 성을 뗀 이름(민준이, 민준아)도: 세 글자 이름이면 뒤 두 글자
    const given = n.length === 3 ? n.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;
    const re = new RegExp(given ? `${esc}|${given}(?=[이가아야는은을를의도랑와과에]|\\s|$)` : esc, "g");
    if (re.test(out)) {
      hit = true;
      out = out.replace(re, `${no}번`);
    }
  }
  return { text: out, hit };
}
