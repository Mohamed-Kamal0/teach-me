# Teachers, Lessons and Students

An ASP.NET Core 10 + Angular 18 teaching platform. Teachers publish lessons — a recording, and
optionally a handout, a quiz and its answers — each released on its own schedule. Students join a
teacher's course with a joining code and see only what is open to them, now. A public directory
at `/teachers` lists every approved teacher, the subject they teach and their own course's numbers,
searchable by name or subject, signed in or not.
Anyone signed in can set a profile photo and reset their own password, and a student can ask an
in-app helper — backed by a model that is shown only that student's own data — where to find things.

| Document                          | What it is                                                                       |
| :-------------------------------- | :--------------------------------------------------------------------------------- |
| [`project.md`](docs/project.md)        | the brief, as given, plus an addendum recording what was built beyond it           |
| [`plan.md`](docs/plan.md)              | the design — data model, endpoints, validation, tests, and §12 for the extensions  |
| **[`FEATURES.md`](docs/FEATURES.md)**  | **every feature explained end to end** — the screen, the request, the rule, the failure |
| [`DEPLOY.md`](docs/DEPLOY.md)          | the deployment runbook                                                             |
| [`media.md`](docs/media.md) · [`discover.md`](docs/discover.md) · [`ai.md`](docs/ai.md) | the plan behind each of the three later features |

Everything except this file lives in [`docs/`](docs/); the root stays readable.

---

## What you need

| Tool        | Version used                                 |
| :---------- | :------------------------------------------- |
| .NET SDK    | 10.0.303                                     |
| `dotnet-ef` | 10.0.10 (`dotnet tool install -g dotnet-ef`) |
| Node.js     | 22.14.0                                      |
| npm         | 10.9.2                                       |

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

#### Optionally, a third: the AI helper's key

The helper answers from the asking student's own courses, lessons and marks when a Gemini key is
configured, and from `helper-intents.json` when it is not. **Its absence is not fatal** — unlike the
two above, this secret has an excellent fallback, so the app boots either way and logs which path it
took. Get a key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey):

```bash
# from server/TeachersLessons.Api
dotnet user-secrets set "Ai:ApiKey" "AIza..."
```

Everything else lives in `appsettings.json` under `Ai` — model, token cap, timeout, question-length
cap and the per-student rate limit. See [`ai.md`](docs/ai.md) for why the model is only ever shown data
the student's own screens would already return.

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

| Who                             | Email                                                     |
| :------------------------------ | :-------------------------------------------------------- |
| Administrator                   | `admin@teacherslessons.test` (password: as set in step 1) |
| Teacher — approved              | `teacher.approved@demo.test`                              |
| Teacher — approved (2nd course) | `teacher.second@demo.test`                                |
| Teacher — pending               | `teacher.pending@demo.test`                               |
| Teacher — turned away           | `teacher.rejected@demo.test`                              |
| Student — on two courses        | `student.one@demo.test`                                   |
| Student — on one course         | `student.two@demo.test`                                   |

The seeded lessons have **deliberately staggered moments**: one fully open, one whose quiz opens
tomorrow, one whose answers are already released, and one not open at all. That is what makes the
timing requirement demonstrable without touching the database by hand.

> **On the administrator's password.** `Seed:AdminPassword` is only ever used to *create* the admin
> row — `DbSeeder` never rewrites one that already exists. So the seeded value can stop being a live
> credential: sign in as the administrator, open **Profile** from the account menu, and change it.
> The new password is the one from then on, across restarts and redeploys, and the secret goes back
> to being what it actually is — a bootstrap value, not a standing password.

---

## Deployment

**[DEPLOY.md](docs/DEPLOY.md) is the step-by-step runbook.** What follows is why it is built this way.

Two services, one behind the other:

| Piece          | Host                                 | What it serves                             |
| :------------- | :----------------------------------- | :----------------------------------------- |
| Angular client | Vercel (Hobby, free)                 | the static SPA, plus a rewrite of `/api/*` |
| .NET API       | Fly.io (`fly.toml`, Docker + volume) | everything under `/api`                    |

