# Deploying this project, free

A step-by-step runbook. Follow it top to bottom; every value you need to type is written out.

The end state is two free services:

```
Browser ──► https://<your-app>.vercel.app          Angular SPA (Vercel Hobby)
                 │  /api/*  rewritten, so the browser sees one origin
                 └──────────► https://<service>-<id>.us-central1.run.app   .NET API (Cloud Run)
                                    └─ SQLite, re-seeded with demo data on every start
```

**Why Cloud Run.** The API is .NET 10, too new for buildpack-style hosts, so it has to ship as a
Docker image. Cloud Run builds one straight from the repo, scales to zero when nobody is using it,
and its always-free monthly allowance is far larger than this project will ever consume. Cold
starts are a few seconds rather than the ~50 seconds typical of free tiers that suspend containers.

**One thing to know up front:** Cloud Run needs a Google Cloud **billing account with a payment
method**, even to use the free tier. Having a card on file is not the same as being charged — the
steps below stay inside the always-free allowance, and Step 7 sets a budget alarm so you find out
immediately if that ever stops being true. If you would rather not attach a card at all, see the
appendix; `render.yaml` is kept in the repo as a no-card fallback.

You need a **GitHub account** (the repo is already at
`https://github.com/Mohamed-Kamal0/teaching-learning-platform`), a
[Google Cloud](https://console.cloud.google.com) account, and a [Vercel](https://vercel.com)
account.

Total time: about 25 minutes, most of it waiting for the first build.

---

## Step 1 — Push the deployment files

```bash
git add -A
git commit -m "Deploy to Cloud Run and Vercel"
git push origin main
```

If `git push` is rejected because the remote has moved on, run `git pull --rebase origin main`
first, then push again.

---

## Step 2 — Set up Google Cloud

1. Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and sign in:

   ```bash
   gcloud auth login
   ```

2. Create a project and make it the default. The project ID must be globally unique, so put
   something of your own on the end:

   ```bash
   gcloud projects create teaching-learning-<something-unique>
   gcloud config set project teaching-learning-<something-unique>
   ```

3. **Link a billing account.** In the [console](https://console.cloud.google.com/billing), attach
   your project to a billing account (create one if this is your first project — new accounts also
   get $300 of trial credit). Nothing deploys without this.

4. Enable the three APIs the build needs:

   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

---

## Step 3 — Deploy the API

From the repository root:

```bash
gcloud run deploy teaching-learning-api \
  --source . \
  --region us-central1 \
  --port 8080 \
  --memory 512Mi \
  --max-instances 1 \
  --allow-unauthenticated \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production \
  --set-env-vars "ConnectionStrings__AppDb=Data Source=/app/data/teacherslessons.db" \
  --set-env-vars Seed__AdminEmail=admin@teacherslessons.test \
  --set-env-vars Seed__AdminPassword=CHOOSE-A-PASSWORD \
  --set-env-vars Seed__Demo=true
```

Replace `CHOOSE-A-PASSWORD` with a password of your own and **write it down** — it is how you log in
as administrator.

Four flags matter more than they look:

| Flag | Why |
| :--- | :--- |
| `--source .` | Cloud Build finds the `Dockerfile` at the repo root and builds it. This only works from the root — the Dockerfile was moved there for exactly this reason. |
| `--region us-central1` | The free tier's egress allowance covers North America, and `us-central1` is inside every published reading of the free-tier region rules. Deploying elsewhere may cost money. |
| **`--max-instances 1`** | **Do not change this.** Cloud Run's filesystem is per-instance and in-memory, so two instances would mean two different databases serving the same site. It also caps runaway spend. |
| `--allow-unauthenticated` | Makes it a public website rather than an IAM-guarded internal service. |

The double underscores in the env vars are not a typo — that is how .NET maps a flat environment
variable onto a nested config key. A single underscore silently does nothing, the app cannot find
its admin credentials, and it throws at startup.

The first deploy takes **5–10 minutes**: it uploads the source, builds the .NET 10 image in Cloud
Build, pushes it to Artifact Registry and starts it. Answer `y` if it offers to create the
Artifact Registry repository.

When it finishes, gcloud prints your service URL:

```
Service URL: https://teaching-learning-api-XXXXXXXX.us-central1.run.app
```

**Copy it — you need it in the next step.** Check it answers:

```bash
curl https://teaching-learning-api-XXXXXXXX.us-central1.run.app/api/health
# {"status":"ok","db":"ok"}
```

If you would rather see the logs:

```bash
gcloud run services logs read teaching-learning-api --region us-central1 --limit 50
```

You are looking for `Applying migration '20260825132057_InitialCreate'`, then
`Seed:Demo is set — the database was dropped and re-seeded with demo data.`

> **Prefer clicking?** [console.cloud.google.com/run](https://console.cloud.google.com/run) →
> **Deploy container** → **Continuously deploy from a repository** → connect GitHub → pick the repo
> → Build type **Dockerfile**, location `/Dockerfile` → then set the same region, port, memory,
> max-instances, authentication and environment variables in *Container, Networking, Security*.
> This also gives you automatic redeploys on every push, which the CLI route does not.

---

## Step 4 — Point the client at your API URL

This step is **not optional** — the committed value is a placeholder, because a Cloud Run URL
contains a generated project identifier and cannot be known in advance.

Edit [`client/web/vercel.json`](client/web/vercel.json) and replace the host in `destination` with
the URL from Step 3:

```json
{
  "source": "/api/:path*",
  "destination": "https://teaching-learning-api-XXXXXXXX.us-central1.run.app/api/:path*"
}
```

Keep the `/api/:path*` suffix. Then:

```bash
git add -A && git commit -m "Point client at the API" && git push origin main
```

---

## Step 5 — Deploy the client to Vercel

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
**2 approved teachers, 8 lessons published**. If you see those numbers, the whole chain is working
— Vercel served the app, rewrote `/api/public/home` to Cloud Run, and Cloud Run answered from the
seeded database.

---

## Step 6 — Tell the API its public origin

```bash
gcloud run services update teaching-learning-api \
  --region us-central1 \
  --update-env-vars Cors__AllowedOrigin=https://your-actual-app.vercel.app
```

Not strictly required — the Vercel rewrite keeps every request same-origin, so CORS is never
exercised — but leaving it wrong is a trap for anyone who later calls the API directly from a
browser.

---

## Step 7 — Set a budget alarm

Do this once. It is the difference between "free" and "free as far as I know".

1. [console.cloud.google.com/billing](https://console.cloud.google.com/billing) → **Budgets &
   alerts** → **Create budget**.
2. Scope it to your project, set the amount to **$1**, and tick alerts at 50% / 90% / 100%.

You should never hear from it. If you do, something is misconfigured — most likely
`--max-instances` was raised, or the service was deployed outside `us-central1`.

**What the free allowance actually is,** per month, per billing account: 2 million requests,
180,000 vCPU-seconds, 360,000 GiB-seconds of memory, and 1 GB of egress from North America. With
request-based billing you are charged only while a request is in flight, so an idle service costs
nothing.

**Do not set `--min-instances 1`.** It is the obvious-looking way to avoid cold starts, and it
would bill an idle instance around the clock — roughly 2.6 million instance-seconds a month against
a 180,000 vCPU-second allowance. Cold starts here are a few seconds; that is the right trade.

Because cold starts are quick, you do **not** need an uptime pinger for this deployment. If you
want the first visit of the day to be instant anyway, a free cron
([cron-job.org](https://cron-job.org)) hitting `/api/health` every 5 minutes stays comfortably
inside the allowance — roughly 20,000 vCPU-seconds a month at a couple of seconds per ping.

---

## Verify the deployment

Work through these against your Vercel URL. All demo accounts use the password **`Demo1234`**.

| # | Check | Expected |
| :--- | :--- | :--- |
| 1 | `curl https://<api>.run.app/api/health` | `{"status":"ok","db":"ok"}` |
| 2 | Open the site signed out | Home page shows 2 approved teachers, 8 lessons |
| 3 | Log in as `teacher.approved@demo.test` | Lands on the teacher area, not back on `/login` |
| 4 | Log in as `student.one@demo.test`, open a course | Lesson list renders; the third lesson's quiz is not yet available |
| 5 | Log in as your administrator (`admin@teacherslessons.test` + the password from Step 3) | Approvals screen lists a pending teacher |

Check 3 is the important one. A successful login proves the entire chain: Vercel's rewrite reached
Cloud Run, `UseForwardedHeaders` made the request look like HTTPS, and the browser accepted the
`Secure` auth cookie as same-origin.

You can also run the full browser smoke test against production:

```bash
cd client/web
npm ci
SMOKE_BASE=https://your-app.vercel.app node smoke.mjs
```

---

## Redeploying

The CLI route does not watch GitHub. After changing server code, run the Step 3 command again —
gcloud reuses everything, so it is one command and a few minutes. Environment variables already set
are preserved across deploys.

Vercel *does* watch GitHub: pushing to `main` redeploys the client automatically.

---

## When something goes wrong

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Vercel build succeeds but the site is a blank page or 404 | Root Directory not set to `client/web` | Vercel → Settings → General → Root Directory → `client/web` → redeploy |
| Site loads but every API call fails | `vercel.json` still has the placeholder URL | Step 4 — put your real Cloud Run URL in, commit, push |
| Login appears to work but you bounce back to `/login` | The auth cookie was rejected — usually CORS was used instead of the rewrite | Confirm `vercel.json` still has the `/api/:path*` rewrite |
| `gcloud run deploy` builds with buildpacks instead of the Dockerfile | Run from a subdirectory | Run it from the repository root, where `Dockerfile` lives |
| Build fails: `COPY server/... not found` | The Dockerfile was moved but the build context is wrong | `--source .` from the repo root is the only supported invocation |
| Deploy fails: *the user-provided container failed to start and listen on the port* | The app threw at startup — almost always a missing or misspelled env var | `gcloud run services logs read ...`; confirm the **double** underscores |
| Home page shows 0 teachers, 0 lessons | `Seed__Demo` is not `true` | `gcloud run services update teaching-learning-api --region us-central1 --update-env-vars Seed__Demo=true` |
| Data seems to change at random between page loads | More than one instance is running | `--max-instances 1`. Each instance has its own in-memory database. |
| Billing alert fires | Almost always max-instances or the wrong region | Check both; `gcloud run services describe teaching-learning-api --region us-central1` |

---

## Things to know about this deployment

**Data does not survive a restart.** Cloud Run's filesystem is in-memory and per-instance, so the
SQLite file vanishes whenever the instance is recycled — which, with scale-to-zero, is whenever the
site goes quiet. `Seed__Demo=true` turns that into a feature: every cold start drops the database
and re-seeds the known demo dataset, so the public link is always populated and always shows the
same, correct data. The trade-off is that anything a visitor types — a new lesson, a mark, a
registration — is gone at the next restart. That is the right behaviour for a demo and the wrong
behaviour for anything else.

The database also counts against the container's memory, since the filesystem *is* memory. The
seeded dataset is a few hundred kilobytes against a 512 MiB limit, so this is a non-issue here —
but it is why the app should never accumulate real data on this deployment.

**If you ever want real persistence,** unset `Seed__Demo` and move the database off SQLite. Neon
Postgres has a permanently free tier; the work is swapping the EF Core provider to
`Npgsql.EntityFrameworkCore.PostgreSQL`, regenerating the migration, and making the SQLite-specific
converters in `server/TeachersLessons.Api/Data/DateTimeOffsetConverters.cs` conditional — Postgres
handles `DateTimeOffset` natively, and the lesson-timing comparisons depend on that conversion.

**Where each secret lives.** `Seed__AdminPassword` is passed on the deploy command line and stored
as a Cloud Run environment variable — never in the repo. For something stricter, put it in
[Secret Manager](https://cloud.google.com/secret-manager) and swap the flag for
`--set-secrets Seed__AdminPassword=admin-password:latest`; Secret Manager's free tier covers this.

---

## Appendix — Render, if you would rather not attach a card

[`render.yaml`](render.yaml) is a working Render Blueprint for the same API. Render's free web
service does not require a payment method, which is the one thing Cloud Run cannot offer.

Render dashboard → **New +** → **Blueprint** → pick the repo → it reads `render.yaml` and prompts
for `Seed__AdminPassword`. Everything else — the Vercel side, the verification table, the
troubleshooting notes — is unchanged, except:

- Render sleeps after **15 minutes** idle with a ~50 second cold start, which is longer than
  Vercel's proxy will wait. A pinger every 10 minutes is required rather than optional.
- Free compute is metered at 750 hours/month; a 31-day month is 744, so keeping it awake
  continuously only fits if it is the only free service in your account.
