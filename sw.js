// Service worker for ImpowerUp.
// Handles real background Web Push (sent by the Supabase Edge Function) so a notification
// can appear even when the app is fully closed, plus a basic offline app shell so the app
// still opens (using whatever was last cached) when there's no connection.

const CACHE_NAME = "impowerup-shell-v2";
const SHELL_ASSETS = ["./ImpowerUp.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./ImpowerUp.html")))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "ImpowerUp", body: "You have an alert." };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ImpowerUp", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: data.reminderId ? "impowerup-" + data.reminderId : undefined,
      data: { reminderId: data.reminderId || null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const reminderId = event.notification.data && event.notification.data.reminderId;
  const targetUrl = reminderId ? "./ImpowerUp.html#/home?alarm=" + encodeURIComponent(reminderId) : "./ImpowerUp.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
