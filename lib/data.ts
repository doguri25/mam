// 반 명단·설정·기록을 읽고 쓰는 곳
import { decrypt, makePin, newCode, validPin, type Pin } from "./auth.ts";
import { addDays, today } from "./date.ts";
import { PRACTICE_SHEET, demoExtras, demoLooks, demoRecords, demoRiskActions, demoSelChecks, demoSelfChecks, demoSheetRun, demoStudents } from "./demo.ts";
import { SPACE_COLS, db, inSpace, isDemo, outOfSpace, spaceId } from "./db.ts";
import { claimOnce, signupSlot, tidy as tidyLimits } from "./limit.ts";
import type { SelCheck } from "./selcheck.ts";
import { selfDocId, type SelfAnswer, type SelfRound } from "./selfcheck.ts";
import { cutoffOf, type PurgeLog, type Retention } from "./retention.ts";
import { DEFAULT_RISK_WORDS, DEFAULT_RULES, RISK_WORDS_V, riskWordsAfter, DEFAULT_VOCAB, PROVIDERS, PROVIDER_IDS, cleanLook, type BuddyLook, type MoodRecord, type RiskDraft, type SheetRun, type Provider, type RiskAction, type Rules, type Student, type VoiceMode } from "./shared.ts";

export interface Settings {
  className: string;
  provider: Provider;
  models: Record<Provider, string>;
  keys: Partial<Record<Provider, string>>; // 암호화된 값
  vocab: string[];
  riskWords: string[];
  riskWordsV?: number; // 기본 위험 표현 목록 판(새로 더한 말을 한 번만 넣어 주려고)
  checks: Record<string, string>; // 「살펴봤어요」 표시: `${no}_${주 시작일}` → 시각
  voiceMode: VoiceMode; // 말투: 끄기 · 기기 안에서 재기 · Gemini가 듣기
  rules: Rules;
  retention: Retention; // 기록 보관 기한(지나면 「정리할 기록」으로 알림)
}

export function defaultSettings(): Settings {
  return {
    className: "3학년 2반",
    provider: "upstage",
    models: Object.fromEntries(PROVIDER_IDS.map((p) => [p, PROVIDERS[p].model])) as Record<Provider, string>,
    keys: {},
    vocab: DEFAULT_VOCAB,
    riskWords: DEFAULT_RISK_WORDS,
    riskWordsV: RISK_WORDS_V,
    checks: {},
    voiceMode: "device",
    rules: DEFAULT_RULES,
    retention: "year",
  };
}

export async function getSettings(): Promise<Settings> {
  const s = await db().get<Partial<Settings>>("meta", "settings");
  const d = defaultSettings();
  const out: Settings = { ...d, ...s, models: { ...d.models, ...s?.models }, rules: { ...d.rules, ...s?.rules } };
  // 예전에 저장한 목록에는 그 판 뒤에 더한 기본 위험 표현만 한 번 넣어 준다(선생님이 그 뒤에 지우면 그대로 둠).
  // 설정을 한 번도 저장하지 않은 반은 새 기본 목록을 그대로 쓴다.
  if (s && (s.riskWordsV ?? 1) < RISK_WORDS_V) {
    out.riskWords = [...out.riskWords, ...riskWordsAfter(s.riskWordsV ?? 1).filter((w) => !out.riskWords.includes(w))];
    out.riskWordsV = RISK_WORDS_V;
  }
  return out;
}

export async function saveSettings(s: Settings) {
  await db().set("meta", "settings", { ...s });
  await touch("other");
}

export async function getRoster(): Promise<Student[]> {
  return (await db().get<{ students: Student[] }>("meta", "roster"))?.students ?? [];
}

// 연습 데이터가 남아 있나: 연습 명단이거나, 명단에 연습용 가짜 학생이 한 명이라도 있으면
// 연습 명단이 아니어도 연습 회차(자기진단·역량 진단)가 남아 있으면 「연습 데이터만 지우기」를 보여 준다
export async function rosterIsDemo() {
  const doc = await db().get<{ demo?: boolean; students?: Student[] }>("meta", "roster");
  if (doc?.demo === true || doc?.students?.some((s) => s.demo)) return true;
  const [rounds, sel] = await Promise.all([getSelfRounds(), getSelChecks()]);
  return rounds.some((r) => r.demo) || sel.some((c) => c.demo);
}

// demo: 시연(연습)용 가짜 명단인지 — 교사 화면에 「연습 데이터」 띠를 띄운다
// 학생 코드는 모든 학급을 통틀어 하나뿐이어야 한다(학생 로그인은 코드로 학급을 찾는다). 다른 학급이 쓰는 코드면 새로 뽑아
// 저장하고, 공간 밖 「codes」 색인(코드 → 학급 공간·번호)을 이 학급 명단에 맞춘다. 실제로 저장한 명단을 돌려준다.
interface CodeRow { id: string; space: string; no: number }
export async function saveRoster(students: Student[], demo = false) {
  const sp = spaceId();
  const index = await outOfSpace(() => db().all<CodeRow>("codes"));
  const others = new Set(index.filter((x) => x.space !== sp).map((x) => x.id));
  for (const old of ["", "demo"]) if (old !== sp) for (const s of await inSpace(old, getRoster)) others.add(s.code); // 색인 전에 만든 코드
  const taken = new Set([...others, ...students.map((s) => s.code)]);
  const list = [...students].sort((a, b) => a.no - b.no).map((s) => {
    if (!others.has(s.code)) return s;
    const code = newCode(taken);
    taken.add(code);
    return { ...s, code };
  });
  await db().set("meta", "roster", { students: list, demo });
  const mine = new Set(list.map((s) => s.code));
  await outOfSpace(async () => {
    for (const x of index) if (x.space === sp && !mine.has(x.id)) await db().del("codes", x.id);
    await db().setMany("codes", list.map((s): [string, Record<string, unknown>] => [s.code, { id: s.code, space: sp, no: s.no }]));
  });
  await touch("other");
  return list;
}

