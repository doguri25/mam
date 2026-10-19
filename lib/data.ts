// 반 명단·설정·기록을 읽고 쓰는 곳
import { decrypt, newCode, type Pin } from "./auth.ts";
import { today } from "./date.ts";
import { demoExtras, demoLooks, demoRecords, demoStudents } from "./demo.ts";
import { db, isDemo, outOfSpace } from "./db.ts";
import { DEFAULT_RISK_WORDS, DEFAULT_RULES, DEFAULT_VOCAB, PROVIDERS, PROVIDER_IDS, cleanLook, type BuddyLook, type MoodRecord, type Provider, type Rules, type Student, type VoiceMode } from "./shared.ts";

export interface Settings {
  className: string;
  provider: Provider;
  models: Record<Provider, string>;
  keys: Partial<Record<Provider, string>>; // 암호화된 값
  vocab: string[];
  riskWords: string[];
  checks: Record<string, string>; // 「살펴봤어요」 표시: `${no}_${주 시작일}` → 시각
  voiceMode: VoiceMode; // 말투: 끄기 · 기기 안에서 재기 · Gemini가 듣기
  rules: Rules;
}

export function defaultSettings(): Settings {
  return {
    className: "3학년 2반",
    provider: "upstage",
    models: Object.fromEntries(PROVIDER_IDS.map((p) => [p, PROVIDERS[p].model])) as Record<Provider, string>,
    keys: {},
    vocab: DEFAULT_VOCAB,
    riskWords: DEFAULT_RISK_WORDS,
    checks: {},
    voiceMode: "device",
    rules: DEFAULT_RULES,
  };
}

export async function getSettings(): Promise<Settings> {
  const s = await db().get<Partial<Settings>>("meta", "settings");
  const d = defaultSettings();
  return { ...d, ...s, models: { ...d.models, ...s?.models }, rules: { ...d.rules, ...s?.rules } };
}

export async function saveSettings(s: Settings) {
  await db().set("meta", "settings", { ...s });
  await touch("other");
}

export async function getRoster(): Promise<Student[]> {
  return (await db().get<{ students: Student[] }>("meta", "roster"))?.students ?? [];
}

export async function rosterIsDemo() {
  return (await db().get<{ demo?: boolean }>("meta", "roster"))?.demo === true;
}

// demo: 시연(연습)용 가짜 명단인지 — 교사 화면에 「연습 데이터」 띠를 띄운다
export async function saveRoster(students: Student[], demo = false) {
  await db().set("meta", "roster", { students: [...students].sort((a, b) => a.no - b.no), demo });
  await touch("other");
}

// 「1 햇살」, 「1,햇살」, 「1	햇살」 한 줄에 한 명. 같은 번호는 원래 코드를 그대로 둔다.
export function parseRoster(text: string, old: Student[]): Student[] {
  const taken = new Set(old.map((s) => s.code));
  const seen = new Set<number>();
  const out: Student[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s*[,.\t ]\s*(.{1,12})$/);
    if (!m) continue;
    const no = Number(m[1]);
    if (seen.has(no)) continue;
    seen.add(no);
    const prev = old.find((s) => s.no === no);
    out.push({ no, alias: m[2].trim(), code: prev?.code ?? newCode(taken) });
    taken.add(out.at(-1)!.code);
  }
  return out;
}

// 체험 공간은 실제 반에 넣은 AI 키를 빌려 쓰되 하루 DEMO_AI_PER_DAY번까지만(키는 화면에 나가지 않는다)
export const DEMO_AI_PER_DAY = 200;
const keySettings = () => (isDemo() ? outOfSpace(() => getSettings()) : getSettings());

export async function demoAiUsed() {
  const u = await db().get<{ date: string; n: number }>("meta", "aiUsage");
  return u?.date === today() ? u.n : 0;
}
async function spendDemoAi() {
  if (!isDemo()) return true;
  const n = await demoAiUsed();
  if (n >= DEMO_AI_PER_DAY) return false;
  await db().set("meta", "aiUsage", { date: today(), n: n + 1 });
  return true;
}

// 체험 전용 AI 키(Vercel 환경 변수 TRIAL_AI_KEY · TRIAL_AI_PROVIDER · TRIAL_AI_MODEL).
// 있으면 체험 공간은 실제 반의 키를 빌리지 않고 이 키만 쓴다(하루 제한은 그대로).
function trialKey(): { provider: Provider; key: string; model: string } | null {
  const key = process.env.TRIAL_AI_KEY?.trim();
  if (!key) return null;
  const want = process.env.TRIAL_AI_PROVIDER?.trim() as Provider;
  const provider = PROVIDER_IDS.includes(want) ? want : "upstage";
  return { provider, key, model: process.env.TRIAL_AI_MODEL?.trim() || PROVIDERS[provider].model };
}

// 체험 화면에 보여 줄 AI 출처: 체험 전용 키 / 실제 반 키 빌려 씀 / 없음
export async function trialAiSource(): Promise<"trial" | "class" | "none"> {
  if (trialKey()) return "trial";
  const s = await outOfSpace(() => getSettings());
  return s.keys[s.provider] ? "class" : "none";
}

