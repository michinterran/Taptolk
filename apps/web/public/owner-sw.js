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
