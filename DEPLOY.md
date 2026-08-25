# Deploying this project

A step-by-step runbook. Follow it top to bottom; every value you need to type is written out.

**Commands are PowerShell**, since that is what this project is developed on. Two Windows-specific
details are worth knowing before you start, because both fail quietly rather than loudly:

- `curl` in PowerShell is an alias for `Invoke-WebRequest`, which does not understand curl's flags.
  Every `curl.exe` below is spelled out deliberately — that is the real curl, shipped with Windows.
- Windows PowerShell 5.1 has no `&&` operator; it is a parse error. Commands that must run in
  sequence are separated with `;` or put on their own lines.

```
Browser ──► https://<your-app>.vercel.app             Angular SPA (Vercel Hobby, free)
                 │  /api/*  rewritten, so the browser sees one origin
                 └──────────► https://teaching-learning-platform.fly.dev   .NET API (Fly.io)
                                    └─ SQLite on a Fly volume — data persists
```

**Read this before you start: Fly.io is not free.** Fly ended free allowances for new accounts in
October 2024. New signups get a short trial (2 VM-hours or 7 days, whichever runs out first), after
which a card is required. Realistic cost for this project, with the machine set to stop when idle:

| Item | Cost |
| :--- | :--- |
| `shared-cpu-1x` / 512 MB machine, always on | ~$3/month |
| the same machine with `auto_stop_machines` (this config) | cents per month for demo use — you pay only while it runs |
| 1 GB volume | $0.15/month, billed even while the machine is stopped |

So: roughly **$0.15–$3 a month** depending on traffic. Small, not zero. If zero is the requirement,
the appendix has genuinely free options.

**What you get for it, that no free tier could give:** a real volume. The database is a persistent
file, so data entered during a demo is still there next week. Every free option in the appendix has
an ephemeral filesystem, which for a SQLite app means the database resets on every restart.

