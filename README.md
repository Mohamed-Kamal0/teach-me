# Teachers, Lessons and Students

An ASP.NET Core 10 + Angular 18 teaching platform. Teachers publish lessons — a recording, and
optionally a handout, a quiz and its answers — each released on its own schedule. Students join a
teacher's course with a joining code and see only what is open to them, now.

The brief is [`project.md`](project.md); the design and schedule behind it is [`plan.md`](plan.md).

---

## What you need

| Tool | Version used |
| :--- | :--- |
| .NET SDK | 10.0.303 |
| `dotnet-ef` | 10.0.10 (`dotnet tool install -g dotnet-ef`) |
| Node.js | 22.14.0 |
| npm | 10.9.2 |

No database engine to install — the app uses SQLite, and the file is created for you.

---

## Running it from a clean clone

### 1. Set the two secrets

Nothing sensitive lives in `appsettings.json`. The API **fails fast at startup** with a readable
message if either of these is missing.

```bash
cd server/TeachersLessons.Api
dotnet user-secrets init
dotnet user-secrets set "Seed:AdminEmail"    "admin@teacherslessons.test"
dotnet user-secrets set "Seed:AdminPassword" "Admin1234"
```

### 2. Create the database and load the demo data

```bash
# from server/TeachersLessons.Api
dotnet restore
dotnet ef database update
dotnet run -- seed --demo
```

`seed --demo` drops, migrates and reseeds a known dataset in one command, so a broken database on
demo day is a thirty-second fix. It refuses to run when `ASPNETCORE_ENVIRONMENT=Production`.

### 3. Run the API

```bash
# from server/TeachersLessons.Api
dotnet run --urls http://localhost:5099
```

### 4. Run the client, in a second terminal

```bash
cd client/web
npm ci
npm start
```

Open **http://localhost:4200**. The dev server proxies `/api` to the API
(`client/web/proxy.conf.json`), so every call is same-origin and the auth cookie just works.

---

## Demo credentials

All demo accounts use the password **`Demo1234`**; the administrator uses whatever you set above.

| Who | Email |
| :--- | :--- |
| Administrator | `admin@teacherslessons.test` (password: as set in step 1) |
| Teacher — approved | `teacher.approved@demo.test` |
| Teacher — approved (2nd course) | `teacher.second@demo.test` |
| Teacher — pending | `teacher.pending@demo.test` |
| Teacher — turned away | `teacher.rejected@demo.test` |
| Student — on two courses | `student.one@demo.test` |
| Student — on one course | `student.two@demo.test` |

The seeded lessons have **deliberately staggered moments**: one fully open, one whose quiz opens
tomorrow, one whose answers are already released, and one not open at all. That is what makes the
timing requirement demonstrable without touching the database by hand.

---

## Deployment

**[DEPLOY.md](DEPLOY.md) is the step-by-step runbook.** What follows is why it is built this way.

Two free services, one behind the other:

| Piece | Host | What it serves |
| :--- | :--- | :--- |
| Angular client | Vercel (Hobby) | the static SPA, plus a rewrite of `/api/*` |
| .NET API | Render (free web service, Docker) | everything under `/api` |

**Why a rewrite and not CORS.** Every API call in the client is a hardcoded relative path —
there is no `environment.ts` and no API base URL. So the SPA has to be served from an origin
that proxies `/api`, which `client/web/vercel.json` does. That also keeps every request
same-origin, which matters because the `tls_auth` cookie is `SameSite=Lax` and a genuine
cross-site XHR would drop it. Replacing the rewrite with CORS breaks login.

**Vercel.** Import the repository, set **Root Directory to `client/web`**, framework Angular.
`vercel.json` pins `outputDirectory` to `dist/web/browser` — Angular 18's `application` builder
puts the browser bundle one level deeper than the preset expects, and getting this wrong serves
a 404 shell. Update the rewrite `destination` if Render assigns a URL other than
`teaching-learning-api.onrender.com`.

**Render.** New → Blueprint; it reads `render.yaml`. Every variable is committed there except
`Seed__AdminPassword`, which is marked `sync: false` and is entered once in the dashboard.
After the first Vercel deploy, put the real Vercel URL into `Cors__AllowedOrigin`.

**`Seed__Demo=true` wipes the database on every container start.** Render's free plan has no
persistent disk, so the SQLite file is empty on each cold boot; this flag re-runs `DemoSeeder`
so the public demo is always populated with the credentials above. The consequence is that
anything a visitor types is gone at the next restart. Never set this flag on a deployment whose
data is meant to survive — leave it unset and startup falls back to migrate + seed-admin only.

**Keeping it awake.** A free Render service sleeps after 15 minutes idle and takes ~50 seconds
to wake, which is longer than Vercel's proxy will wait — a cold visit errors rather than loading
slowly. A free cron (cron-job.org, UptimeRobot) hitting `GET /api/health` every 10 minutes keeps
it up. The free plan allows 750 instance-hours a month against 744 hours in a long month, so
continuous uptime fits **only if this is the only free web service in the account**.

