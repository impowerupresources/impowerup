# Setting up real background push for ImpowerUp

This lets alerts fire even when the app is fully closed. It adds a small
free Supabase backend on top of the app, which otherwise stays fully local.

## What you need
- A free [Supabase](https://supabase.com) account
- The app already hosted somewhere with HTTPS (see the "About" section in
  Settings for hosting steps if you haven't done this yet)

## 1. Create the Supabase project
1. Go to supabase.com, sign up free, click "New project."
2. Once it's created, open **SQL Editor** in the left sidebar.
3. Paste in the contents of `supabase-schema.sql` (included alongside this
   file) and click Run.

## 2. Deploy the sending function
1. Install the Supabase CLI, or just use the dashboard's **Edge Functions**
   tab and create a new function named `send-scheduled-alerts`.
2. Paste in the contents of `send-scheduled-alerts.ts`.
3. Under that function's **Secrets**, add:
   - `VAPID_PUBLIC_KEY` = `BMlAUJLoE9ePByckfiTIEeHDLsuAwfazX40aHG_xW7EaoRC45W5vxddRTXZ4zXrW0C3rIz8S5Ph-H-WT8IRTVLg`
   - `VAPID_PRIVATE_KEY` = `BbGdlUtLJwmarbtzTgR1_C4vwNx6Svgq_rEXKqOwXIo`
   - `SB_URL` = your project's REST URL (Project Settings → API → Project URL)
   - `SB_SERVICE_ROLE_KEY` = Project Settings → API → `service_role` secret
     key (never put this key in the app itself — it's server-only)
4. Deploy the function.

**Keep the private VAPID key and the service_role key secret** — they only
ever go into Supabase's Edge Function secrets, never into ImpowerUp.html.

## 3. Schedule it
In the Supabase dashboard, under **Edge Functions → send-scheduled-alerts →
Cron**, add a schedule to run it every 1–2 minutes (e.g. `*/2 * * * *`).
This is what actually checks for due alerts and sends the pushes.

## 4. Connect the app
1. In Project Settings → API, copy the **Project URL** and the **anon
   public** key (not the service_role one).
2. Open ImpowerUp on your phone → Settings → "Background Push (optional)"
   → paste both in → Save → tap Connect.
3. Grant the notification permission prompt.

From then on, whenever you're in the app, it quietly keeps your alert
schedule synced to Supabase. The Edge Function checks every couple of
minutes and fires a real push through Apple/Google's push service, which
wakes your phone even if ImpowerUp is closed.

## Notes / limits
- This app has no login system, so the anon key is the only thing gating
  access to these two small tables. Don't reuse this Supabase project for
  anything more sensitive than reminder text.
- Because the app recalculates "when's next" locally and re-uploads it, a
  reminder's *next* occurrence only stays fresh if you open the app at
  least occasionally (daily use is more than enough).
- If you ever want to fully undo this, just delete the Supabase project —
  the app keeps working locally exactly as before, minus background push.