You need a **GitHub account** (the repo is already at
`https://github.com/Mohamed-Kamal0/teaching-learning-platform`), a [Fly.io](https://fly.io) account
with a card on file, and a free [Vercel](https://vercel.com) account.

Total time: about 20 minutes.

---

## Step 1 — Install flyctl and sign in

**On Windows** — in PowerShell, not Git Bash:

```powershell
winget install Fly.Flyctl
```

or, if you do not have winget:

```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

> **Do not run the Linux installer below in Git Bash.** It detects the platform with `uname`, which
> reports `MINGW64_NT-…` under Git Bash. That is not a target it publishes builds for, so it
> requests a release asset that does not exist and prints Fly's HTML 404 page —
> *"The page you were looking for doesn't exist"* — rather than a useful error. The URL is fine; the
> platform is wrong.

<details>
<summary>macOS / Linux</summary>

```bash
brew install flyctl                      # macOS
curl -L https://fly.io/install.sh | sh   # either
```

</details>

**Then open a new PowerShell window.** The installer adds `%USERPROFILE%\.fly\bin` to your user
PATH, but already-open terminals keep the environment they started with — so `fly` stays unknown in
the window you installed from, however many times you reinstall.

```powershell
fly version
fly auth signup     # or: fly auth login
```

> **If the installer fails with `Remove-Item : ... flyctl.exe: Access to the path is denied`:**
> flyctl is already installed and its background agent is holding the binary open, so the archive
> cannot overwrite it. This is not a failed install — check with
> `& "$env:USERPROFILE\.fly\bin\flyctl.exe" version`. If that answers, you are done; skip to Step 2.
> To genuinely reinstall or upgrade, stop the agent first with `fly agent stop`, or
> `Stop-Process -Name flyctl -Force`.

Add a payment method when prompted — nothing deploys without one.

---

## Step 2 — Create the app

From the repository root. **Do not let it generate a config** — [`fly.toml`](fly.toml) is already
written and `fly launch` would overwrite it:

```powershell
fly launch --no-deploy --copy-config --name teaching-learning-platform --region ams
```

If the name is taken (they are globally unique across Fly), pick another and change **both**:
`app` in [`fly.toml`](fly.toml), and the URL in [`client/web/vercel.json`](client/web/vercel.json).

Pick a region near you if `ams` (Amsterdam) is not. `fly platform regions` lists them.

---

## Step 3 — Create the volume

This is what makes the data persist:

```powershell
fly volumes create sqlite_data --size 1 --region ams
```

The region **must** match `primary_region` in `fly.toml`, or the machine will have nothing to mount.
1 GB is the smallest and is vastly more than this database needs.

> **One volume means one machine.** A Fly volume attaches to a single machine, and two machines
> would mean two divergent databases behind one URL. Never `fly scale count` above 1.

---

## Step 4 — Set the admin password

It is a secret, so it is not in `fly.toml`:

```powershell
fly secrets set Seed__AdminPassword=CHOOSE-A-PASSWORD
```

If your password contains characters PowerShell treats specially — `$`, backtick, spaces — quote the
whole argument with single quotes: `fly secrets set 'Seed__AdminPassword=my $ecret'`.

**Write it down** — with `admin@teacherslessons.test` it is how you log in as administrator.

The double underscore is not a typo: that is how .NET maps a flat environment variable onto the
nested `Seed:AdminPassword` config key. A single underscore silently does nothing and the app
fail-fasts at startup.

---

## Step 5 — Deploy

```powershell
fly deploy
```

The first build takes **5–10 minutes** — it ships the repo to a Fly builder, builds the .NET 10
image from the root [`Dockerfile`](Dockerfile), and boots a machine. Watch for:

```
Applying migration '20260825132057_InitialCreate'.
Now listening on: http://[::]:8080
```

Check it:

```powershell
curl.exe https://teaching-learning-platform.fly.dev/api/health
# {"status":"ok","db":"ok"}
```

At this point the database is **empty except for the administrator** — migrations ran, but no demo
data. That is next.

---

## Step 6 — Seed the demo data, once

Because the volume persists, seeding is a one-time operation rather than something that happens on
every boot. Turn the flag on, let it boot, then turn it off:

```powershell
fly secrets set Seed__Demo=true     # triggers a restart; the app seeds during startup
fly logs                            # wait for: "the database was dropped and re-seeded with demo data"
                                    # then Ctrl+C to stop tailing
fly secrets unset Seed__Demo        # triggers another restart; from here the data is left alone
```

**Do not leave `Seed__Demo` set.** It drops and re-seeds the database on *every* start, which is
correct for a host with no disk and actively destructive here — it would throw away real data at
every restart and redeploy.

Confirm the data landed:

```powershell
curl.exe https://teaching-learning-platform.fly.dev/api/public/home
# {"approvedTeacherCount":2,"lessonCount":8,...}
```

---

## Step 7 — Deploy the client to Vercel

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

4. **Deploy.** A minute or two.

`vercel.json` already points `/api` at `https://teaching-learning-platform.fly.dev` — no edit needed
unless you changed the app name in Step 2.

Open the URL Vercel gives you. The home page should show live counts from the database: **2 approved
teachers, 8 lessons published**.

---

## Step 8 — Tell the API its public origin

Put your real Vercel URL into the `Cors__AllowedOrigin` placeholder in [`fly.toml`](fly.toml), then:

```powershell
fly deploy
git add -A
git commit -m "Set production CORS origin"
git push origin main
```

Not strictly required — the Vercel rewrite keeps every request same-origin, so CORS is never
exercised — but leaving the placeholder is a trap for anyone who later calls the API directly.

---

## Verify

All demo accounts use the password **`Demo1234`**.

| # | Check | Expected |
| :--- | :--- | :--- |
| 1 | `curl.exe https://teaching-learning-platform.fly.dev/api/health` | `{"status":"ok","db":"ok"}` |
| 2 | Open the Vercel site signed out | Home page shows 2 approved teachers, 8 lessons |
| 3 | Log in as `teacher.approved@demo.test` | Lands on the teacher area, not back on `/login` |
| 4 | Log in as `student.one@demo.test`, open a course | Lesson list renders; the third lesson's quiz is not yet available |
| 5 | Log in as your administrator (`admin@teacherslessons.test`) | Approvals screen lists a pending teacher |
| 6 | Add a lesson, `fly apps restart teaching-learning-platform`, reload | **The lesson is still there** — proves the volume is doing its job |

Check 3 is the important one. A successful login proves the whole chain: Vercel's rewrite reached
Fly, `UseForwardedHeaders` made the request look like HTTPS behind Fly's edge TLS, and the browser
accepted the `Secure` auth cookie as same-origin.

Check 6 is the one worth actually doing — it is the difference between this deployment and every
free alternative.

Full browser smoke test against the live site:

```powershell
cd client/web
npm ci
$env:SMOKE_BASE = "https://your-app.vercel.app"
node smoke.mjs
```

`$env:VAR = "..."` is how PowerShell sets an environment variable — the `VAR=value command` prefix
form from bash does not exist here, and would be read as a command name.

---

## Day-to-day

| Task | Command |
| :--- | :--- |
| Deploy API changes | `fly deploy` |
| Deploy client changes | `git push` — Vercel rebuilds automatically |
| Watch logs | `fly logs` |
| Shell into the machine | `fly ssh console` |
| Check status and cost drivers | `fly status`, `fly scale show` |
| Re-seed from scratch | Step 6 again |
| Stop paying | `fly apps destroy teaching-learning-platform` and `fly volumes destroy` — the volume bills even while stopped |

---

## When something goes wrong

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| The installer prints *"The page you were looking for doesn't exist"* | The Linux installer was run on Windows (usually in Git Bash) — `uname` reports `MINGW64_NT-…`, so it fetches a release asset that does not exist | Use `winget install Fly.Flyctl` from PowerShell (Step 1) |
| `fly` is not recognised right after installing | The installer put `%USERPROFILE%\.fly\bin` on the user PATH, but open terminals keep the environment they launched with | Open a **new** PowerShell window. Reinstalling does not help and is not needed |
| Installer fails: `Remove-Item : ... flyctl.exe: Access to the path is denied` | flyctl is already installed and its background agent holds the binary locked | Nothing is wrong — verify with `& "$env:USERPROFILE\.fly\bin\flyctl.exe" version`. To force an upgrade, `fly agent stop` first |
| Deploy fails: *volume not found* / machine won't start | Volume missing, or in a different region from `primary_region` | `fly volumes list`; recreate in the right region (Step 3) |
| App exits: *Missing required secrets Seed:AdminEmail / Seed:AdminPassword* | The secret was never set, or has a single underscore | `fly secrets list`; re-run Step 4 |
| Home page shows 0 teachers, 0 lessons | Demo data never seeded | Step 6 |
| Data resets on every deploy | `Seed__Demo` is still set | `fly secrets unset Seed__Demo` |
| Data appears to change at random between page loads | More than one machine is running | `fly scale count 1` |
| Vercel build succeeds but the site is blank or 404 | Root Directory not set to `client/web` | Vercel → Settings → General → Root Directory |
| Site loads but every API call fails | App name in `vercel.json` doesn't match `fly.toml` | Make them agree |
| Login appears to work but you bounce back to `/login` | The auth cookie was rejected | Confirm `vercel.json` still has the `/api/:path*` rewrite — it is what makes the request same-origin |
| Bill larger than expected | The machine is not stopping when idle | `fly status`; confirm `auto_stop_machines` and `min_machines_running = 0` in `fly.toml`, then `fly deploy` |

---

## Notes on this deployment

**The reverse-proxy handling matters here.** Fly terminates TLS at its edge and forwards to the
container over plain HTTP, so without `UseForwardedHeaders` (already in `Program.cs`)
`Request.Scheme` would always be `http`: `UseHttpsRedirection` would loop every request through a
redirect, and the auth cookie's `CookieSecurePolicy.Always` would silently refuse to set the cookie
at all. This is configured — the note is here so nobody "simplifies" it away.

**One machine, by necessity.** SQLite on a single volume cannot be scaled horizontally.

**A leftover from the ngrok setup:** `core/interceptors/ngrok.interceptor.ts` adds an
`ngrok-skip-browser-warning` header to every request. It is ignored by Fly and harmless, so it is
left in place — remove it if you want the client clean.

---

## Appendix — free alternatives

All three cost nothing; all three give up something Fly provides.

**ngrok tunnel** — the API runs on your own machine, published through a tunnel. No card, and data
persists on your real disk. But the site is only up while your machine is on with the API and tunnel
running. Claim a static domain at [dashboard.ngrok.com](https://dashboard.ngrok.com) → **Domains** →
**Create Domain** (passing a domain you have not claimed gives `ERR_NGROK_313`), then:

```powershell
ngrok http 5099 --url=https://YOUR-DOMAIN.ngrok-free.app
```

Run the API in a second terminal, in Production, passing the secrets as environment variables —
.NET only reads user-secrets in Development:

```powershell
cd server/TeachersLessons.Api
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:Seed__AdminEmail = "admin@teacherslessons.test"
$env:Seed__AdminPassword = "YOUR-ADMIN-PASSWORD"
dotnet run --urls http://localhost:5099
```

The
`ngrok.interceptor.ts` mentioned above exists for this setup: ngrok's free tier otherwise answers
browser-looking traffic with an interstitial page instead of forwarding it.

**Render** — [`render.yaml`](render.yaml) is a working Blueprint, no card required. Sleeps after 15
minutes idle with a ~50 second cold start, so it needs a pinger every 10 minutes; free compute is
metered at 750 hours/month against 744 in a long month.

**Google Cloud Run** — builds from the root [`Dockerfile`](Dockerfile); fast cold starts and a large
free allowance, but needs a billing account with a card even to stay free:

```powershell
gcloud run deploy teaching-learning-api --source . `
  --region us-central1 --port 8080 --memory 512Mi --max-instances 1 --allow-unauthenticated `
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production `
  --set-env-vars "ConnectionStrings__AppDb=Data Source=/app/data/teacherslessons.db" `
  --set-env-vars Seed__AdminEmail=admin@teacherslessons.test `
  --set-env-vars Seed__AdminPassword=CHOOSE-A-PASSWORD `
  --set-env-vars Seed__Demo=true
```

The line continuation character is a **backtick**, not a backslash — and nothing may follow it on
the line, not even a space.

For Render and Cloud Run, `Seed__Demo=true` is **required**, not optional — with no persistent disk
the database is empty on every boot, and the flag is what keeps the demo populated. That is exactly
the flag you must *not* set on Fly.
