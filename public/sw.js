// 서비스 워커: 교사 휴대폰 푸시 알림을 받아 보여 주고, 누르면 선생님 화면을 연다.
// 화면·기록을 따로 저장(캐시)하지 않는다 — 학생 기록이 기기에 남지 않게.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "마음빛 길잡이", {
      body: d.body || "선생님 화면을 확인해 주세요.",
      tag: d.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: d.url || "/teacher" },
      requireInteraction: true,
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/teacher";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes("/teacher") && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
