// Service worker for ImpowerUp.
// Handles real background Web Push (sent by the Supabase Edge Function)
// so a notification can appear even when the app is fully closed.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No offline caching implemented -- pass-through.
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
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./ImpowerUp.html");
    })
  );
});
