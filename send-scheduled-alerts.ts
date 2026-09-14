// Supabase Edge Function: send-scheduled-alerts
//
// Deploy path: supabase/functions/send-scheduled-alerts/index.ts
// Runs on a schedule (set up as a Cron Job in the Supabase dashboard,
// e.g. every 1-2 minutes) and delivers any due push notifications.
//
// Required secrets (Dashboard -> Edge Functions -> send-scheduled-alerts -> Secrets,
// or `supabase secrets set`):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   SB_URL                  (your project's REST URL, e.g. https://xxxx.supabase.co)
//   SB_SERVICE_ROLE_KEY     (Dashboard -> Project Settings -> API -> service_role key -- keep secret, never put this in the app)

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:you@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function restHeaders() {
  return {
    apikey: SB_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SB_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  // Fetch due alerts, embedding the matching subscription via the FK relationship.
  const dueRes = await fetch(
    `${SB_URL}/rest/v1/scheduled_alerts?is_active=eq.true&next_fire_at=lte.${encodeURIComponent(nowIso)}&next_fire_at=not.is.null&select=*,push_subscriptions(*)`,
    { headers: restHeaders() }
  );
  if (!dueRes.ok) {
    return new Response(JSON.stringify({ error: await dueRes.text() }), { status: 500 });
  }
  const dueAlerts = await dueRes.json();

  let sent = 0, cleaned = 0, failed = 0;

  for (const alert of dueAlerts) {
    const sub = alert.push_subscriptions;
    if (!sub) continue;

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    const payload = JSON.stringify({ title: alert.title, body: alert.body || "" });

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sent++;
    } catch (err) {
      failed++;
      // 404/410 means the subscription is gone (user uninstalled, revoked, etc.) -- clean it up.
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
          headers: restHeaders(),
        });
        cleaned++;
      }
    }

    // Clear next_fire_at so we don't re-fire; the app recalculates and
    // re-uploads the next occurrence next time it syncs (within ~2 min
    // of being opened).
    await fetch(`${SB_URL}/rest/v1/scheduled_alerts?id=eq.${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({ next_fire_at: null, updated_at: new Date().toISOString() }),
    });
  }

  return new Response(JSON.stringify({ checked: dueAlerts.length, sent, failed, cleaned }), {
    headers: { "Content-Type": "application/json" },
  });
});