The API is a single instance by necessity — SQLite cannot be scaled horizontally.

To point the Playwright smoke tests at the deployment instead of localhost:

```bash
SMOKE_BASE=https://<app>.vercel.app node smoke.mjs
```

---

## Running the tests

```bash
cd server
dotnet test
```

Eighteen tests across the four suites that a click-through cannot give you confidence in:

| Suite | What it defends |
| :--- | :--- |
| **A** — `PendingTeacherTests` | A pending or turned-away teacher is refused every teacher route; approval takes effect on the **next call**, with no re-login |
| **B** — `MarkConstraintTests` | No second mark for the same student on the same lesson (409); the score bound is read **from the lesson**; `passed` sent by a client is ignored |
| **C** — `TimingEnforcementTests` | An unopened quiz has **no `quizUrl` key in the raw JSON** — asserted on the response string, because a missing key and a null key deserialise identically |
| **D** — `OwnershipIsolationTests` | A teacher cannot reach another teacher's lesson (404); a student cannot read a course they never joined (**403**, not an empty list) |

The tests run against **`Microsoft.Data.Sqlite`** in shared-cache in-memory mode, never EF Core's
InMemory provider — that provider ignores unique indexes, so suite B would pass whether or not the
constraint it is testing exists.

### Browser smoke test (optional)

`client/web/smoke.mjs` drives the real UI through the brief's demo script with Playwright — twenty
checks, including that an unopened lesson never reaches the page and an unopened quiz renders a
message rather than a dead control. With both servers running:

```bash
cd client/web
npx playwright install chromium   # first time only
node smoke.mjs
```

`smoke-api-down.mjs` covers Req 23's hardest case — it kills the API underneath a signed-in session
and checks that every screen says so, both when navigating inside the app and after a cold reload:

```bash
node smoke-api-down.mjs
```

---

## Checking the requirement that cannot be faked

The brief is explicit that the **server**, not the browser, withholds anything whose moment has not
come. To see it directly, sign in as `student.one@demo.test` and read the raw response:

```
GET /api/student/courses/{teacherId}/lessons
```

The lesson whose quiz opens tomorrow has **no `quizUrl` key at all** — not `null`, not sent-and-hidden.
The lesson that has not opened is **absent from the list**, and fetching it by id answers **404**.
That behaviour comes from a single projection, `LessonQueries.VisibleTo`, which every student-facing
lesson read goes through.

---

## How it is laid out

```
server/TeachersLessons.Api/
  Domain/       entities and enums, Guid (UUIDv7) keys
  Data/         AppDbContext, per-entity configurations, DbSeeder, DemoSeeder
  Features/     Auth · Admin · Teacher · Student · Public · Helper — controller + DTOs + validators
  Common/       CurrentUser, policies, antiforgery, ProblemDetails middleware, VisibleTo projection
  Migrations/
  helper-intents.json     the Req 18 phrase list — content, not code
server/TeachersLessons.Api.Tests/    the four suites above
client/web/src/app/
  core/         auth service, interceptors, guards, models
  shared/       StatePanelComponent (loading | error | empty), MediaEmbedComponent, dialogs
  features/     one folder per area, mirroring the API
  styles/       _theme.scss — the palette, with its measured contrast ratios
```

### A note on two implementation details

**Dates are stored as UTC `DateTime`, not `DateTimeOffset`.** EF Core's SQLite provider only
translates equality on `DateTimeOffset` — not `<`/`<=` — and the entire timing story depends on those
comparisons running *in the database*. A value converter (`Data/DateTimeOffsetConverters.cs`) keeps
the C# model on `DateTimeOffset` while making every comparison translatable.

**The `XSRF-TOKEN` cookie is written by our own middleware.** ASP.NET Core's antiforgery cookie
carries the *cookie* token, which is a different value from the *request* token that Angular must
echo back in `X-XSRF-TOKEN`. `Common/AntiforgeryMiddleware.cs` publishes the request token as a
separate, non-`httpOnly` cookie so Angular's built-in `withXsrfConfiguration` pairs correctly.
Antiforgery tokens are also bound to the signed-in user, which is why the client calls `/api/me`
straight after login — that call reissues a token valid for the new principal.

That middleware only issues a token when the request can actually carry a `Secure` cookie.
`GetAndStoreTokens` throws rather than degrading when the cookie policy is `Always` and the
request arrived over plain HTTP, which would turn every such request into a 500. Browser traffic
is never affected — the hosting edge sets `X-Forwarded-Proto` and `UseForwardedHeaders` makes the
request look like https. What does arrive over plain HTTP is the platform's health probe, which
needs no CSRF token; without the guard it would 500 and fail the deploy. Unsafe requests lose
nothing: with no token issued they fail validation and get the usual 400.
