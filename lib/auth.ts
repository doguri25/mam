// 서명한 쿠키로 학생·교사를 구분하고, 교사가 넣은 API 키는 암호화해서 저장한다
import crypto from "node:crypto";
import { isDemo } from "./db.ts";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET 환경 변수가 필요해요.");
  return "dev-only-secret-change-me";
}

const mac = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function sign(value: string) {
  return `${value}.${mac(value)}`;
}

export function unsign(signed: string | undefined) {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  const value = signed.slice(0, i);
  const a = Buffer.from(signed.slice(i + 1));
  const b = Buffer.from(mac(value));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? value : null;
}

export const STUDENT_COOKIE = "mb_s";
export const TEACHER_COOKIE = "mb_t";
export const TEACHER_HOURS = 8;

export const DEMO_COOKIE = "mb_demo"; // 심사용 체험 중(이 쿠키가 있으면 요청 전체가 체험 공간에서 돈다)

// 표 안의 v는 비밀번호 판(버전). 비밀번호를 바꾸면 v가 올라가 다른 기기의 예전 표는 무효가 된다.
// 끝의 d는 체험 공간 표 — 체험 표로는 실제 반을, 실제 반 표로는 체험 공간을 열 수 없다.
export function teacherToken(v = 0, demo = isDemo()) {
  return sign(`t:${Date.now() + TEACHER_HOURS * 3600_000}:${v}${demo ? ":d" : ""}`);
}
export function isTeacher(cookie: string | undefined, v = 0, demo = isDemo()) {
  const x = unsign(cookie);
  if (!x?.startsWith("t:")) return false;
  const [, exp, ver = "0", d] = x.split(":");
  return Number(exp) > Date.now() && Number(ver) === v && (d === "d") === demo;
}

// 와이파이가 끊겼을 때 기기에 잠시 담아 둔 기록을 나중에 보내는 표: 그 학생·그날 기록만 저장할 수 있다
export const queueToken = (no: number, code: string, date: string) => sign(`q:${no}:${code}:${date}`);
export function readQueueToken(token: unknown) {
  const v = unsign(typeof token === "string" ? token : undefined);
  if (!v?.startsWith("q:")) return null;
  const [, no, code, date] = v.split(":");
  return { no: Number(no), code, date };
}

// 선생님이 바꾼 비밀번호는 그대로 두지 않고 scrypt로 바꿔 저장한다. 없으면 TEACHER_PASSWORD(또는 1324).
export interface Pin { salt: string; hash: string; v: number }
const scrypt = (pin: string, salt: string) => crypto.scryptSync(pin, salt, 32).toString("base64url");
export const validPin = (pin: string) => /^\d{4,12}$/.test(pin);
export function makePin(pin: string, v: number): Pin {
  const salt = crypto.randomBytes(16).toString("base64url");
  return { salt, hash: scrypt(pin, salt), v };
}
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// 숫자 비밀번호는 금방 맞혀지므로, 5번 틀리면 1분 잠근다
// ponytail: 메모리 잠금이라 서버가 여러 대면 대마다 따로 센다. 여러 반이 쓰면 저장소에 세도록 바꿀 것.
let fails = 0;
let lockedUntil = 0;
export function checkPassword(input: string, pin?: Pin | null): { ok: boolean; wait?: number } {
  if (Date.now() < lockedUntil) return { ok: false, wait: Math.ceil((lockedUntil - Date.now()) / 1000) };
  const got = String(input);
  const ok = pin ? same(scrypt(got, pin.salt), pin.hash) : same(process.env.TEACHER_PASSWORD || "1324", got);
  if (ok) fails = 0;
  else if (++fails >= 5) {
    fails = 0;
    lockedUntil = Date.now() + 60_000;
  }
  return { ok };
}

const keyBytes = () => crypto.createHash("sha256").update(secret() + ":api-keys").digest();

export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(box: string): string | null {
  try {
    const [iv, tag, data] = box.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null; // SESSION_SECRET이 바뀌면 풀 수 없음 → 다시 입력
  }
}

export function mask(key: string) {
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 헷갈리는 0·O·1·I·L 뺌
export function newCode(taken: Set<string>) {
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    if (!taken.has(code)) return code;
  }
}
