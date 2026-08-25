# Deploying this project, free

A step-by-step runbook. Follow it top to bottom; every value you need to type is written out.

The end state is two free services:

```
Browser ──► https://<your-app>.vercel.app          Angular SPA (Vercel Hobby)
                 │  /api/*  rewritten, so the browser sees one origin
                 └──────────► https://teaching-learning-api.onrender.com   .NET API (Render free)
                                    └─ SQLite, re-seeded with demo data on every start
```

You need a **GitHub account** (the repo is already at
`https://github.com/Mohamed-Kamal0/teaching-learning-platform`), plus free accounts on
[render.com](https://render.com) and [vercel.com](https://vercel.com). Both let you sign in with
GitHub, which is the easiest route because it grants repo access at the same time.

Total time: about 20 minutes, most of it waiting for the first Render build.

---

## Step 1 — Push the deployment files

The config files exist locally but nothing is on GitHub yet, and both hosts deploy *from GitHub*.

```bash
git add -A
git commit -m "Deploy to Render and Vercel"
git push origin main
```

If `git push` is rejected because the remote has moved on, run `git pull --rebase origin main`
first, then push again.

---

## Step 2 — Deploy the API to Render

1. Go to [dashboard.render.com](https://dashboard.render.com).
2. **New +** (top right) → **Blueprint**.
3. Connect your GitHub account if prompted, then pick
   **`Mohamed-Kamal0/teaching-learning-platform`**.
4. Render reads [`render.yaml`](render.yaml) and shows one service, `teaching-learning-api`.
5. It will ask for the one value that is deliberately *not* in the repo:

   | Field | What to enter |
   | :--- | :--- |
   | `Seed__AdminPassword` | A password you choose, e.g. `Admin1234` — **write it down**, it is how you log in as administrator |

6. Click **Apply** / **Deploy Blueprint**.

The first build takes **5–10 minutes** — it downloads the .NET 10 SDK image, restores packages
and publishes. Watch the **Logs** tab. You are looking for:

```
Applying migration '20260825132057_InitialCreate'.
Seed:Demo is set — the database was dropped and re-seeded with demo data.
Now listening on: http://[::]:8080
```

Then note your service URL, shown at the top of the service page. It should be:

```
https://teaching-learning-api.onrender.com
```

> **If the URL is different** — Render service names are globally unique, so if someone else has
> taken `teaching-learning-api` you will get a suffixed name. Copy whatever URL Render actually
> assigned; you will need it in Step 3.

Check it works:

```bash
curl https://teaching-learning-api.onrender.com/api/health
# {"status":"ok","db":"ok"}
```

---

## Step 3 — Point the client at your API URL

**Skip this step if your Render URL is exactly `https://teaching-learning-api.onrender.com`** —
it is already the default.

Otherwise edit [`client/web/vercel.json`](client/web/vercel.json) and replace the host in
`destination`:

```json
{
  "source": "/api/:path*",
  "destination": "https://YOUR-ACTUAL-RENDER-URL.onrender.com/api/:path*"
}
```

Then `git add -A && git commit -m "Point client at API" && git push origin main`.

---

## Step 4 — Deploy the client to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import **`teaching-learning-platform`** from GitHub.
3. Set these — **the Root Directory is the one people get wrong**:

   | Setting | Value |
   | :--- | :--- |
   | Framework Preset | Angular |
   | **Root Directory** | **`client/web`** — click *Edit* next to it and select the folder |
   | Build Command | leave default (`vercel.json` sets it) |
   | Output Directory | leave default (`vercel.json` pins it) |
   | Environment Variables | none needed |

4. **Deploy.** This one is quick — a minute or two.

Open the URL Vercel gives you. The home page should show live counts read from the database:
**2 approved teachers, 8 lessons published**. If you see those numbers, the whole chain is
working — Vercel served the app, rewrote `/api/public/home` to Render, and Render answered from
the seeded database.

---

## Step 5 — Tell the API its public origin

Edit [`render.yaml`](render.yaml) and replace the placeholder with your real Vercel URL:

```yaml
- key: Cors__AllowedOrigin
  value: https://your-actual-app.vercel.app
```

Commit and push; Render redeploys automatically.

This is not strictly required — the Vercel rewrite keeps every request same-origin, so CORS is
never exercised — but leaving the placeholder in place is a trap for anyone who later calls the
API directly from a browser.

---

## Step 6 — Stop the API falling asleep

A free Render service **sleeps after 15 minutes of no traffic** and takes roughly 50 seconds to
wake. That is longer than Vercel's proxy will wait, so someone opening your link cold gets an
error rather than a slow page. Fix it with a free pinger:

1. Sign up at [cron-job.org](https://cron-job.org) (free, no card).
2. **Create cronjob**:

   | Field | Value |
   | :--- | :--- |
   | Title | `keep API awake` |
   | URL | `https://teaching-learning-api.onrender.com/api/health` |
   | Schedule | Every **10 minutes** |

3. Save and enable.

> **Budget:** Render's free plan gives **750 instance-hours per month** and a 31-day month is 744
> hours, so running continuously fits — **but only if this is the only free web service in your
> Render account.** A second free service puts you over and both get suspended. If you have others,
> delete them or accept the cold starts.

---

## Verify the deployment

Work through these against your Vercel URL. All demo accounts use the password **`Demo1234`**.

| # | Check | Expected |
| :--- | :--- | :--- |
| 1 | `curl https://<api>.onrender.com/api/health` | `{"status":"ok","db":"ok"}` |
| 2 | Open the site signed out | Home page shows 2 approved teachers, 8 lessons |
| 3 | Log in as `teacher.approved@demo.test` | Lands on the teacher area, not back on `/login` |
| 4 | Log in as `student.one@demo.test`, open a course | Lesson list renders; the third lesson's quiz is not yet available |
| 5 | Log in as your administrator (`admin@teacherslessons.test` + the password from Step 2) | Approvals screen lists a pending teacher |
| 6 | Leave it 20 minutes, reload | Loads promptly — proves the pinger works |

Check 3 is the important one. A successful login proves the entire chain: Vercel's rewrite reached
Render, `UseForwardedHeaders` made the request look like HTTPS, and the browser accepted the
`Secure` auth cookie as same-origin.

You can also run the full browser smoke test against production:

```bash
cd client/web
npm ci
SMOKE_BASE=https://your-app.vercel.app node smoke.mjs
```

---

## When something goes wrong

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Vercel build succeeds but the site is a blank page or 404 | Root Directory not set to `client/web` | Vercel → Settings → General → Root Directory → `client/web` → redeploy |
| Site loads but every API call fails | `vercel.json` `destination` doesn't match the real Render URL | Fix it, commit, push (Step 3) |
| Login appears to work but you bounce back to `/login` | The auth cookie was rejected — usually CORS was used instead of the rewrite | Confirm `vercel.json` still has the `/api/:path*` rewrite |
| Render deploy fails on health check | The app crashed at startup — almost always a missing env var | Logs tab; check `Seed__AdminPassword` was actually set |
| Render build fails cloning the repo | A stray submodule reference | Already removed, but confirm `client/web/teaching-learning-platform` is not in the repo |
| Home page shows 0 teachers, 0 lessons | `Seed__Demo` is not `true` | Render → Environment → set `Seed__Demo` to `true` → redeploy |
| First visit of the day errors, later ones work | The service was asleep | Set up the pinger (Step 6) |

To force a rebuild without a code change: Render → **Manual Deploy** → *Clear build cache & deploy*.
Vercel → Deployments → the ⋯ menu on the latest → **Redeploy**.

---

## Things to know about this deployment

**Data does not survive a restart.** Render's free plan has no persistent disk, so the SQLite file
lives on the container's temporary filesystem. `Seed__Demo=true` turns that into a feature: every
cold start drops the database and re-seeds the known demo dataset, so the public link is always
populated and always shows the same, correct data. The trade-off is that anything a visitor types —
a new lesson, a mark, a registration — is gone at the next restart. That is the right behaviour for
a demo and the wrong behaviour for anything else.

**If you ever want real persistence,** unset `Seed__Demo` and move the database off SQLite. Neon
Postgres has a permanently free tier; the work is swapping the EF Core provider to
`Npgsql.EntityFrameworkCore.PostgreSQL`, regenerating the migration, and making the SQLite-specific
converters in `server/TeachersLessons.Api/Data/DateTimeOffsetConverters.cs` conditional — Postgres
handles `DateTimeOffset` natively, and the lesson-timing comparisons depend on that conversion.

**Never raise Render's instance count above one.** SQLite cannot be shared between instances.

**Where each secret lives.** Everything is committed in `render.yaml` except `Seed__AdminPassword`,
which is marked `sync: false` and exists only in the Render dashboard. Keep it that way — do not
put it in the repo.
