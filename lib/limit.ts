// 너무 잦은 시도 막기: 학생 코드 로그인 · 선생님 비밀번호 · 새 학급 만들기 · 체험 반 처음 판으로.
// 서버(Vercel 인스턴스)가 여러 대여도 함께 세도록 저장소에 센다. 모든 학급이 함께 쓰는 「sys」 모음 하나에만 적는다
// (학급마다 모음을 늘리지 않음 — MongoDB 무료는 모음 500개까지). IP는 그대로 적지 않고 해시(hashId)만 쓴다.
// 셈 문서마다 exp(지워도 되는 때)를 적고, 한 시간에 한 번 기한이 지난 것을 지운다(tidy) → 쌓이지 않는다.
// 시도는 맞춰 보기 「전에」 한 칸 잡아 둔다(atomic) → 한꺼번에 수백 번 보내도 한도를 넘지 못한다. 맞으면 돌려준다.
import { hashId } from "./auth.ts";
import { today } from "./date.ts";
import { db, outOfSpace, spaceId } from "./db.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
interface Count { date: string; n: number }

// ── 요청한 기기의 공인 IP ──
// Vercel은 x-forwarded-for를 스스로 채운다(밖에서 보낸 값은 덮어씀) → 첫 칸이 기기 IP. 없으면 x-real-ip.
export function clientIp(h: Headers) {
  return normIp(h.get("x-forwarded-for")?.split(",")[0] ?? "") || normIp(h.get("x-real-ip") ?? "") || "unknown";
}
// IPv6는 한 집·한 학교가 /64를 통째로 받아 주소를 마음대로 바꿀 수 있으므로 앞 64비트(네 묶음)로 묶는다
export function normIp(raw: string) {
  let s = raw.trim().toLowerCase();
  const port = s.match(/^\[([^\]]+)\](?::\d+)?$/) ?? s.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (port) s = port[1];
  if (/^::ffff:\d{1,3}(\.\d{1,3}){3}$/.test(s)) s = s.slice(7);
  if (!s.includes(":")) return s.slice(0, 45);
  s = s.split("%")[0];
  const [a, b] = s.split("::");
  const head = a ? a.split(":") : [];
  const tail = b === undefined ? [] : b ? b.split(":") : [];
  const full = b === undefined ? head : [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail];
  return `${full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

// now가 들어 있는 ms 길이 칸(10분 칸 등): 칸 이름과 끝나는 때
const slot = (ms: number, now: number) => {
  const i = Math.floor(now / ms);
  return { win: String(i), end: (i + 1) * ms };
};
const secs = (until: number, now: number) => Math.max(1, Math.ceil((until - now) / 1000));
// 기다릴 시간을 사람 말로: 「40초」, 「3분」
export const waitText = (s: number) => (s < 60 ? `${s}초` : `${Math.ceil(s / 60)}분`);

// 한 칸(win: 날짜·10분 칸 등)에 한 번만: 먼저 온 요청 하나만 true(하루 한 번 정리 등)
export const claimOnce = (name: string, win: string) =>
  outOfSpace(async () => (await db().get<Count>("sys", name))?.date !== win && (await db().bump("sys", name, win, { max: 1 })).ok);

// 기한이 지난 셈 문서 지우기: 한 시간에 한 번만(먼저 온 요청 하나가)
export async function tidy(now = Date.now()) {
  if (await claimOnce("tidy", slot(HOUR, now).win)) await outOfSpace(() => db().delWhere("sys", "exp", "<", now));
}

// ── 학생 코드 로그인: 코드는 31글자 중 6자리. 학교는 태블릿 25대쯤이 공인 IP 하나를 함께 쓰므로 넉넉히 ──
// 10분 칸마다 IP 하나가 CODE_PER_IP번까지 틀릴 수 있다. 모든 IP를 합쳐 CODE_ALL번 넘게 틀린 10분 칸(여러 곳에서 한꺼번에 두드림)에는
// IP마다 CODE_TIGHT번까지만 → 한두 번 잘못 친 다른 학교 학생은 그대로 들어온다. 맞힌 로그인은 세지 않는다.
export const CODE_WINDOW = 10 * MIN;
export const CODE_PER_IP = 60; // 큰 학교는 여러 반이 한 IP를 쓰므로 잘못 친 코드가 몰려도 막히지 않게
export const CODE_ALL = 1000;
export const CODE_TIGHT = 10;
export interface Attempt { wait: number; done: (ok: boolean) => Promise<void> }
const noop = async () => {};

export function codeAttempt(ip: string, now = Date.now()): Promise<Attempt> {
  return outOfSpace(async () => {
    const s = slot(CODE_WINDOW, now);
    const all = await db().get<Count>("sys", "code:all");
    const cap = all?.date === s.win && all.n >= CODE_ALL ? CODE_TIGHT : CODE_PER_IP;
    const id = `code:${hashId(ip)}`;
    if (!(await db().bump("sys", id, s.win, { max: cap, extra: { exp: s.end } })).ok) return { wait: secs(s.end, now), done: noop };
    return {
      wait: 0,
      done: (ok: boolean) => outOfSpace(async () => {
        if (ok) await db().bump("sys", id, s.win, { by: -1 }); // 맞힌 로그인: 잡아 둔 몫을 돌려줌
        else {
          await db().bump("sys", "code:all", s.win, { extra: { exp: s.end } });
          await tidy(now);
        }
      }),
    };
  });
}

// ── 선생님 비밀번호(숫자 4~12자리): 학급 × IP마다 센다 → 어떤 IP에서 틀려도 다른 IP의 선생님은 잠기지 않는다 ──
// 5번 틀리면 1분, 또 5번 틀리면 2분 → 4 → 8 → 15분까지. 한 시간 동안 조용하면 처음부터.
// 한 학급에 모든 IP를 합쳐 한 시간에 PW_CLASS_HOURLY번 넘게 틀리면(여러 곳에서 두드림) 그 시간 동안은 IP마다 한 번 틀릴 때마다 잠근다
// — 맞는 비밀번호는 첫 번에 그대로 통하므로 공격하는 쪽이 선생님을 잠가 둘 수는 없다.
export const PW_FAILS = 5;
export const PW_FIRST_LOCK = MIN;
export const PW_MAX_LOCK = 15 * MIN;
export const PW_CLASS_HOURLY = 50;
const PW_QUIET = HOUR;
interface PwState { fails: number; level: number; until: number; exp: number }

export function passwordAttempt(ip: string, sp = spaceId(), now = Date.now()): Promise<Attempt> {
  return outOfSpace(async () => {
    const h = slot(HOUR, now);
    const cls = await db().get<Count>("sys", `pwc:${sp}`);
    const per = cls?.date === h.win && cls.n >= PW_CLASS_HOURLY ? 1 : PW_FAILS;
    const id = `pw:${sp}:${hashId(ip)}`;
    let wait = 0;
    await db().update<PwState>("sys", id, (cur) => {
      const s = cur && cur.exp > now ? cur : { fails: 0, level: 0, until: 0, exp: 0 };
      wait = s.until > now ? secs(s.until, now) : 0;
      if (wait) return undefined;
      // 이번 시도를 먼저 「틀림」으로 센다(맞으면 done(true)가 지움)
      if (s.fails + 1 < per) return { ...s, fails: s.fails + 1, exp: now + PW_QUIET };
      const level = s.level + 1;
      const until = now + Math.min(PW_MAX_LOCK, PW_FIRST_LOCK * 2 ** (level - 1));
      return { fails: 0, level, until, exp: until + PW_QUIET };
    });
    if (wait) return { wait, done: noop };
    return {
      wait: 0,
      done: (ok: boolean) => outOfSpace(async () => {
        if (ok) await db().del("sys", id); // 맞히면 이 IP의 셈을 비움
        else {
          await db().bump("sys", `pwc:${sp}`, h.win, { extra: { exp: h.end } });
          await tidy(now);
        }
      }),
    };
  });
}

// ── 새 학급 만들기(누구나): IP마다 하루 SIGNUP_PER_IP개, 모두 합쳐 하루 SIGNUP_PER_DAY개 ──
// 만들기 직전에 한 칸 잡는다. 오류 글을 돌려주고, 괜찮으면 null.
// 연수처럼 한 학교(인터넷 하나)에서 여러 선생님이 한꺼번에 만들 수 있게 넉넉히. 빈 학급은 14일 뒤 저절로 정리된다.
export const SIGNUP_PER_IP = 200;
export const SIGNUP_PER_DAY = 500;
export function signupSlot(ip: string, now = Date.now()): Promise<string | null> {
  return outOfSpace(async () => {
    const day = today(new Date(now));
    const id = `signup:${hashId(ip)}`;
    if (!(await db().bump("sys", id, day, { max: SIGNUP_PER_IP, extra: { exp: now + 2 * 24 * HOUR } })).ok)
      return `이 인터넷 연결에서는 오늘 학급을 더 만들 수 없어요(하루 ${SIGNUP_PER_IP}개까지). 내일 다시 해 주세요.`;
    if (!(await db().bump("sys", "signup:all", day, { max: SIGNUP_PER_DAY })).ok) {
      await db().bump("sys", id, day, { by: -1 });
      return "오늘 새로 만들 수 있는 학급 수를 다 채웠어요. 내일 다시 해 주세요.";
    }
    await tidy(now);
    return null;
  });
}

// ── 체험 반 「처음 판으로」(로그인 없이 누구나): 모두 합쳐 10분에 한 번, IP마다 1분에 한 번 ──
// 되돌리면 체험 중인 모든 사람의 학생 코드가 바뀌어 나가지므로. 기다릴 초를 돌려준다(0 = 해도 됨).
export const RESET_PER_IP = MIN;
export const RESET_ALL = 10 * MIN;
export function resetWait(ip: string, now = Date.now()): Promise<number> {
  return outOfSpace(async () => {
    const take = async (id: string, gap: number) => {
      let left = 0;
      await db().update<{ at: number; exp: number }>("sys", id, (cur) => {
        left = cur && now - cur.at < gap ? secs(cur.at + gap, now) : 0;
        return left ? undefined : { at: now, exp: now + gap };
      });
      return left;
    };
    return (await take(`reset:${hashId(ip)}`, RESET_PER_IP)) || (await take("reset:all", RESET_ALL));
  });
}

// ── 체험 반에서 여럿이 함께 쓰는 것 바꾸기(연습 데이터 다시 만들기는 resetWait, 명단 저장·코드 새로 받기는 이것) ──
// IP마다 10분에 TRIAL_EDITS번까지. 체험 반 문서를 마구 다시 쓰거나(무료 저장소 부담) 다른 사람을 내보내지 못하게.
export const TRIAL_EDITS = 30; // 심사하며 여러 기능을 눌러 보는 정도는 넉넉히
export function trialEditWait(ip: string, now = Date.now()): Promise<number> {
  return outOfSpace(async () => {
    const span = 10 * MIN;
    const end = (Math.floor(now / span) + 1) * span;
    const r = await db().bump("sys", `tedit:${hashId(ip)}`, String(end), { max: TRIAL_EDITS, extra: { exp: end } });
    return r.ok ? 0 : secs(end, now);
  });
}
