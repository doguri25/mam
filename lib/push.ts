// 교사 휴대폰 푸시 알림(웹 푸시). 알림 내용은 구글·애플 푸시 서버를 거치므로 번호만 담고 이름·글은 담지 않는다.
import crypto from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { db } from "./db.ts";

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
export const pushReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// 연락처(subject)는 이메일 대신 이 앱 주소를 쓴다
const subject = () =>
  process.env.VAPID_SUBJECT ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://localhost");

interface Sub {
  id: string;
  sub: PushSubscription;
  label: string;
  createdAt: string;
}

export const subId = (endpoint: string) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function saveSub(sub: PushSubscription, label: string) {
  const id = subId(sub.endpoint);
  await db().set("subs", id, { id, sub: { endpoint: sub.endpoint, keys: sub.keys }, label: label.slice(0, 40), createdAt: new Date().toISOString() });
  return id;
}

export const removeSub = (endpoint: string) => db().del("subs", subId(endpoint));
export const countSubs = async () => (await db().all<Sub>("subs")).length;

export async function notifyTeachers(payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushReady()) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(subject(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const subs = await db().all<Sub>("subs");
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db().del("subs", s.id); // 지운 앱·끈 알림은 정리
        else console.error("푸시 실패", code, (e as Error).message);
      }
    }),
  );
  return { sent, failed };
}