**Why Fly.** .NET 10 is too new for buildpack hosts, so the API ships as a Docker image. What sets
Fly apart from the free tiers is the **volume**: the SQLite database is a persistent file, so data
survives restarts and redeploys. Every free option has an ephemeral filesystem, which for a SQLite
app means the database resets on every boot. Fly is not free — expect $0.15–$3 a month depending on
traffic. Free alternatives (ngrok tunnel, Render, Cloud Run) are kept and documented in
[DEPLOY.md](docs/DEPLOY.md).

**Why a rewrite and not CORS.** Every API call in the client is a hardcoded relative path —
there is no `environment.ts` and no API base URL. So the SPA has to be served from an origin
that proxies `/api`, which `client/web/vercel.json` does. That also keeps every request
same-origin, which matters because the `tls_auth` cookie is `SameSite=Lax` and a genuine
cross-site XHR would drop it. Replacing the rewrite with CORS breaks login.

**Vercel.** Import the repository, set **Root Directory to `client/web`**, framework Angular.
`vercel.json` pins `outputDirectory` to `dist/web/browser` — Angular 18's `application` builder
puts the browser bundle one level deeper than the preset expects, and getting this wrong serves
a 404 shell. The rewrite `destination` is committed, because a Fly URL is predictable
(`https://<app>.fly.dev`) — keep it in step with `app` in `fly.toml`.

**Fly.** `fly.toml` carries everything except the admin password, which is a Fly secret
(`fly secrets set Seed__AdminPassword=...`). The volume mounts at `/app/data` and must live in the
same region as `primary_region`. Note the **double** underscores in the env vars — that is how .NET
maps a flat environment variable onto a nested config key.

**One machine only.** A Fly volume attaches to a single machine, and SQLite cannot be shared, so two
machines would mean two divergent databases behind one URL. `min_machines_running` is 0 with
`auto_stop_machines`, which keeps the bill near zero; never `fly scale count` above 1.

**`Seed__Demo` must stay unset on Fly.** It drops and re-seeds the database on every start — right
for a host with no disk, actively destructive here. Seeding is instead a one-time step: set the
secret, let it boot, unset it (see [DEPLOY.md](docs/DEPLOY.md)).

**`core/interceptors/ngrok.interceptor.ts`** is a leftover from the tunnel setup documented as an
alternative. It adds a header Fly ignores, so it is harmless; delete it if you want the client
clean.

The API is a single instance by necessity — SQLite cannot be scaled horizontally.

To point the Playwright smoke tests at the deployment instead of localhost:

```powershell
$env:SMOKE_BASE = "https://<app>.vercel.app"
node smoke.mjs
```

---

## Running the tests

```bash
cd server
dotnet test
```

Seventy-one tests across the suites that a click-through cannot give you confidence in:

| Suite                             | What it defends                                                                                                                                           |
| :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — `PendingTeacherTests`     | A pending or turned-away teacher is refused every teacher route; approval takes effect on the **next call**, with no re-login                             |
| **B** — `MarkConstraintTests`     | No second mark for the same student on the same lesson (409); the score bound is read **from the lesson**; `passed` sent by a client is ignored           |
| **C** — `TimingEnforcementTests`  | An unopened quiz has **no `quizUrl` key in the raw JSON** — asserted on the response string, because a missing key and a null key deserialise identically |
| **D** — `OwnershipIsolationTests` | A teacher cannot reach another teacher's lesson (404); a student cannot read a course they never joined (**403**, not an empty list); a student profile shows the calling teacher's marks and lesson count only |
| **E** — `AvatarImageProcessorTests` · `AvatarEndpointTests` | Whatever is uploaded comes back out as a **256×256 WebP produced by our own encoder** — a non-image is a 400 rather than an exception, an implausible declared dimension is refused before the decode, an upload over 5 MB is a **413**, a repeat fetch with `If-None-Match` is a **304**, and deleting a photo returns the initials tile |
| **F** — `PublicDirectoryTests`    | The anonymous directory answers without a session, lists **approved teachers only**, and its raw body carries neither an email nor a join code; a teacher photo is public only while that teacher is approved; `?q=` finds a teacher by **name or subject**, and **a pending teacher's subject matches nothing** |
| **G** — `AiHelperTests`           | The AI helper's context pack **excludes an unopened lesson and carries no URL at all** — asserted on the serialised pack, in suite C's style; one student's pack never mentions another; and every failure path (no key, a model that throws, times out, returns unparseable JSON, invents a route, or is rate-limited) answers **200 with the phrase-list answer**, never a 5xx |

