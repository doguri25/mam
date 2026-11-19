// 교사 휴대폰 푸시 알림(웹 푸시). 알림 내용은 구글·애플 푸시 서버를 거치므로 번호만 담고 이름·글은 담지 않는다.
import crypto from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { db } from "./db.ts";
import { touch } from "./data.ts";

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

// 브라우저가 주는 알림 서버 주소(크롬·삼성 인터넷=FCM, 엣지=WNS, 파이어폭스=Mozilla, 사파리=Apple)만 받는다
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export const PUSH_MAX = 10; // 학급마다 알림 받는 기기 수
export function pushEndpointOk(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 1000) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
export const pushKeyOk = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200 && /^[A-Za-z0-9_\-=+/]+$/.test(v);

export const subId = (endpoint: string) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function saveSub(sub: PushSubscription, label: string) {
  const id = subId(sub.endpoint);
  await db().set("subs", id, { id, sub: { endpoint: sub.endpoint, keys: sub.keys }, label: label.slice(0, 40), createdAt: new Date().toISOString() });
  return id;
}

export const removeSub = (endpoint: string) => db().del("subs", subId(endpoint));
// 이 기기의 알림 주소가 이 학급 알림 목록에 지금 있나. 브라우저의 구독만 보면, 다른 기기에서 비밀번호를 바꾸거나
// 「모두 끄기」로 서버 목록에서 빠진 뒤에도 「이 기기에서 받는 중」으로 보인다.
export const hasSub = async (endpoint: string) => !!(await db().get("subs", subId(endpoint)));
export const countSubs = async () => (await db().all<Sub>("subs")).length;

// 이 학급의 알림 받는 기기를 모두 뺀다(잃어버린 휴대폰 끊기·비밀번호를 바꿀 때). keepEndpoint로 보낸 기기 하나만 남길 수 있다. 뺀 수를 돌려준다.
export async function clearSubs(keepEndpoint?: string) {
  const keep = keepEndpoint ? subId(keepEndpoint) : null;
  let removed = 0;
  for (const s of await db().all<Sub>("subs")) {
    if (s.id === keep) continue;
    await db().del("subs", s.id);
    removed++;
  }
  return removed;
}

export async function notifyTeachers(payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushReady()) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(subject(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const subs = await db().all<Sub>("subs");
  let sent = 0;
  let failed = 0;
  let gone = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db().del("subs", s.id); // 지운 앱·끈 알림은 정리
          gone++;
        } else console.error("푸시 실패", code, (e as Error).message);
      }
    }),
  );
  // 정리한 기기가 있으면 변경 표시를 남겨 선생님 화면 설정의 기기 수·「받는 중」도 맞춘다
  if (gone) await touch("other");
  return { sent, failed };
}