// 체험 공간이 실제로 부르는 AI(체험 전용 키 또는 빌려 쓰는 실제 반 키). 화면에 AI 이름을 맞게 보이려고.
export async function demoProvider(): Promise<Provider> {
  return trialKey()?.provider ?? (await keySettings()).provider;
}

// 한 제공자의 키만(교과서 읽기 Document Parse·Gemini 음성 듣기)
export async function rawKey(p: Provider) {
  const tk = isDemo() ? trialKey() : null;
  if (tk) return tk.provider === p && (await spendDemoAi()) ? tk.key : null;
  const box = (await keySettings()).keys[p];
  const key = box ? decrypt(box) : null;
  return key && (await spendDemoAi()) ? key : null;
}

export async function aiConfig(provider?: Provider) {
  const tk = isDemo() ? trialKey() : null;
  if (tk) return (!provider || provider === tk.provider) && (await spendDemoAi()) ? { provider: tk.provider, model: tk.model, key: tk.key } : null;
  const s = await keySettings();
  const p = provider ?? s.provider;
  const box = s.keys[p];
  const key = box ? decrypt(box) : null;
  return key && (await spendDemoAi()) ? { provider: p, model: s.models[p], key } : null;
}

// ── 기록 읽기: 통째로 읽지 않고 필요한 만큼만(Firestore 읽기 횟수 = 돌려받은 문서 수) ──
export const allRecords = () => db().all<MoodRecord>("records"); // 내보내기에서만
export const recordsOf = (no: number) => db().find<MoodRecord>("records", "no", "==", no);
export const recordsFrom = (date: string) => db().find<MoodRecord>("records", "date", ">=", date);
export const recordsChangedAfter = (ms: number) => db().find<MoodRecord>("records", "updatedAt", ">", ms);

export async function putRecord(r: MoodRecord) {
  await db().set("records", r.id, { ...r, updatedAt: Date.now() });
  await touch("records");
}

// 변경 표시: 교사 화면은 이 문서 하나만 자주 읽고, 바뀌었을 때만 기록을 더 읽는다
export interface Stamp {
  records: number;
  other: number;
  wipe?: number; // 기록을 지운 때. 교사 기기에 저장해 둔 기록을 버리고 다시 받게 한다.
}
export async function getStamp(): Promise<Stamp> {
  return (await db().get<Stamp>("meta", "stamp")) ?? { records: 0, other: 0 };
}
export async function touch(kind: keyof Stamp) {
  await db().set("meta", "stamp", { ...(await getStamp()), [kind]: Date.now() });
}

// 학생마다 꾸민 마음 친구(번호 → 모습). 문서 하나에 모아 두어 교사 화면도 한 번에 읽는다.
export async function getLooks(): Promise<Record<number, BuddyLook>> {
  const items = (await db().get<{ items: Record<number, BuddyLook> }>("meta", "looks"))?.items ?? {};
  return Object.fromEntries(Object.entries(items).map(([no, l]) => [no, cleanLook(l)])); // 예전 모습엔 새 항목이 없을 수 있음
}
export async function saveLooks(items: Record<number, BuddyLook>) {
  await db().set("meta", "looks", { items });
}

// 선생님이 바꾼 비밀번호(해시). 화면 설정과 따로 두어 overview로 나가지 않게 한다.
export const getPin = () => db().get<Pin>("meta", "pin");
export const savePin = (p: Pin) => db().set("meta", "pin", { ...p });

// 선생님이 올린 교과서·학습지 차시(감정 단어·활동)
export interface LessonItem {
  id: string;
  unit: string;
  words: string[];
  activities: { title: string; how: string; minutes: number }[];
  createdAt: string;
}
export async function getLessons(): Promise<LessonItem[]> {
  return (await db().get<{ items: LessonItem[] }>("meta", "lessons"))?.items ?? [];
}

// 연습 데이터 새로 만들기: 기록·응원·메모·쪽지·돌아보기를 비우고 가명 25명과 최근 7일 기록을 한꺼번에 넣는다
export async function seedPractice() {
  for (const col of ["records", "cheers", "notes", "letters", "reflects"] as const) await db().clear(col);
  if (isDemo()) await db().clear("sheets"); // 체험 공간은 여럿이 함께 쓰므로 하루마다 비움(실제 반의 활동지 피드백은 그대로)
  const date = today();
  const taken = new Set<string>();
  await saveRoster(demoStudents(() => {
    const c = newCode(taken);
    taken.add(c);
    return c;
  }), true);
  await saveLooks(demoLooks());
  const now = Date.now();
  await db().setMany("records", demoRecords(date).map((r) => [r.id, { ...r, updatedAt: now }]));
  const extra = demoExtras(date);
  await db().setMany("letters", extra.letters.map((l) => [l.id, { ...l }]));
  await db().setMany("reflects", extra.reflects.map((r) => [r.id, { ...r }]));
  await saveSettings({ ...(await getSettings()), checks: {} });
  await db().set("meta", "practiceDay", { date });
  await touch("wipe");
  await touch("records");
}