The tests run against **`Microsoft.Data.Sqlite`** in shared-cache in-memory mode, never EF Core's
InMemory provider — that provider ignores unique indexes, so suite B would pass whether or not the
constraint it is testing exists.

Suite G injects a fake at `IAnswerModel`, the one seam between the helper and a model vendor, so no
test in CI spends a cent or needs a network. `AiHelperLiveTests` is the single exception, skipped
unless you ask for it — it exists so a real key is exercised before a demo, not during one. It
reads the key from `Ai:ApiKey` in user-secrets (or `GEMINI_API_KEY` if you'd rather pass it in):

```bash
cd server
HELPER_LIVE=1 dotnet test -l "console;verbosity=detailed"
```

It asserts that the *model* answered, not merely that the endpoint did — every failure path here
degrades to the phrase list with a 200, so a test that only read the response body would pass with
a dead key. `verbosity=detailed` prints the sentence it actually wrote and the tokens it billed.

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
  Domain/       entities and enums, Guid (UUIDv7) keys — including Avatar, the photo row
  Data/         AppDbContext, per-entity configurations, DbSeeder, DemoSeeder
  Features/     Auth · Admin · Teacher · Student · Public · Helper — controller + DTOs + validators
                + services; the Helper folder holds both answer paths and the seam between them
  Common/       CurrentUser, policies, antiforgery, ProblemDetails middleware, VisibleTo projection,
                AvatarImageProcessor, ServiceRegistration (which answer path is wired, decided once)
  Migrations/
  helper-intents.json       the Req 18 phrase list — content, not code, and the helper's floor
  helper-system-prompt.md   the AI helper's instructions — content too, for the same reason
server/TeachersLessons.Api.Tests/    the suites above
client/web/src/app/
  core/         auth service, interceptors, guards, models
  shared/       StatePanelComponent (loading | error | empty), MediaEmbedComponent,
                AvatarComponent, IdentityCardComponent, PasswordCardComponent, BusyRingComponent,
                ReleaseRailComponent, dialogs
  features/     one folder per area, mirroring the API — plus public/ for the directory
  styles/       _theme.scss — the palette, with its measured contrast ratios
docs/           every document except this one — the brief, the plan, the feature walk-through,
                the runbook, and the plan behind each later feature
```

### A note on three implementation details

**Profile photos live in the database, and the bytes served are always ours.** A photo is a row in
`Avatars` keyed by `UserId`, not a file on disk and not an object in a bucket: the deployed API has
exactly one writable volume, and a photo in the database is covered by the same backup, transaction
and delete cascade as the person it belongs to. `Common/AvatarImageProcessor.cs` reads the header
first (`Image.Identify`, so a non-image is a 400 before anything is decoded and an implausible
declared dimension is refused as a decompression bomb), then **re-encodes every accepted upload** to
a 256×256 WebP. The stored `ContentType` is written literally, never copied from the upload. On the
wire no payload ever carries image bytes — every DTO that shows a person carries `photoETag`, a
`string?`, where non-null means "fetch it at `/api/users/{id}/photo`, and this is its version" and
null means "draw the initials tile". That one string is also the cache-buster.


**Dates are stored as UTC `DateTime`, not `DateTimeOffset`.** EF Core's SQLite provider only
translates equality on `DateTimeOffset` — not `<`/`<=` — and the entire timing story depends on those
comparisons running _in the database_. A value converter (`Data/DateTimeOffsetConverters.cs`) keeps
the C# model on `DateTimeOffset` while making every comparison translatable.

**The `XSRF-TOKEN` cookie is written by our own middleware.** ASP.NET Core's antiforgery cookie
carries the _cookie_ token, which is a different value from the _request_ token that Angular must
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
