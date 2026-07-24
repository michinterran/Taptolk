const CACHE_NAME = "taptolk-owner-shell-v1";
const SHELL_ASSETS = [
  "/brand/taptolk-logo.png",
  "/ko/owner/offline",
  "/en/owner/offline",
  "/api/owner/manifest?locale=ko",
  "/api/owner/manifest?locale=en",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const ownerNavigation =
    event.request.mode === "navigate" &&
    (/^\/(?:ko|en)\/activate\//u.test(requestUrl.pathname) ||
      /^\/(?:ko|en)\/owner(?:\/|$)/u.test(requestUrl.pathname));
  if (!ownerNavigation) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      const locale = requestUrl.pathname.startsWith("/ko/") ? "ko" : "en";
      return caches.match(`/${locale}/owner/offline`);
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" ? payload.title : "Taptolk";
  const body = typeof payload.body === "string" ? payload.body : "";
  const url = typeof payload.url === "string" ? payload.url : "/ko/owner";
  const tag = typeof payload.tag === "string" ? payload.tag : "taptolk-owner-contact";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/brand/taptolk-logo.png",
      tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/ko/owner";
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === url) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
