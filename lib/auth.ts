// 서명한 쿠키로 학생·교사를 구분하고, 교사가 넣은 API 키는 암호화해서 저장한다
import crypto from "node:crypto";

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

export function teacherToken() {
  return sign(`t:${Date.now() + TEACHER_HOURS * 3600_000}`);
}
export function isTeacher(cookie: string | undefined) {
  const v = unsign(cookie);
  return !!v && v.startsWith("t:") && Number(v.slice(2)) > Date.now();
}

// 비밀번호 4자리는 금방 맞혀지므로, 5번 틀리면 1분 잠근다
// ponytail: 메모리 잠금이라 서버가 여러 대면 대마다 따로 센다. 실제 운영 전에 더 긴 비밀번호로 바꿀 것.
let fails = 0;
let lockedUntil = 0;
export function checkPassword(input: string): { ok: boolean; wait?: number } {
  if (Date.now() < lockedUntil) return { ok: false, wait: Math.ceil((lockedUntil - Date.now()) / 1000) };
  const want = Buffer.from(process.env.TEACHER_PASSWORD || "1324");
  const got = Buffer.from(String(input));
  const ok = want.length === got.length && crypto.timingSafeEqual(want, got);
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