// 학생 코드 → 학급 공간(없으면 null). 색인이 생기기 전 코드는 홍북초·체험 명단에서 찾는다.
export async function locateCode(code: string): Promise<string | null> {
  if (!/^[A-Z0-9]{4,10}$/.test(code)) return null;
  const hit = await outOfSpace(() => db().get<CodeRow>("codes", code));
  if (hit) return hit.space;
  for (const sp of ["", "demo"]) if ((await inSpace(sp, getRoster)).some((s) => s.code === code)) return sp;
  return null;
}

// ── 선생님 계정: 이름(로그인 이름) → 학급 공간 ──
// 홍북초(TEACHER_NAME)는 처음부터 있던 반(앞이름 없는 공간)이라 계정 문서가 없다. 새 학급은 누구나 가입해 만든다.
export const ROOT_NAME = process.env.TEACHER_NAME || "홍북초";
// lastLogin: 선생님이 마지막으로 들어온 때(빈 학급 정리 기준). seen: 이 칸이 생기기 전 학급을 정리가 처음 본 때.
export interface Account { id: string; name: string; space: string; createdAt: string; lastLogin?: string; seen?: string }
// 한글 채움 문자·폭 없는 글자는 지운다(「홍북초ㅤ」처럼 보이지 않는 글자로 홍북초인 척하는 이름을 막음)
const tidy = (name: string) => name.normalize("NFC").replace(/[\u115F\u1160\u3164\uFFA0\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim();
export const nameKey = (name: string) => tidy(name).toLowerCase();
export const validName = (name: string) => /^[\p{L}\p{N} ·_-]{2,20}$/u.test(tidy(name));

export async function findAccount(name: string): Promise<Account | null> {
  const id = nameKey(name);
  if (!id) return null;
  if (id === nameKey(ROOT_NAME)) return { id, name: ROOT_NAME, space: "", createdAt: "" };
  return outOfSpace(() => db().get<Account>("accounts", id));
}

// opts.ip가 있으면 IP마다·하루 전체 만들 수 있는 수를 센다(signupSlot). 한도에 걸린 오류는 status 429.
const DUP_NAME = "이미 있는 이름이에요. 학교·학년·반을 붙여 다르게 써 주세요(예: 홍북초 3-2 김민지).";
export async function createAccount(name: string, className: string, password: string, opts: { ip?: string } = {}): Promise<{ space: string; v: number } | { error: string; status?: number }> {
  const clean = tidy(name);
  if (!validName(clean)) return { error: "이름은 2~20자 글자·숫자로 써 주세요." };
  if (!validPin(password)) return { error: "비밀번호는 숫자 4~12자리로 해 주세요." };
  if (await findAccount(clean)) return { error: DUP_NAME };
  // 학급마다 모음이 8개 생겨 MongoDB 무료(모음 500개) 한도를 넘지 않게 학급 수를 막는다(MAX_CLASSES로 바꿈).
  // 한도 가까이 오면 먼저 빈 학급을 정리해 자리를 낸다(10분에 한 번까지).
  const max = Number(process.env.MAX_CLASSES) || 40;
  const classes = async () => (await outOfSpace(() => db().all("accounts"))).length;
  let n = await classes();
  if (n >= max - 3 && (await claimOnce("cleanup:signup", String(Math.floor(Date.now() / 600_000))))) {
    const gone = await cleanupEmptyClasses().catch((e) => (console.error("빈 학급 정리 실패", e), [])); // 정리가 안 돼도 가입은 이어서
    if (gone.length) n = await classes();
  }
  if (n >= max) return { error: "더 만들 수 있는 학급 수를 넘었어요. 관리하시는 선생님께 알려 주세요." };
  if (opts.ip !== undefined) {
    const limited = await signupSlot(opts.ip);
    if (limited) return { error: limited, status: 429 };
  }
  const space = `c${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const pin = makePin(password, 1);
  // 비밀번호를 먼저 저장하고 계정을 연다(계정만 있고 비밀번호가 없는 학급이 생기지 않게)
  await inSpace(space, async () => {
    await savePin(pin);
    await db().set("meta", "account", { name: clean });
    await saveSettings({ ...defaultSettings(), className: className.trim().slice(0, 20) || defaultSettings().className });
  });
  // 계정은 「없을 때만」 만든다: 같은 이름 두 가입이 같은 순간에 오면 나중 것은 방금 만든 공간을 지우고 돌려보낸다
  const now = new Date().toISOString();
  const acc: Account = { id: nameKey(clean), name: clean, space, createdAt: now, lastLogin: now };
  const saved = await outOfSpace(() => db().update<Account>("accounts", acc.id, (cur) => (cur ? undefined : acc)));
  if (saved?.space !== space) {
    await inSpace(space, () => db().drop("meta"));
    return { error: DUP_NAME };
  }
  return { space, v: pin.v };
}

// ── 빈 학급 정리: 가입만 하고 쓰지 않는 학급이 학급 수 한도(MAX_CLASSES)를 차지하지 않게 ──
// 지우는 학급: 새로 가입한 학급(공간 c…)이면서 명단에 학생이 없고, 기록·응원·메모·쪽지·돌아보기·활동지·진단·조치 기록·차시가 하나도 없고,
// 만든 지 CLEANUP_DAYS(14)일이 지났고, 선생님이 그동안 들어오지 않은 학급. 홍북초("")·체험(demo)은 계정 문서가 없어 대상이 아니다.
export const CLEANUP_DAYS = 14;
const CLASS_SPACE = /^c[0-9a-f]{8}$/;
export interface ClassUse extends Account { students: number; data: boolean }
export function emptyClassesToRemove<T extends ClassUse>(xs: T[], now: Date, days = CLEANUP_DAYS): T[] {
  const cut = now.getTime() - days * 86_400_000;
  const old = (iso?: string) => !!iso && Date.parse(iso) <= cut; // 날짜가 없거나 이상하면 지우지 않음
  return xs.filter((x) => CLASS_SPACE.test(x.space) && x.students === 0 && !x.data && old(x.createdAt) && old(x.lastLogin ?? x.seen));
}

// 학급 공간 안을 들여다본다(학생이 있으면 더 읽지 않음)
async function classUse(a: Account): Promise<ClassUse> {
  return inSpace(a.space, async () => {
    const students = (await getRoster()).length;
    if (students) return { ...a, students, data: true };
    const counts = await Promise.all([...DATED.map(([col, f]) => db().count(col, f, ">=", "")), db().count("meta", "kind", "==", "selfAnswer")]);
    const lists = await Promise.all(["selChecks", "riskActions", "selfRounds", "lessons"].map((id) => db().get<{ items?: unknown[] }>("meta", id)));
    return { ...a, students, data: counts.some((c) => c > 0) || lists.some((d) => !!d?.items?.length) };
  });
}

// 정리하고 지운 학급 이름을 돌려준다. 무엇을 지웠는지는 서버 기록과 sys/cleanupLog(최근 100건)에 남긴다.
export async function cleanupEmptyClasses(now = new Date()): Promise<string[]> {
  const accounts = await outOfSpace(() => db().all<Account>("accounts"));
  // 이 칸이 생기기 전 학급(마지막 로그인을 모름)은 오늘 처음 본 것으로 적어 두고 14일 더 기다린다
  for (const a of accounts.filter((x) => CLASS_SPACE.test(x.space) && !x.lastLogin && !x.seen)) {
    await outOfSpace(() => db().update<Account>("accounts", a.id, (cur) => (cur && !cur.lastLogin && !cur.seen ? { ...cur, seen: now.toISOString() } : undefined)));
  }
  // 날짜로 먼저 거르고(읽기를 줄임) 남은 학급만 안을 본다
  const maybe = emptyClassesToRemove(accounts.map((a) => ({ ...a, students: 0, data: false })), now);
  const gone: string[] = [];
  for (const u of emptyClassesToRemove(await Promise.all(maybe.map(classUse)), now)) {
    // 지우기 직전에 다시 확인: 그사이 선생님이 들어왔으면 그대로 둔다
    const fresh = await outOfSpace(() => db().get<Account>("accounts", u.id));
    if (!fresh || fresh.space !== u.space || fresh.lastLogin !== u.lastLogin) continue;
    await inSpace(u.space, async () => {
      for (const col of SPACE_COLS) await db().drop(col);
    });
    await outOfSpace(async () => {
      await db().delWhere("codes", "space", "==", u.space);
      await db().del("accounts", u.id);
      const entry = { at: now.toISOString(), name: u.name, space: u.space, createdAt: u.createdAt, lastLogin: u.lastLogin ?? u.seen ?? "" };
      await db().update<{ items: (typeof entry)[] }>("sys", "cleanupLog", (cur) => ({ items: [...(cur?.items ?? []), entry].slice(-100) }));
    });
    console.info("[빈 학급 정리] 지움:", JSON.stringify({ name: u.name, space: u.space, createdAt: u.createdAt, lastLogin: u.lastLogin ?? u.seen }));
    gone.push(u.name);
  }
  return gone;
}

// 선생님이 맞는 비밀번호로 들어왔을 때: 마지막 로그인을 적고(새 학급만 — 계정 문서가 있는 학급), 하루 한 번 빈 학급을 정리한다.
// 맞힌 학생 로그인도 IP마다 셈 문서를 남기므로 기한 지난 셈도 여기서 지운다(한 시간에 한 번).
export async function noteTeacherLogin(acc: Account, now = new Date()) {
  if (acc.space) await outOfSpace(() => db().update<Account>("accounts", acc.id, (cur) => (cur ? { ...cur, lastLogin: now.toISOString() } : undefined)));
  await tidyLimits(now.getTime());
  if (await claimOnce("cleanup", today(now))) await cleanupEmptyClasses(now);
}

// 화면 위에 보일 계정 이름
export async function accountName() {
  if (isDemo()) return "심사용 체험";
  return (await db().get<{ name: string }>("meta", "account"))?.name ?? ROOT_NAME;
}

// 「1 햇살」, 「1,햇살」, 「1	햇살」 한 줄에 한 명. 같은 번호는 원래 코드를 그대로 둔다.
export function parseRoster(text: string, old: Student[]): Student[] {
  return readRoster(text, old).students;
}
// 명단 읽기. 읽지 못한 줄(모양이 다름·번호가 겹침·가명이 12자를 넘음)은 skipped로 돌려 선생님께 알린다.
// 연습용 가짜 학생 줄을 그대로 두면 연습 표시·동의 날짜도 그대로, 가명을 바꿔 실제 학생으로 바꾸면 연습 표시와 동의 날짜를 뗀다.
export const ROSTER_MAX = 60; // 한 반 학생 수 한도(학생마다 코드 문서가 생기므로)
export function readRoster(text: string, old: Student[]): { students: Student[]; skipped: string[] } {
  const taken = new Set(old.map((s) => s.code));
  const seen = new Set<number>();
  const out: Student[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (out.length >= ROSTER_MAX) {
      skipped.push(`${line.slice(0, 30)} (한 반은 ${ROSTER_MAX}명까지)`);
      continue;
    }
    const m = line.match(/^(\d{1,3})\s*[,.\t ]\s*(.{1,12})$/);
    if (!m || seen.has(Number(m[1]))) {
      skipped.push(line.slice(0, 40));
      continue;
    }
    const no = Number(m[1]);
    seen.add(no);
    const alias = m[2].trim();
    const prev = old.find((s) => s.no === no);
    const keepPractice = !!prev?.demo && prev.alias === alias;
    const consent = prev?.consent && (!prev.demo || keepPractice) ? prev.consent : undefined;
    out.push({ no, alias, code: prev?.code ?? newCode(taken), ...(consent ? { consent } : {}), ...(keepPractice ? { demo: true } : {}) });
    taken.add(out.at(-1)!.code);
  }
  return { students: out, skipped };
}

// 체험 공간은 실제 반에 넣은 AI 키를 빌려 쓰되 하루 DEMO_AI_PER_DAY번까지만(키는 화면에 나가지 않는다)
export const DEMO_AI_PER_DAY = 200;
// 체험 공간은 (체험 전용 키가 없으면) 홍북초 반의 키를 빌려 쓴다. 다른 학급은 각자 넣은 키만.
const keySettings = () => (isDemo() ? outOfSpace(() => getSettings()) : getSettings());

export async function demoAiUsed() {
  const u = await db().get<{ date: string; n: number }>("meta", "aiUsage");
  return u?.date === today() ? u.n : 0;
}
// 하루 몫 쓰기: 한도 밑일 때만 한 번에 1 올린다(동시에 여러 요청이 와도 한도를 넘지 않음). 날짜가 바뀌면 0부터.
async function spendDemoAi() {
  if (!isDemo()) return true;
  return (await db().bump("meta", "aiUsage", today(), { max: DEMO_AI_PER_DAY })).ok;
}

// 공용 업스테이지 키(Vercel 환경 변수 UPSTAGE_API_KEY · 모델은 UPSTAGE_MODEL, 없으면 기본 Solar).
// 체험은 이 키가 있으면 업스테이지로만 돈다. 실제 학급은 「설정」에 그 AI의 키가 없을 때만
// 학급마다 하루 SHARED_AI_PER_DAY번(기본 100, Vercel 환경 변수로 바꿈)까지 빌려 쓴다. 선생님이 넣은 키는 제한 없이 먼저.
const sharedUpstage = () => process.env.UPSTAGE_API_KEY?.trim() || null;
export function sharedAiCap(v: string | undefined) {
  const n = Number(v);
  return v?.trim() && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 100;
}
export const SHARED_AI_PER_DAY = sharedAiCap(process.env.SHARED_AI_PER_DAY);
export const hasSharedAi = () => !!sharedUpstage();
export async function sharedAiUsed() {
  const u = await db().get<{ date: string; n: number }>("meta", "sharedAiUsage");
  return u?.date === today() ? u.n : 0;
}
async function spendSharedAi() {
  return (await db().bump("meta", "sharedAiUsage", today(), { max: SHARED_AI_PER_DAY })).ok;
}
// 실제 학급이 빌려 쓰는 공용 키(체험 공간은 trialKey로 따로)
async function borrowShared(p: Provider) {
  const up = sharedUpstage();
  return !isDemo() && up && p === "upstage" && (await spendSharedAi()) ? up : null;
}

// 체험이 쓰는 AI: 공용 업스테이지 키 → 체험 전용 키(TRIAL_AI_KEY · TRIAL_AI_PROVIDER · TRIAL_AI_MODEL) 순서.
// 둘 중 하나라도 있으면 체험 공간은 실제 반의 키를 빌리지 않는다(하루 제한은 그대로).
function trialKey(): { provider: Provider; key: string; model: string } | null {
  const up = sharedUpstage();
  if (up) return { provider: "upstage", key: up, model: process.env.UPSTAGE_MODEL?.trim() || PROVIDERS.upstage.model };
  const key = process.env.TRIAL_AI_KEY?.trim();
  if (!key) return null;
  const want = process.env.TRIAL_AI_PROVIDER?.trim() as Provider;
  const provider = PROVIDER_IDS.includes(want) ? want : "upstage";
  return { provider, key, model: process.env.TRIAL_AI_MODEL?.trim() || PROVIDERS[provider].model };
}

// 체험 화면에 보여 줄 AI 출처: 공용 업스테이지 키 / 체험 전용 키 / 실제 반 키 빌려 씀 / 없음
export async function trialAiSource(): Promise<"upstage" | "trial" | "class" | "none"> {
  if (sharedUpstage()) return "upstage";
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
  if (key) return (await spendDemoAi()) ? key : null;
  return borrowShared(p); // 실제 학급: 그 키가 없으면 공용 업스테이지 키(하루 제한)
}

export async function aiConfig(provider?: Provider) {
  const tk = isDemo() ? trialKey() : null;
  if (tk) return (!provider || provider === tk.provider) && (await spendDemoAi()) ? { provider: tk.provider, model: tk.model, key: tk.key } : null;
  const s = await keySettings();
  const p = provider ?? s.provider;
  const box = s.keys[p];
  const key = box ? decrypt(box) : null;
  if (key) return (await spendDemoAi()) ? { provider: p, model: s.models[p], key } : null;
  // 실제 학급: 고른 AI의 키가 없으면 공용 업스테이지 키로(따로 다른 AI를 콕 집어 부를 때는 빌리지 않음)
  const shared = provider && provider !== "upstage" ? null : await borrowShared("upstage");
  return shared ? { provider: "upstage" as Provider, model: s.models.upstage, key: shared } : null;
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
  return { records: 0, other: 0, ...(await db().get<Stamp>("meta", "stamp")) };
}
// 한 칸만 바꾼다(읽고 통째로 쓰면 같은 순간의 다른 표시 — 예: 정리의 wipe — 를 덮어 잃음)
export async function touch(kind: keyof Stamp) {
  await db().setField("meta", "stamp", kind, Date.now());
}

// 학생마다 꾸민 마음 친구(번호 → 모습). 문서 하나에 모아 두어 교사 화면도 한 번에 읽는다.
export async function getLooks(): Promise<Record<number, BuddyLook>> {
  const items = (await db().get<{ items: Record<number, BuddyLook> }>("meta", "looks"))?.items ?? {};
  return Object.fromEntries(Object.entries(items).map(([no, l]) => [no, cleanLook(l)])); // 예전 모습엔 새 항목이 없을 수 있음
}
export async function saveLooks(items: Record<number, BuddyLook>) {
  await db().set("meta", "looks", { items });
}
// 학생 한 명의 모습만 바꾼다(여럿이 같은 순간 저장해도 서로 묻히지 않게)
export async function saveLook(no: number, look: BuddyLook) {
  await db().setField("meta", "looks", `items.${Math.trunc(no)}`, look);
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

// 학급 사회·정서역량 진단 회차(학생 이름·번호 없음). 한 학급에 많아야 한 해 몇 번이라 문서 하나에 모은다(모음을 늘리지 않음).
export async function getSelChecks(): Promise<SelCheck[]> {
  const items = (await db().get<{ items: SelCheck[] }>("meta", "selChecks"))?.items ?? [];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
export async function saveSelChecks(items: SelCheck[]) {
  await db().set("meta", "selChecks", { items: items.slice(-80) });
}

// 위험 표현 조치 기록(선생님만). 학급마다 한 해 수십 건이라 문서 하나에 모은다(모음을 늘리지 않음).
// 아이 보호 기록이라 개수로 잘라 버리지 않는다 — 보관 기한 정리(purgeBefore)로만 지운다.
export async function getRiskActions(): Promise<RiskAction[]> {
  const items = (await db().get<{ items: RiskAction[] }>("meta", "riskActions"))?.items ?? [];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
export async function saveRiskActions(items: RiskAction[]) {
  await db().set("meta", "riskActions", { items });
  await touch("other");
}
// 읽고 고쳐 쓰기를 한 번에(두 기기에서 같은 순간 적어도 둘 다 남음). fn은 겹치면 다시 불릴 수 있다.
export async function editRiskActions(fn: (items: RiskAction[]) => RiskAction[]) {
  await db().update<{ items: RiskAction[] }>("meta", "riskActions", (cur) => ({ ...cur, items: fn(cur?.items ?? []) }));
  await touch("other");
}
export const addRiskAction = (act: RiskAction) => editRiskActions((items) => [...items.filter((x) => x.id !== act.id), act]);
export const deleteRiskAction = (id: string) => editRiskActions((items) => items.filter((x) => x.id !== id));

// 마치지 않은 위험 표현(학생이 정리하기에서 위험한 말을 쓰고 기록을 마치지 않은 것). 문서 하나에 모아 둔다.
// 선생님이 살펴본 것은 40일 지나면 빼고(조치 기록에 글이 남음), 살펴보지 않은 것은 보관 기한 정리 때까지 둔다.
const DRAFT_DAYS = 40;
export async function getRiskDrafts(): Promise<RiskDraft[]> {
  return (await db().get<{ items: RiskDraft[] }>("meta", "riskDrafts"))?.items ?? [];
}
async function editRiskDrafts(fn: (items: RiskDraft[]) => RiskDraft[]) {
  const from = addDays(today(), -DRAFT_DAYS);
  let changed = false;
  await db().update<{ items: RiskDraft[] }>("meta", "riskDrafts", (cur) => {
    const before = cur?.items ?? [];
    const items = fn(before).filter((d) => !d.checked || d.date >= from);
    changed = JSON.stringify(items) !== JSON.stringify(before);
    return changed ? { ...cur, items } : undefined;
  });
  if (changed) await touch("other");
}
// 같은 칸은 마지막 글을 앞에 두고, 앞서 쓴 다른 위험한 글은 earlier에 남긴다(새 글이 와도 지우지 않음). 살펴본 표시는 새 글이 오면 비운다.
export const putRiskDraft = (d: RiskDraft) =>
  editRiskDrafts((items) => {
    const old = items.find((x) => x.id === d.id);
    const earlier = old && old.text !== d.text ? [...(old.earlier ?? []), { text: old.text, hits: old.hits, at: old.at }].slice(-5) : old?.earlier;
    return [...items.filter((x) => x.id !== d.id), { ...d, ...(earlier?.length ? { earlier } : {}) }];
  });
// 그 칸 기록을 저장했으면 지운다(기록에 같은 글과 위험 표시가 담김)
export const dropRiskDraft = (id: string) => editRiskDrafts((items) => items.filter((x) => x.id !== id));
export const checkRiskDraft = (id: string) => editRiskDrafts((items) => items.map((x) => (x.id === id ? { ...x, checked: new Date().toISOString() } : x)));

// 학생 자기진단: 회차 목록은 문서 하나, 학생 답은 학생마다 문서 하나(meta 모음 안, kind로 찾음)
// 회차는 한 해 몇 번이라 개수로 잘라 버리지 않는다(문서 크기 걱정 없음). 너무 많으면 여는 쪽(selfOpen)이 분명한 오류를 낸다.
export const SELF_ROUNDS_MAX = 100;
export async function getSelfRounds(): Promise<SelfRound[]> {
  return ((await db().get<{ items: SelfRound[] }>("meta", "selfRounds"))?.items ?? []).sort((a, b) => a.openedAt.localeCompare(b.openedAt));
}
export async function saveSelfRounds(items: SelfRound[]) {
  await db().set("meta", "selfRounds", { items });
  await touch("other");
}
// 회차 목록을 읽고 고쳐 쓰기를 한 번에. fn이 undefined를 돌려주면 그대로 둔다(예: 이미 열린 회차가 있음). 고친 뒤 목록을 돌려준다.
export async function editSelfRounds(fn: (items: SelfRound[]) => SelfRound[] | undefined): Promise<SelfRound[]> {
  let changed = false;
  const doc = await db().update<{ items: SelfRound[] }>("meta", "selfRounds", (cur) => {
    const next = fn([...(cur?.items ?? [])].sort((a, b) => a.openedAt.localeCompare(b.openedAt)));
    changed = !!next;
    return next && { ...cur, items: next };
  });
  if (changed) await touch("other");
  return doc?.items ?? [];
}

// 보호자 동의서 받음 표시: 명단 문서에서 그 번호들의 consent만 바꾼다(명단 문서를 읽고 고쳐 쓰기를 한 번에)
export async function setConsent(nos: number[], on: boolean, date = today()): Promise<Student[]> {
  const pick = new Set(nos);
  const doc = await db().update<{ students: Student[]; demo?: boolean }>("meta", "roster", (cur) => cur ? {
    ...cur,
    students: (cur.students ?? []).map((s) => {
      if (!pick.has(s.no)) return s;
      const { consent: _old, ...rest } = s;
      void _old;
      return on ? { ...rest, consent: date } : rest;
    }),
  } : undefined);
  await touch("other");
  return doc?.students ?? [];
}
export const getSelfAnswers = () => db().find<SelfAnswer>("meta", "kind", "==", "selfAnswer");
export async function deleteSelfAnswers(keep: (a: SelfAnswer) => boolean) {
  for (const a of await getSelfAnswers()) if (!keep(a)) await db().del("meta", selfDocId(a.round, a.no));
}
// 연습 회차 넣기: 이미 열린 실제 회차가 있으면 연습 「학기 말」은 닫힌 채로 넣는다(열린 회차는 하나만)
async function seedSelfChecks(date: string) {
  await deleteSelfAnswers((a) => !a.demo);
  const real = (await getSelfRounds()).filter((r) => !r.demo);
  const demo = demoSelfChecks(date);
  const openReal = real.some((r) => !r.closedAt);
  await saveSelfRounds([...real, ...demo.rounds.map((r) => (openReal && !r.closedAt ? { ...r, closedAt: date } : r))]);
  await db().setMany("meta", demo.answers.map((a) => [selfDocId(a.round, a.no), { ...a }]));
}

// 보관 기한이 지난 것 세기 · 지우기(선생님이 눌러야만). 학급 역량 진단은 학생 이름·번호가 없어 그대로 둔다.
const DATED = [["records", "date"], ["cheers", "createdAt"], ["notes", "createdAt"], ["letters", "createdAt"], ["reflects", "createdAt"], ["sheets", "createdAt"]] as const;
export const cutoffNow = async () => cutoffOf((await getSettings()).retention, today());
// 기한(cut)은 한국 날짜. 날짜 칸(date)은 그대로 견주고, 만든 시각(UTC ISO)은 그날 한국 자정의 시각과 견준다
// (그대로 견주면 한국 시각 0~9시에 쓴 글이 하루 일찍 지워진다)
const cutIso = (cut: string) => new Date(`${cut}T00:00:00+09:00`).toISOString();
const cutFor = (field: string, cut: string) => (field === "date" ? cut : cutIso(cut));
// 조치 기록은 그 위험 표현 기록의 날짜로 정리한다(기록이 지워지면 조치 기록도 함께)
const actDate = (a: RiskAction) => a.recordDate || a.date;
export async function expiredCounts(cut: string) {
  const counts: Record<string, number> = {};
  for (const [col, field] of DATED) counts[col] = await db().count(col, field, "<", cutFor(field, cut));
  counts.self = (await getSelfAnswers()).filter((a) => a.at < cutIso(cut)).length;
  counts.risk = (await getRiskActions()).filter((a) => actDate(a) < cut).length;
  counts.drafts = (await getRiskDrafts()).filter((d) => d.date < cut).length;
  return counts;
}
export async function purgeLogs(): Promise<PurgeLog[]> {
  return (await db().get<{ items: PurgeLog[] }>("meta", "purges"))?.items ?? [];
}
export async function purgeBefore(cut: string): Promise<PurgeLog> {
  const counts: Record<string, number> = {};
  for (const [col, field] of DATED) counts[col] = await db().delWhere(col, field, "<", cutFor(field, cut));
  const iso = cutIso(cut);
  const selfs = await getSelfAnswers();
  counts.self = selfs.filter((a) => a.at < iso).length;
  await deleteSelfAnswers((a) => a.at >= iso);
  const rounds = await getSelfRounds();
  const left = new Set(selfs.filter((a) => a.at >= iso).map((a) => a.round));
  const gone = (r: SelfRound) => !!r.closedAt && r.openedAt < cut && !left.has(r.id);
  if (rounds.some(gone)) await editSelfRounds((rs) => rs.filter((r) => !gone(r)));
  const acts = await getRiskActions();
  counts.risk = acts.filter((a) => actDate(a) < cut).length;
  if (counts.risk) await editRiskActions((xs) => xs.filter((a) => actDate(a) >= cut));
  counts.drafts = (await getRiskDrafts()).filter((d) => d.date < cut).length;
  if (counts.drafts) await editRiskDrafts((xs) => xs.filter((d) => d.date >= cut));
  // 무엇을 언제 정리했는지는 남긴다(내용 없이 수만)
  const log: PurgeLog = { at: new Date().toISOString(), cutoff: cut, counts };
  await db().set("meta", "purges", { items: [...(await purgeLogs()), log].slice(-20) });
  await touch("wipe");
  await touch("records");
  await touch("other"); // 다른 기기의 선생님 화면도 통째로 다시 읽어 지운 기록이 남지 않게
  return log;
}

// 연습 데이터의 판: 연습 데이터에 새 내용(예: 역량 진단 회차)을 더하면 올린다 → 체험 반이 그날 안에도 새 판으로 다시 만들어진다
export const PRACTICE_VERSION = 4;

// 연습 데이터 새로 만들기: 기록·응원·메모·쪽지·돌아보기를 비우고 가명 25명과 최근 7일 기록을 한꺼번에 넣는다
// 명단을 연습용으로 바꾸므로 학생 번호에 매인 것(기록·응원·메모·쪽지·돌아보기·활동지 피드백·조치 기록·자기진단 답)은 모두 비운다.
// (남겨 두면 실제 학생의 조치 기록·자기진단 답이 같은 번호의 가짜 학생에게 붙는다) 반 전체 역량 진단 회차는 그대로 둔다.
export async function seedPractice() {
  for (const col of ["records", "cheers", "notes", "letters", "reflects", "sheets"] as const) await db().clear(col);
  await deleteSelfAnswers(() => false);
  await saveSelfRounds([]);
  await saveRiskActions([]);
  await db().del("meta", "riskDrafts"); // 학생 번호에 매인 마치지 않은 위험 표현도(새 명단의 같은 번호 학생에게 붙지 않게)
  const date = today();
  const taken = new Set<string>();
  // 보호자 동의서: 3명(4·12·19번)만 아직 받지 않은 반
  await saveRoster(demoStudents(() => {
    const c = newCode(taken);
    taken.add(c);
    return c;
  }).map((s) => ({ ...s, demo: true, ...([4, 12, 19].includes(s.no) ? {} : { consent: addDays(date, -60) }) })), true);
  await saveLooks(demoLooks());
  const now = Date.now();
  await db().setMany("records", demoRecords(date).map((r) => [r.id, { ...r, updatedAt: now }]));
  const extra = demoExtras(date);
  await db().setMany("letters", extra.letters.map((l) => [l.id, { ...l }]));
  await db().setMany("reflects", extra.reflects.map((r) => [r.id, { ...r }]));
  await db().set("sheets", PRACTICE_SHEET, { ...demoSheetRun(date) }); // 활동지 피드백 예시(실제 반은 같은 id로 덮어씀)
  await saveSelChecks([...(await getSelChecks()).filter((c) => !c.demo), ...demoSelChecks(date)]); // 역량 진단 연습 회차(실제 회차는 그대로)
  await saveRiskActions(demoRiskActions(date)); // 위험 표현 조치 연습 기록
  await seedSelfChecks(date); // 학생 자기진단 연습 회차(실제 회차는 그대로)
  // 체험 반은 여럿이 함께 쓰므로 설정(위험 표현·반 감정 단어·반 이름·규칙)도 처음으로(누군가 바꾼 것이 다음 사람에게 남지 않게)
  const cur = await getSettings();
  await saveSettings(isDemo() ? { ...defaultSettings(), keys: cur.keys, provider: cur.provider, models: cur.models } : { ...cur, checks: {} });
  await db().set("meta", "practiceDay", { date, v: PRACTICE_VERSION });
  await touch("wipe");
  await touch("records");
}

// 「연습 데이터만 지우기」: 연습 표시가 붙은 것과 연습용 가짜 학생에게 매인 것만 지우고, 실제 학생·기록은 그대로 둔다.
export async function clearPractice() {
  const doc = await db().get<{ students: Student[]; demo?: boolean }>("meta", "roster");
  const roster = doc?.students ?? [];
  // 학생마다 연습 표시가 붙기 전에 만든 연습 명단(명단에 표시만 있고 학생에게는 없음): 연습 기록이 있는 번호만 가짜 학생으로 본다.
  // (명단 표시가 잘못 켜진 실제 명단이면 연습 기록이 없으므로 아무도 지우지 않는다 — 실제 반을 통째로 지우지 않게)
  const legacy = doc?.demo === true && !roster.some((s) => s.demo);
  const practiceNos = legacy ? new Set((await db().find<MoodRecord>("records", "demo", "==", true)).map((r) => r.no)) : new Set<number>();
  const fake = new Set(roster.filter((s) => s.demo || (legacy && practiceNos.has(s.no))).map((s) => s.no));
  await purgePractice((no) => fake.has(no)); // 명단에서 빠진 실제 학생의 지난 기록은 건드리지 않는다
  await db().del("sheets", PRACTICE_SHEET);
  await saveSelChecks((await getSelChecks()).filter((c) => !c.demo));
  // 연습 회차와, 그 회차에 실제 학생이 낸 답도 함께(회차가 없어진 답이 남지 않게)
  const gone = new Set((await getSelfRounds()).filter((r) => r.demo).map((r) => r.id));
  await editSelfRounds((rs) => rs.filter((r) => !r.demo));
  if (gone.size) await deleteSelfAnswers((a) => !gone.has(a.round));
  if (fake.size) await saveRoster(roster.filter((s) => !fake.has(s.no)), false);
  else if (doc?.demo) await saveRoster(roster, false);
  // 「살펴봤어요」 표시는 연습 학생 것만 지운다(실제 학생 표시는 그대로)
  const st = await getSettings();
  const checks = Object.fromEntries(Object.entries(st.checks).filter(([k]) => !fake.has(Number(k.split("_")[0]))));
  if (Object.keys(checks).length !== Object.keys(st.checks).length) await saveSettings({ ...st, checks });
  await touch("wipe");
  await touch("records");
}

// 연습 표시가 붙은 것, 그리고 gone(번호)이 참인 학생(연습용 가짜 학생)에게 매인 것을 지운다.
// onlyThese: 명단을 고쳐 연습 학생 몇 명만 실제 학생으로 바꿀 때 — 그 번호의 것만 지우고 다른 연습 학생 것은 남긴다
// (그 번호의 「살펴봤어요」 표시와 활동지 예시 피드백도 함께 — 실제 학생의 신호를 가리지 않게).
export async function purgePractice(gone: (no: number) => boolean, opt: { onlyThese?: boolean } = {}) {
  const hit = (demo: boolean | undefined, ...nos: number[]) => (!opt.onlyThese && !!demo) || nos.some(gone);
  const recs = await db().all<MoodRecord>("records");
  const dropped = new Set<string>();
  for (const r of recs) if (hit(r.demo, r.no)) { await db().del("records", r.id); dropped.add(r.id); }
  for (const col of ["cheers", "notes", "reflects"] as const)
    for (const x of await db().all<{ id: string; no: number; demo?: boolean }>(col)) if (hit(x.demo, x.no)) await db().del(col, x.id);
  for (const l of await db().all<{ id: string; from: number; to: number; demo?: boolean }>("letters"))
    if (hit(l.demo, l.from, l.to)) await db().del("letters", l.id);
  await editRiskActions((xs) => xs.filter((a) => !hit(a.demo, a.no) && !dropped.has(a.recordId)));
  await deleteSelfAnswers((a) => !hit(a.demo, a.no));
  const drafts = await getRiskDrafts();
  if (drafts.some((d) => hit(d.demo, d.no))) await editRiskDrafts((xs) => xs.filter((d) => !hit(d.demo, d.no)));
  const looks = await getLooks();
  const nos = Object.keys(looks).map(Number);
  if (nos.some(gone)) await saveLooks(Object.fromEntries(Object.entries(looks).filter(([no]) => !gone(Number(no)))));
  if (opt.onlyThese) {
    const st = await getSettings();
    const checks = Object.fromEntries(Object.entries(st.checks).filter(([k]) => !gone(Number(k.split("_")[0]))));
    if (Object.keys(checks).length !== Object.keys(st.checks).length) await saveSettings({ ...st, checks });
    const sheet = await db().get<SheetRun>("sheets", PRACTICE_SHEET);
    if (sheet?.items.some((x) => gone(x.no))) await db().set("sheets", PRACTICE_SHEET, { ...sheet, items: sheet.items.filter((x) => !gone(x.no)) });
  }
}
