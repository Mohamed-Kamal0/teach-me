# Build Plan — Teachers, Lessons and Students

> Companion to [`project.md`](project.md). The brief says **what** must work and **how it may fail**; it deliberately leaves **how it is built** undecided. This file is that decision.
>
> **Revised twice, 2026-08-25** — against [`MohamedKamal_plan-review.md`](MohamedKamal_plan-review.md) and then [`MohamedKamal_FINAL-REVIEW.md`](MohamedKamal_FINAL-REVIEW.md). All eleven items are closed; what changed, and the one thing I declined to change, is in **Appendix B**.
>
> **Extended, 2026-08-28.** Three features were built after the twenty-three requirements were
> passing, each with its own plan file, and each folded back into the tables below rather than
> left to drift: **profile photos** ([`media.md`](media.md)), the **public teacher directory and
> the teacher's student profile** ([`discover.md`](discover.md)), and the **AI helper**
> ([`ai.md`](ai.md)). **§12** is the one-page summary of all three; the sections above it are
> the plan of record and have been updated in place. Nothing here was cut to make room —
> every original requirement still holds, and the AI helper keeps the phrase list underneath it.

**Stack:** ASP.NET Core 10 Web API + EF Core (SQLite) · Angular 18 + Angular Material · httpOnly cookie auth · ImageSharp for photos · Google Gemini behind one interface for the helper.

---

## 1. Stack & tooling

| Layer      | Choice                                                                            | Why                                                                                                            |
| :--------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| API        | ASP.NET Core 10 Web API, controller-based                                         | Matches the installed SDK (10.0.303)                                                                           |
| ORM        | EF Core 10 + `Microsoft.EntityFrameworkCore.Sqlite`                               | `dotnet-ef` 10.0.10 already global; no database engine to install on this machine                              |
| Auth       | ASP.NET Core cookie authentication — one encrypted ticket in an `httpOnly` cookie | One login endpoint, role in the ticket (Req 2). The browser never touches a token, so XSS cannot steal one     |
| Hashing    | `Microsoft.AspNetCore.Identity.PasswordHasher<User>` (without full Identity)      | In-framework, no extra dependency, no Identity tables fighting the custom model                                |
| Validation | FluentValidation + RFC 7807 `ProblemDetails`                                      | The cross-field rules of §5 are painful in DataAnnotations                                                     |
| Clock      | `TimeProvider`, injected everywhere — never `DateTime.UtcNow` inline              | The Req 16 demo ("move the date to now") and every timing test need a shiftable clock                          |
| Logging    | `Serilog` → console, one line per request                                         | A 403 you did not expect on the afternoon of day 18 is unaffordable without logs                               |
| Tests      | xUnit + `WebApplicationFactory` + **`Microsoft.Data.Sqlite`** in-memory (§10)     | Four server-side rules cannot be clicked into confidence — and only real SQLite enforces the indexes they test |
| Client     | Angular 18, standalone components + signals                                       | The globally installed CLI is 18.2.21 — no workspace/CLI drift                                                 |
| UI         | Angular Material + CDK, custom educational theme (§8)                             | Tables, dialogs, `mat-error` slots, datepickers, spinners — the least hand-written CSS for Req 23              |
| Images     | `SixLabors.ImageSharp` — every upload re-encoded to a 256×256 WebP (§12.1)        | The bytes served are always ours, so a disguised payload never survives the round trip                        |
| AI         | `Google.GenAI` → `gemini-3.5-flash-lite`, behind one `IAnswerModel` (§12.3)       | One seam means the vendor is swappable, the tests are free, and an unset key is a complete rollback           |

**Local environment (verified):** .NET SDK 10.0.303 · `dotnet-ef` 10.0.10 · Node 22.14.0 · Angular CLI 18.2.21 · **no SQL Server engine** (Client SDK only), which is why SQLite was chosen.

---

## 2. Solution layout

```
The Project/
  README.md                       # clean-clone instructions, §11 — the one file kept at the root
  docs/                           # every other document, so the root of the repo stays readable
    project.md                    # the brief (given)
    plan.md                       # this file
    FEATURES.md                   # every feature end to end, with the code that implements it
    DEPLOY.md                     # the runbook
    media.md / discover.md / ai.md  # the plan behind each of the three later features
  TeachersLessons.sln
  server/TeachersLessons.Api/
    Program.cs
    Domain/                       # entities + enums (UserRole, TeacherStatus), Guid keys, no EF attributes
    Data/                         # AppDbContext, IEntityTypeConfiguration<T>, DbSeeder, DemoSeeder
    Features/
      Auth/  Admin/  Teacher/  Student/  Public/  Helper/
                                  # controller + DTOs + validators + services, one folder per area
        Auth/Controllers/PhotoController.cs      # §12.1 — upload, delete, serve, public serve
        Helper/Services/                         # §12.3 — HelperService (phrase list),
                                  #   AiHelperService (the decorator over it), IAnswerModel,
                                  #   GeminiAnswerModel, StudentContextPackBuilder,
                                  #   HelperRateLimiter, HelperSystemPromptProvider
    Common/                       # CurrentUser, cookie + antiforgery setup, ApiExceptionMiddleware,
                                  # policies, PagedResult<T>, LessonQueries.VisibleTo,
                                  # AvatarImageProcessor, ServiceRegistration
    Migrations/
    helper-intents.json           # Req 18 phrase list — content, not code, and the helper's floor
    helper-system-prompt.md       # §12.3 the AI helper's instructions — content too
  server/TeachersLessons.Api.Tests/   # the rule suites, §10
  client/web/                     # ng new web --standalone --routing --style=scss
    proxy.conf.json               # /api -> the API, so the cookie is same-origin in dev
    smoke.mjs / smoke-api-down.mjs  # Playwright: the demo script, and the API killed underneath it
    src/styles/_theme.scss        # the educational theme, §8
    src/app/core/                 # auth service, credentials + error interceptors, guards, api clients
    src/app/shared/               # StatePanelComponent (loading | error | empty), MediaEmbedComponent,
                                  # AvatarComponent, PhotoCardComponent, ReleaseRailComponent, dialogs
    src/app/features/             # home, teachers (public directory), auth, admin, teacher,
                                  # student, helper
```

**Feature folders, not layered Clean Architecture.** Four days, one developer: a `Domain / Application / Infrastructure / Api` split buys indirection this scope never spends.

---

## 3. Data model — seven tables

The brief's closing line is the design driver:

> _"One email belongs to one person across all three, the administrator's own address included, and no single table can promise that."_

So **one `Users` table owns identity and the unique email**, and role-specific data hangs off it 1:1. Three separate teacher/student/admin tables could never enforce that constraint. **The administrator is a seeded row in `Users`, not a config-only account** — that is what lets the unique index cover "the administrator's own address included" rather than leaving one identity outside the guarantee.

**Every primary key is a `Guid`**, generated with **`Guid.CreateVersion7()`** (.NET 9+). The one-sentence defence: _ids appear in URLs like `/api/student/courses/{teacherId}/lessons`, and sequential integers would let any student walk `1, 2, 3…` to enumerate teachers and probe courses they never joined, so the id itself should carry no information._ UUIDv7 is time-ordered, so inserts stay at the end of the index instead of scattering — the usual cost of GUID keys, avoided.

### `Users` — one person who can sign in

| Column         | Type             | Notes                                                                                                            |
| :------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------- |
| `Id`           | `Guid`           | PK, UUIDv7                                                                                                       |
| `Email`        | `string` (256)   | **unique index**; normalised to lowercase on write                                                               |
| `PasswordHash` | `string` (256)   | `PasswordHasher<User>` output; never leaves the server                                                           |
| `FullName`     | `string` (120)   |                                                                                                                  |
| `Role`         | `UserRole` enum  | `Admin` · `Teacher` · `Student`; **stored as text** via `HasConversion<string>()` so the database stays readable |
| `CreatedAtUtc` | `DateTimeOffset` |                                                                                                                  |

### `Teachers` — a teacher's standing

| Column            | Type                 | Notes                                                                   |
| :---------------- | :------------------- | :---------------------------------------------------------------------- |
| `UserId`          | `Guid`               | **PK = FK to `Users.Id`**, 1:1 — no separate identity                   |
| `JoinCode`        | `string` (8)         | **unique index**; Crockford base32                                      |
| `Status`          | `TeacherStatus` enum | `Pending` · `Approved` · `Rejected`, stored as text                     |
| `DecidedAtUtc`    | `DateTimeOffset?`    | null until the administrator decides — what makes "decided twice" a 409 |
| `DecidedByUserId` | `Guid?`              | FK to `Users.Id`, **`Restrict`**                                        |

The enum **plus** `DecidedAtUtc` is deliberate: a pair of nullable dates could represent "approved and rejected at once", and this cannot.

### `Students` — a student's profile

| Column        | Type            | Notes                          |
| :------------ | :-------------- | :----------------------------- |
| `UserId`      | `Guid`          | **PK = FK to `Users.Id`**, 1:1 |
| `DisplayName` | `string?` (120) | editable by the student        |
| `Phone`       | `string?` (30)  | editable                       |
| `Bio`         | `string?` (500) | editable                       |

Email, full name, and role are **not** here — they live on `Users` and are not editable, which is exactly Req 6's _"what they may not change is not on the form — and the server refuses it anyway."_

### `Enrollments` — one student on one course

| Column            | Type              | Notes                                                    |
| :---------------- | :---------------- | :------------------------------------------------------- |
| `Id`              | `Guid`            | PK, UUIDv7                                               |
| `StudentUserId`   | `Guid`            | FK → `Students.UserId`                                   |
| `TeacherUserId`   | `Guid`            | FK → `Teachers.UserId`                                   |
| `JoinedAtUtc`     | `DateTimeOffset`  |                                                          |
| `LastViewedAtUtc` | `DateTimeOffset?` | null = never opened → Req 17 says "welcome", not a count |

**Unique (`StudentUserId`, `TeacherUserId`)** — this index is what turns "the same code twice" into a 409 rather than a duplicate row.

### `Lessons` — one lesson of one teacher

| Column             | Type              | Notes                                                        |
| :----------------- | :---------------- | :----------------------------------------------------------- |
| `Id`               | `Guid`            | PK, UUIDv7                                                   |
| `TeacherUserId`    | `Guid`            | FK → `Teachers.UserId`; the scope of every teacher query     |
| `Title`            | `string` (200)    | required, non-empty after trim                               |
| `OrderIndex`       | `int`             | where it sits in the order                                   |
| `RecordingUrl`     | `string` (2048)   | required — a link, never a file (the brief's first "is not") |
| `HandoutUrl`       | `string?` (2048)  | optional                                                     |
| `QuizUrl`          | `string?` (2048)  | optional — its absence is what makes rule L9 of §5 fire      |
| `AnswersUrl`       | `string?` (2048)  | optional                                                     |
| `DurationMinutes`  | `int`             |                                                              |
| `QuizMaxScore`     | `int`             | > 0; the bound Req 22 checks a mark against                  |
| `PassMark`         | `int`             | ≤ `QuizMaxScore`                                             |
| `OpensAtUtc`       | `DateTimeOffset?` | null = draft, invisible to students                          |
| `QuizOpensAtUtc`   | `DateTimeOffset?` |                                                              |
| `AnswersOpenAtUtc` | `DateTimeOffset?` |                                                              |

**Unique (`TeacherUserId`, `OrderIndex`)** — "a place another lesson holds" becomes a 400 from a constraint, scoped per teacher so two teachers can both have a lesson 1.

**The index makes renumbering impossible one row at a time, and that is a real problem.** Inserting a lesson between 2 and 3 means pushing 3, 4, 5 down, and SQLite checks a unique index **per statement**, not at commit — so every intermediate state violates it and each individual `UPDATE` fails, transaction or not. Two ways out, and the choice matters:

- **Drop the index, treat `OrderIndex` as a sort hint.** Rejected: Req 8 explicitly requires that "a place another lesson holds" is a **400**, and a hint cannot promise that.
- **Keep the index, add one reorder endpoint** (`PUT /api/teacher/lessons/order`) that rewrites the whole block in a single transaction using a **two-phase renumber**: first move every affected lesson to a scratch range (`OrderIndex = -(newIndex)`, guaranteed not to collide with any positive value), then flip the whole block positive. Two passes, one transaction, no intermediate collision. **This is the choice.**

Single create and edit keep rule **L3** and its 400. Reordering is a different operation with a different endpoint, which is also the honest model of it: moving one lesson _is_ a change to several.

### `Marks` — one student's score on one lesson

| Column          | Type              | Notes                                                                  |
| :-------------- | :---------------- | :--------------------------------------------------------------------- |
| `Id`            | `Guid`            | PK, UUIDv7                                                             |
| `LessonId`      | `Guid`            | FK → `Lessons.Id`, **`Restrict`**                                      |
| `StudentUserId` | `Guid`            | FK → `Students.UserId`, `Cascade`                                      |
| `Score`         | `int`             | `0 .. Lesson.QuizMaxScore`, checked server-side against the lesson row |
| `RecordedAtUtc` | `DateTimeOffset`  |                                                                        |
| `UpdatedAtUtc`  | `DateTimeOffset?` | set when a teacher corrects a mark                                     |

**Unique (`LessonId`, `StudentUserId`)** — Req 22's "no second mark for the same student on the same lesson", enforced by the database. Passed/failed is **never stored**: it is derived at read time from `Score >= Lesson.PassMark`, which is structurally why the browser can never send it up.

### `Avatars` — one person's profile photo (§12.1)

Added 2026-08-28. The seventh table, and the only one that holds bytes.

| Column         | Type             | Notes                                                                     |
| :------------- | :--------------- | :------------------------------------------------------------------------ |
| `UserId`       | `Guid`           | **PK = FK to `Users.Id`**, 1:0..1 — the row's existence *is* "has a photo" |
| `Bytes`        | `byte[]`         | always WebP, always 256×256, **always produced by our own encoder**       |
| `ContentType`  | `string`         | always `image/webp` — stored, not trusted from the upload                 |
| `ByteSize`     | `int`            | capped at 200 KB by the processor                                         |
| `ETag`         | `string`         | `"<md5 hex>"`, rewritten on every write — what makes 304s and cache-busting work |
| `UpdatedAtUtc` | `DateTimeOffset` |                                                                           |

**A separate table, not a column on `Users`.** A `byte[]` column on `Users` would be loaded by
every query that touches a user — the login path, the admin list, every join — and EF Core cannot
be told to skip it without a projection on every one of them. As its own table it is read only
when someone asks for a photo, and `null` costs nothing.

**The row's existence is the flag, and `ETag` is what the client is told.** No DTO carries image
bytes: every payload that shows a person carries `photoETag`, a `string?`. Non-null means "there
is a photo, fetch it at `/api/users/{id}/photo`, and this string is its version"; null means "draw
the initials tile". One nullable string is the whole contract, and it doubles as the cache-buster
— a new photo is a new ETag is a new URL.

### Relationships and delete behavior

- `Users` → `Teachers` / `Students` : **Cascade** — a profile cannot outlive its login.
- `Teachers` → `Lessons`, `Enrollments` : **Cascade**.
- `Students` → `Enrollments`, `Marks` : **Cascade**.
- `Lessons` → `Marks` : **Restrict** — this turns Req 8's _"refused if marks exist"_ into a database guarantee rather than a controller convention. The API translates it into a **409**.
- `Teachers.DecidedByUserId` : **Restrict** — an audit trail should not evaporate.
- `Users` → `Avatars` : **Cascade** — a photo cannot outlive the person, and deleting the row is how "remove my photo" is implemented.

**One consequence to know about:** `Teachers → Lessons` cascades but `Lessons → Marks` restricts, so deleting a teacher whose lessons carry marks **fails at the database**. That is the right default for a teaching record, and no endpoint deletes a teacher — but it will surprise you from a SQLite browser.

### Decisions that follow from the model

- **Timestamps are `DateTimeOffset`, stored UTC.** EF stores them as ISO-8601 text on SQLite, which sorts correctly; every comparison happens in UTC on the server.
- **Scores are `int`, not `decimal`.** EF Core's SQLite provider maps `decimal` to `TEXT` and warns that comparison and ordering are unreliable — and this model compares scores constantly. If half marks are ever needed, store tenths as `int` rather than reaching for `decimal`.
- **Guids reach the routes.** Every id parameter is constrained — `[HttpGet("{id:guid}")]` — so malformed input returns **404** from routing instead of a binding **400** or a crash. Req 13 asks for a "not found" screen; the constraint guarantees one for garbage as well as for a well-formed id that does not exist.
- **Join codes** are 8-character Crockford base32, generated on teacher registration, retried on collision, unique-indexed.

---

## 4. Endpoint table

The caller is always resolved from the **auth cookie**, never from the URL. Every authenticated route answers **401** when signed out — omitted below to keep the table readable. Every non-`GET` route additionally answers **400** without a valid `X-XSRF-TOKEN` header.

| Method + route                                      | Who may call it    | Success                                                           | Failures                                                                    |
| :-------------------------------------------------- | :----------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `POST /api/auth/register/teacher`                   | anyone             | 201                                                               | 400 email in use (**any** role), 400 validation                             |
| `POST /api/auth/register/student`                   | anyone             | 201                                                               | 400 email in use (**any** role), 400 validation                             |
| `POST /api/auth/login`                              | anyone             | 200 `{role, teacherStatus?}` + `Set-Cookie` (nothing in the body) | 401 _"Email or password is incorrect"_ (never which half), 400 validation   |
| `POST /api/auth/logout`                             | any signed-in      | 204 + cookie cleared                                              | —                                                                           |
| `GET /api/public/home`                              | anyone, no cookie  | 200 `{approvedTeacherCount, lessonCount, howToJoin}`              | — must read `0` on an empty database                                        |
| `GET /api/public/teachers?page=&pageSize=&q=`       | anyone, no cookie  | 200 paged `PublicTeacherDto` — **approved only**, open lessons desc then name | — legitimately empty (§12.2)                                    |
| `GET /api/public/teachers/{userId}/photo`           | anyone, no cookie  | 200 `image/webp` + `ETag`, `public, max-age=300` · 304 on `If-None-Match` | **404** for no photo **and** for a teacher who is not approved — identically (§12.2) |
| `GET /api/health`                                   | anyone, no cookie  | 200 `{status, db}`                                                | 503 if the database is unreachable                                          |
| `GET /api/me`                                       | any signed-in      | 200 identity + standing + `photoETag`                             | —                                                                           |
| `PUT /api/me/password`                              | any signed-in      | 204 — nothing echoed back, session undisturbed                    | 400 wrong current password (named on `currentPassword`), 400 policy, 400 reuse (§12.4) |
| `PUT /api/me/photo` (multipart `file`)              | any signed-in      | 200 `{photoETag, updatedAtUtc}` — re-encoded to 256×256 WebP      | 400 not an image / undecodable / wrong content type, **413 over 5 MB** (§12.1) |
| `DELETE /api/me/photo`                              | any signed-in      | 204 — idempotent; 204 even when there was none                    | —                                                                           |
| `GET /api/users/{userId}/photo`                     | any signed-in      | 200 `image/webp` + `ETag`, `private, max-age=300` · 304           | 404 no photo                                                                |
| `GET /api/admin/teachers?status=`                   | Admin              | 200 paged                                                         | 403                                                                         |
| `POST /api/admin/teachers/{id}/approve`             | Admin              | 204                                                               | 403, 404, **409 already decided**                                           |
| `POST /api/admin/teachers/{id}/reject`              | Admin              | 204                                                               | 403, 404, **409 already decided**                                           |
| `GET /api/teacher/lessons`                          | Teacher · Approved | 200 paged, `OrderIndex` asc                                       | 403 pending / turned away                                                   |
| `POST /api/teacher/lessons`                         | Teacher · Approved | 201                                                               | 400 (§5), 403                                                               |
| `GET` `PUT /api/teacher/lessons/{id}`               | Teacher · Approved | 200                                                               | 400 (§5), **404 if not theirs**, 403                                        |
| `PUT /api/teacher/lessons/order`                    | Teacher · Approved | 204 — two-phase renumber in one transaction (§3)                  | 400 (§5 R1–R2), 403                                                         |
| `DELETE /api/teacher/lessons/{id}`                  | Teacher · Approved | 204                                                               | **409 marks exist**, 404, 403                                               |
| `GET /api/teacher/students`                         | Teacher · Approved | 200 `{joinCode, students[]}` paged, name asc                      | 403                                                                         |
| `GET /api/teacher/students/{studentId}`             | Teacher · Approved | 200 **a student profile** — details, `photoETag`, counts, then marks in lesson order (§12.2) | **404** unknown or not theirs, 403                    |
| `POST /api/teacher/marks`                           | Teacher · Approved | 201                                                               | 400 score out of range, **409 duplicate**, 404 not your student/lesson, 403 |
| `PUT /api/teacher/marks/{id}`                       | Teacher · Approved | 200                                                               | 400, 404, 403                                                               |
| `GET /api/teacher/progress`                         | Teacher · Approved | 200 paged (reads `0`, never spins)                                | 403                                                                         |
| `GET` `PUT /api/student/profile`                    | Student            | 200                                                               | 400 — the server re-refuses locked fields, 403                              |
| `POST /api/student/enrollments` `{code}`            | Student            | 201                                                               | 400 unknown code / teacher not approved, **409 already on this course**     |
| `GET /api/student/courses`                          | Student            | 200 (legitimately empty)                                          | 403                                                                         |
| `GET /api/student/courses/{teacherId}/lessons`      | Student · Enrolled | 200 paged — open lessons only                                     | **403 not on this course**, 404 no such teacher                             |
| `GET /api/student/courses/{teacherId}/lessons/{id}` | Student · Enrolled | 200                                                               | 403 not enrolled, **404 not open yet**                                      |
| `POST /api/student/courses/{teacherId}/seen`        | Student · Enrolled | 204 — stamps `LastViewedAtUtc`                                    | 403                                                                         |
| `GET /api/student/whats-new`                        | Student            | 200 per-course + total                                            | 403                                                                         |
| `GET /api/student/marks`                            | Student            | 200 own marks only                                                | 403                                                                         |
| `GET /api/helper/ask?q=`                            | Student            | 200 `{answer, route?}` or `{unknown, knownTopics[]}`              | 403 · 400 empty or over `Ai:MaxQuestionLength` · **never 5xx, never 429** (§12.3) |

### Status-code convention — one rule, applied everywhere

Stated once so it reads as a rule rather than per-route drift:

| Code    | Means                                                                | Used for                                                                              |
| :------ | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **400** | the request itself is malformed or breaks a field/cross-field rule   | every rule in §5                                                                      |
| **401** | no valid cookie                                                      | every authenticated route, signed out                                                 |
| **403** | authenticated, but not entitled to **this whole area**               | pending/rejected teacher; a student on a course they never joined; wrong role         |
| **404** | the resource exists but is **not yours**, or its moment has not come | another teacher's lesson, an unknown student id, an unopened lesson, a malformed guid |
| **409** | the request is well-formed but conflicts with **current state**      | already decided · already enrolled · already marked · lesson has marks                |

**403 never returns an empty list.** Req 21 is explicit: an empty list tells someone never entitled to ask that the course is empty. **404 rather than 403 for another teacher's resource** so the API never confirms that id exists.

### List conventions — one rule, applied everywhere

Every list endpoint takes `?page=1&pageSize=20`, returns `PagedResult<T> { items, page, pageSize, total }`, caps `pageSize` at **100**, and has a **stated default order** (named in the table above). Demo data never reaches page two — the point is that the habit is in the code, not that the pagination is exercised.

### Error shape

RFC 7807 `ProblemDetails` with an `errors` dictionary keyed by field name, so Angular drops each message into the right `mat-error` generically — that is what makes Req 12's _"the reason lands next to the field that caused it"_ fall out on every form without per-form code.

```json
{
  "type": "https://httpstatuses.io/400",
  "title": "One or more fields need attention.",
  "status": 400,
  "errors": {
    "passMark": ["The pass mark can't be higher than the quiz maximum (20)."]
  }
}
```

### How the session is carried

One cookie, `tls_auth`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **8 hours with `SlidingExpiration`**. It satisfies Req 2's _"the session survives a refresh; the token rides every call"_ by construction, and because it is `httpOnly` no script — including an injected one — can read it.

Four consequences in `Program.cs`:

1. **401/403 instead of redirects.** `AddCookie` defaults to `302 → /Account/Login`, wrong for an API and fatal to Req 2. Override both events to write status codes only:

   ```csharp
   options.Events.OnRedirectToLogin        = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
   options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
   ```

2. **CORS must allow credentials.** `AllowCredentials()` with the Angular origin named explicitly — it cannot be combined with `AllowAnyOrigin()`. The dev server also proxies `/api` (`proxy.conf.json`), making every call same-origin so CORS and `SameSite` stop mattering in development.
3. **CSRF protection.** A cookie rides every call _including one a foreign page triggers_, which a bearer header does not. Double-submit: a non-`httpOnly` `XSRF-TOKEN` cookie, Angular's built-in `provideHttpClient(withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }))`, and `IAntiforgery` validating the pair on every non-`GET` via a global filter. `login`, `register/*`, `public/home`, and `health` are exempt. This is ~15 lines and it is the price of choosing cookies at all (see Appendix B).
4. **Claims are identity, never standing.** The ticket carries `sub`, `email`, `role` — but **not** the teacher's approved/pending/rejected status, which changes while a session is live. The `TeacherApproved` policy handler reads `Teachers.Status` per call, so an administrator's approval takes effect on the teacher's very next request, not their next sign-in.

On the client: a `credentialsInterceptor` sets `withCredentials: true` on every request; `AuthService` cannot decode a cookie, so an `APP_INITIALIZER` calls `GET /api/me` once at bootstrap and stores `{ role, teacherStatus }` in a signal — that single call is what makes the session survive a refresh. Sign-out is a **server** call; clearing client state alone leaves a valid cookie in the browser.

**Postman:** enable the cookie jar, `POST /api/auth/login` once, and every later request in that collection carries the cookie. Non-`GET` calls need `X-XSRF-TOKEN` copied from the `XSRF-TOKEN` cookie; the checks that prove Req 19 are all `GET`s.

---

## 5. Validation rules — every field, and the message a human reads

The brief requires _"every validation rule and the message a human reads"_. Three rules govern the whole table:

- **Client and server run the same rules.** The client's job is to catch it early and keep submit disabled while invalid (Req 12); the server's job is to catch it regardless. Nothing is client-only except password _confirmation_, which the server never receives.
- **Strings are trimmed before validation**, so `"   "` is empty, not valid.
- **Messages address the person, not the schema.** "A lesson needs a title", never "Title is required (max 200)".

### Registration — teacher and student (Reqs 1, 4)

| Field             | Rule                                                                       | Message                                                  |
| :---------------- | :------------------------------------------------------------------------- | :------------------------------------------------------- |
| `fullName`        | required, 2–120 chars                                                      | "Enter your full name."                                  |
| `email`           | required, valid address, ≤256                                              | "Enter a valid email address."                           |
| `email`           | **not in use by anybody — teacher, student, or the administrator** → `400` | "That email is already registered. Sign in instead?"     |
| `password`        | required, ≥8 chars, at least one letter and one digit                      | "Use at least 8 characters, with a letter and a number." |
| `confirmPassword` | must match `password` — **client only, caught before the server**          | "Those passwords don't match."                           |

The uniqueness check runs as a query **and** is backed by the unique index, so two simultaneous registrations cannot both win; the index violation is caught and returned as the same 400.

### Sign in (Req 2)

| Field      | Rule                    | Message                                                           |
| :--------- | :---------------------- | :---------------------------------------------------------------- |
| `email`    | required, valid address | "Enter a valid email address."                                    |
| `password` | required                | "Enter your password."                                            |
| both       | wrong pair → `401`      | **"Email or password is incorrect."** — never which half is wrong |

The single message is deliberate: saying "no account with that email" tells a stranger which addresses are registered.

### Resetting your own password (§12.4)

| Field             | Rule                                                              | Message                                                  |
| :---------------- | :---------------------------------------------------------------- | :------------------------------------------------------- |
| `currentPassword` | required                                                          | "Enter your current password."                           |
| `currentPassword` | must verify against the stored hash → `400` on `currentPassword`  | "That isn't your current password."                      |
| `newPassword`     | **the same rule registration uses**, from the same code           | "Use at least 8 characters, with a letter and a number." |
| `newPassword`     | must not verify against the current hash → `400` on `newPassword` | "Choose a password you aren't already using."            |
| `confirmPassword` | must match `newPassword` — **client only, never sent**            | "Those passwords don't match."                           |

Two deliberate differences from sign-in:

- **The message is specific here, and vague there.** Sign-in must not reveal whether an address is registered, so both halves get one message. This endpoint is behind a session the caller already holds — telling them "that isn't your current password" reveals nothing they could not confirm by signing out and back in — so the message goes under the box it belongs to and says which of the three fields is wrong.
- **The policy is not restated, it is reused.** `ChangePasswordRequestValidator` calls the same `RegistrationRules.Password()` extension `RegisterStudentRequestValidator` calls. There is one password policy in the solution and one string stating it, so the screen that first sets a password and the screen that resets it cannot drift apart.

**What is deliberately not here.** "Is the current password right" is not a validator rule. A validator answers questions about the *shape* of a request; that question is answered against the stored hash, in `AccountService`, which is the only place allowed to touch it.

### Joining a course (Req 5)

| Field  | Rule                                                   | Code  | Message                                                 |
| :----- | :----------------------------------------------------- | :---- | :------------------------------------------------------ |
| `code` | required, exactly 8 chars, Crockford base32 alphabet   | `400` | "A joining code is 8 characters — check and try again." |
| `code` | uppercased and normalised (`O`→`0`, `I`/`L`→`1`) first | —     | silent, so a hand-copied code still works               |
| `code` | must match a teacher                                   | `400` | "No course found for that code."                        |
| `code` | that teacher must be **approved**                      | `400` | "That teacher isn't taking students yet."               |
| `code` | not already enrolled                                   | `409` | "You're already on this course."                        |

### Student profile (Req 6)

| Field                     | Rule                                                | Message                                    |
| :------------------------ | :-------------------------------------------------- | :----------------------------------------- |
| `displayName`             | optional, ≤120                                      | "Display name is too long."                |
| `phone`                   | optional, ≤30, digits/space/`+`/`-`/`(`/`)` only    | "Enter a phone number, or leave it blank." |
| `bio`                     | optional, ≤500                                      | "Keep your bio under 500 characters."      |
| `email` `fullName` `role` | **not on the form**, and rejected if posted → `400` | "Your email can't be changed here."        |

### Lesson create and edit (Reqs 8, 9)

| Id      | Rule                                                                          | Code  | Message                                                             |
| :------ | :---------------------------------------------------------------------------- | :---- | :------------------------------------------------------------------ |
| **L1**  | `title` required, non-empty after trim, ≤200                                  | `400` | "A lesson needs a title."                                           |
| **L2**  | `orderIndex` required, ≥ 1                                                    | `400` | "Position must be 1 or higher."                                     |
| **L3**  | `orderIndex` not already taken **by this teacher**                            | `400` | "Lesson 3 already sits in that position — pick another."            |
| **L4**  | `recordingUrl` required, absolute `http`/`https`, ≤2048                       | `400` | "Paste the link to the recording."                                  |
| **L5**  | `handoutUrl` `quizUrl` `answersUrl` — when present, same URL rule             | `400` | "That doesn't look like a web address."                             |
| **L6**  | `durationMinutes` required, 1–600                                             | `400` | "Length must be between 1 and 600 minutes."                         |
| **L7**  | `quizMaxScore` required, **> 0**                                              | `400` | "The quiz must be marked out of more than zero."                    |
| **L8**  | `passMark` required, `0 ≤ passMark ≤ quizMaxScore`                            | `400` | "The pass mark can't be higher than the quiz maximum (20)."         |
| **L9**  | `quizOpensAtUtc` set but **no `quizUrl`**                                     | `400` | "This lesson has no quiz, so it can't have a quiz opening time."    |
| **L10** | `answersOpenAtUtc` set but **no `answersUrl`**                                | `400` | "This lesson has no answer sheet, so it can't have a release time." |
| **L11** | `quizOpensAtUtc` set while `opensAtUtc` is null, **or earlier than it**       | `400` | "The quiz can't open before the lesson does."                       |
| **L12** | `answersOpenAtUtc` set while `quizOpensAtUtc` is null, **or earlier than it** | `400` | "The answers can't be released before the quiz opens."              |
| **L13** | delete while marks exist                                                      | `409` | "This lesson has marks recorded, so it can't be deleted."           |

L9–L10 are the brief's _"a moment set on something that is not there"_. L11–L12 name **which pair** is wrong, as it demands. All six moment rules run in this order, so a lesson with no quiz and two bad dates reports the cause, not the symptom.

### Reordering lessons (Req 8, "where it sits in the order")

`PUT /api/teacher/lessons/order` takes the full ordered list of lesson ids, so the request describes the destination rather than a diff:

| Id     | Rule                                                                                   | Code  | Message                                                        |
| :----- | :------------------------------------------------------------------------------------- | :---- | :------------------------------------------------------------- |
| **R1** | the id set must be **exactly** the calling teacher's lessons — no extras, none missing | `400` | "That list doesn't match your lessons — reload and try again." |
| **R2** | no duplicate ids                                                                       | `400` | same                                                           |

R1 doubles as the ownership check: a foreign lesson id makes the set wrong, so there is no separate 404 path and no way to probe another teacher's ids. The screen sends the list after an up/down move, and positions are rewritten `1..n` — so gaps left by deletion quietly heal instead of accumulating.

### Recording a mark (Reqs 12, 22)

| Id     | Rule                                                          | Code  | Message                                                                   |
| :----- | :------------------------------------------------------------ | :---- | :------------------------------------------------------------------------ |
| **M1** | `lessonId` must belong to **the calling teacher**             | `404` | not-found screen — never "that isn't your lesson"                         |
| **M2** | `studentUserId` must be **enrolled with the calling teacher** | `404` | not-found; the picker only ever lists their own students                  |
| **M3** | `score` required, integer, `0 ≤ score ≤ lesson.QuizMaxScore`  | `400` | "Score must be between 0 and 20." — **the bound is read from the lesson** |
| **M4** | no existing mark for this (`lessonId`, `studentUserId`)       | `409` | "This student already has a mark for this lesson — edit that one."        |
| **M5** | `passed` is **never accepted from the client**                | —     | ignored entirely; derived from `score >= lesson.passMark`                 |

M3's message interpolates the lesson's own maximum, which is what proves _"the bound coming from the lesson, not your code"_.

### Administrator decisions (Req 3)

| Rule                        | Code  | Message                                                   |
| :-------------------------- | :---- | :-------------------------------------------------------- |
| teacher exists              | `404` | not-found screen                                          |
| `Status` is still `Pending` | `409` | "This teacher was already approved on 24 Aug 2026."       |
| caller is the administrator | `403` | those screens are unreachable, and the server refuses too |

---

## 6. Time enforcement and isolation (Reqs 19, 20, 21)

Built in one place each, never scattered through controllers:

- **`LessonQueries.VisibleTo(studentId, teacherId, now)`** — a single `IQueryable` extension that filters `OpensAtUtc != null && OpensAtUtc <= now`, and **projects to a DTO whose `QuizUrl` is `null` unless `QuizOpensAtUtc <= now`** and whose `AnswersUrl` is `null` unless `AnswersOpenAtUtc <= now`. Because it is a _projection_, an unopened quiz is **absent from the JSON** — not sent-and-hidden, not sent-and-disabled. Every student-facing lesson read goes through it. One-sentence defence: _withholding by not selecting is the only version of this that a raw response can prove._
- **`CurrentUser.UserId`**, read from the cookie's claims principal, is the only source of who is asking. Teacher queries always begin `.Where(x => x.TeacherUserId == CurrentUser.UserId)`; a route id only ever narrows an already-scoped set.
- **`EnrolledInCourse` authorization handler** runs before every student course endpoint and returns **403** — not an empty result — when no `Enrollment` row matches.

---

## 7. What's new (Req 17)

Per **enrollment**, comparing the three moments against that row's own `LastViewedAtUtc`:

- `LastViewedAtUtc == null` → **"Welcome"**, never a count.
- Otherwise, list the lessons whose `OpensAtUtc`, `QuizOpensAtUtc`, or `AnswersOpenAtUtc` falls in `(LastViewedAtUtc, now]` — named, and attributed to their teacher. Totalled across courses on the student's landing screen.
- `POST /api/student/courses/{teacherId}/seen` stamps **only that enrollment**, so opening one course cannot silence another. Opening the same one twice yields nothing new.

---

## 8. Screens, routes, and the educational theme

### Routes

| Area     | Routes                                                                                                                                                                                       |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public   | `/` · **`/teachers`** (the directory, §12.2 — no guard) · `/login` · `/register/teacher` · `/register/student`                                                                              |
| Admin    | `/admin/approvals` · **`/admin/profile`** (photo + password, §12.4 — the screen that lets the seeded `Seed:AdminPassword` stop being a live credential) |
| Teacher  | `/teacher/standing` · `/teacher/lessons` · `/teacher/lessons/new` · `/teacher/lessons/:id/edit` · `/teacher/students` · `/teacher/students/:studentId` · `/teacher/marks/new` · `/teacher/progress` · **`/teacher/profile`** (photo §12.1 + password §12.4 — role guard only, so a pending teacher can still do both) |
| Student  | `/student/profile` · `/student/join` · `/student/courses` · `/student/courses/:teacherId` · `/student/whats-new` · `/student/marks`                                                          |
| Fallback | `/server-down` · `/not-found` · `**` → not-found screen (Req 13 lands here, not on a crash)                                                                                                  |

**Guards:** `authGuard`, `roleGuard('Admin' | 'Teacher' | 'Student')`, `teacherApprovedGuard` (redirects to `/teacher/standing`). All three read the `AuthService` signal populated by the `/api/me` bootstrap, never a decoded token.

### The theme — a classroom, not a dashboard

The subject is teaching, and the interface should read that way: calm, bookish, legible at the back of a room. The look is defined once in `src/styles/_theme.scss` as an Angular Material M3 theme, and nothing overrides it component by component.

**Palette** — one academic base, one warm accent, and semantic colours that always pair with an icon and a word, never colour alone. Every ratio below is measured against `surface` `#FAF8F4`, and the "text?" column is the rule, not an aspiration — AA needs **4.5:1** for body text:

| Token           | Colour                   | On `surface` | Text?         | Used for                                                      |
| :-------------- | :----------------------- | :----------- | :------------ | :------------------------------------------------------------ |
| `surface`       | warm off-white `#FAF8F4` | —            | —             | page background — paper, not screen-grey                      |
| `primary`       | deep indigo `#31456A`    | **9.0:1**    | yes           | app bar, primary actions, links — ink on paper                |
| `danger`        | brick `#9B3226`          | **6.9:1**    | yes           | failed · refused · turned away                                |
| `success`       | moss `#2E6B4F`           | **5.9:1**    | yes           | passed · lesson open                                          |
| `muted`         | slate `#6B7280`          | **4.6:1**    | yes, just     | drafts, empty states, "nothing here yet"                      |
| `warning-text`  | dark amber `#7A4E10`     | **6.8:1**    | yes           | pending approval · quiz not open yet — **the word**           |
| `tertiary-text` | dark amber `#8A5A12`     | **5.6:1**    | yes           | _what's new_ counts, the joining code — **the word**          |
| `tertiary`      | warm amber `#C9852A`     | 2.9:1        | **fill only** | badge and rule fills, with `ink #1F2937` on top (**4.8:1** ✓) |
| `warning`       | amber `#B4741A`          | 3.6:1        | **fill only** | chips and borders, never a sentence                           |

**The two bright ambers are fills, never text on paper.** They were the accent colour and they failed the AA claim outright at 2.9:1 and 3.6:1 — so they keep the job they are good at (a badge that catches the eye) and hand the words to the darkened pair. `_theme.scss` names them apart so the mistake cannot be made by accident, and the ratios above get re-checked in a browser during the Day 18 theme slot, because a stated accessibility claim is checkable in ten seconds by anyone who doubts it.

**Typography** — a serif for headings and a sans for everything else, the schoolbook pairing:

- Headings: **Lora** (Google Fonts), 600 — titles, course names, lesson names.
- Body, tables, forms: **Inter**, 400/500 — sizes never below 14px; tables at 15px.
- Numbers in marks and progress: tabular figures (`font-variant-numeric: tabular-nums`) so columns line up.

**Vocabulary.** The brief's own words, everywhere, in both UI and code: _course · lesson · recording · handout · quiz · answers · mark · pass mark · joining code · teacher · student_. No "module", "item", "entity", "resource", "record".

**Iconography** — Material Symbols, one per concept and never a second: `school` (course) · `menu_book` (lesson) · `play_circle` (recording) · `description` (handout) · `quiz` (quiz) · `fact_check` (answers) · `grade` (mark) · `lock_clock` (not open yet) · `celebration` (what's new).

**Role cues.** The app bar carries a role chip — Administrator (slate), Teacher (indigo), Student (teal) — so a demo across three logins is legible to someone watching from a distance. Colour is the cue, the word is the fact.

**Tone.** Empty and error states speak plainly and always say what to do next: _"No students have joined yet. Share your code — **7KQ4M2XB** — and they'll appear here."_ Never "No data available".

**Accessibility, not decoration.** Every text token above is at **4.5:1 or better** on `surface`, with the measured ratio written down; every status is icon + word + colour; every form control has a real `<label>`; focus rings are never removed. This is a teaching platform and someone's screen reader is a real user.

**Shared components that make Req 23 cheap:**

- **`StatePanelComponent`** renders **loading**, **error**, and **empty** for every list — one component, so the awkward cases exist on every screen rather than the rehearsed one.
- **`errorInterceptor`** turns any network failure into that panel's error state, which is what makes "stop the API mid-demo" behave everywhere at once.
- **`MediaEmbedComponent`** wraps the recording with a fallback message and a plain link when a URL will not embed (Req 15 — never a dead grey box).
- **`AvatarComponent`** (§12.1) draws one person as a photo when `photoETag` is non-null and a deterministic initials tile otherwise — same colour for the same person every time, so a roster stays recognisable. Its `(error)` handler covers a photo deleted between payload and paint.
- **`ReleaseRailComponent`** renders a lesson's three moments as one strip, so "open · quiz opens tomorrow · answers released" reads at a glance rather than as three scattered chips.

**Helper (Req 18):** `helper-intents.json` is a list of `{ keywords[], answer, route }`, matched server-side by keyword overlap. No match returns the list of known topics. A student on no courses is always pointed at `/student/join`, never at a course. **This is still the floor** — §12.3 puts an AI path in front of it, and every failure of that path lands back here.

---

## 9. Schedule

Four days, ~8 working hours each. Each phase has a **definition of done** — the sentence that says it is finished rather than nearly finished — and each day ends at a **gate** naming the specific cuts that fire if it is missed.

> **Feature freeze: end of Day 18.** Nothing new is built on Day 19. Anything unbuilt at 18:00 on Day 18 is **cut, not carried** — building a feature on the morning you present is how demos break, and the gates cannot save you because they fire at the end of a day already spent. Day 19 is rehearsal, README, and fixing what rehearsal exposes.

> **Check Day 16 is really nine hours of build.** It is scheduled as a full day: skeleton, schema, both registrations, cookie auth, antiforgery, guards, home page, admin approval. If part of it goes to scope approval or writing this document, the whole column shifts onto Day 17 and there is no slack anywhere afterwards. If that happens, fire the Day 16 gate's cuts **on Day 17 morning**, before starting — not on Day 19, when they free nothing.

### Day 16 — pipe, then schema

| Time        | Work                                                                                                                         | Done when                                                                                                                       |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| 09:00–10:30 | **Walking skeleton, no auth.** `dotnet new sln/webapi`, `ng new`, proxy, https, CORS, ProblemDetails, Serilog, `/api/health` | The Angular form posts a lesson **title** to the API, EF writes it to SQLite, **and it is still there after F5**. Nothing else. |
| 10:30–12:30 | Full entities, configurations, indexes, first migration, seeded administrator                                                | `dotnet ef database update` runs clean on a deleted database, and the admin row exists                                          |
| 13:15–15:30 | Teacher + student registration, unified login, cookie auth, antiforgery, `/api/me`, guards                                   | Three roles sign in and land on three different screens; signed out, the API answers 401                                        |
| 15:30–17:00 | Public home page against an empty database                                                                                   | It reads `0 teachers` with no cookie and does not crash                                                                         |
| 17:00–18:00 | Admin approval, decide-once                                                                                                  | Approving twice answers **409**                                                                                                 |
| **Gate**    | **Reqs 1, 2, 3, 4, 7 demonstrable end to end**                                                                               | See below                                                                                                                       |

**If the gate is missed, you are behind on auth and infrastructure — and none of that can be cut.** So the cuts fire _forward_, tomorrow morning, against the cheapest work not yet started: **cut 1 (pagination UI), cut 3 (theme to palette + fonts), cut 4 (helper to 8 intents)** — about 4.5 hours out of Days 18–19 — plus the reorder **UI** (keep the endpoint; positions stay editable on the form). Do it before starting Day 17, not while deciding whether you still need to.

The first 90 minutes are the important ones. Proving _one form → one POST → one EF write → one read after refresh_ flushes out CORS, the proxy, https and cookie flags **before** a day of work is stacked on top of them. `[Authorize]` is one attribute once the pipe is proven.

### Day 17 — the teacher's side

| Time        | Work                                                                       | Done when                                                                     |
| :---------- | :------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| 09:00–12:00 | Lesson CRUD + all thirteen rules of §5 + teacher lesson list in real order | Every message in the lesson table can be triggered from the form              |
| 12:00–12:30 | Reorder endpoint, two-phase renumber (§3) + up/down on the list            | A lesson moves from 4 to 2 and the block renumbers, no constraint violation   |
| 13:15–15:00 | Join code, enrollment, student profile, teacher student list               | A student joins two teachers and both appear on both sides                    |
| 15:00–17:30 | Marks, grade detail, corrections, class progress                           | A mark over the maximum is refused **by the server** with the lesson's number |
| 17:30–18:00 | **Test suites A + B** (pending-teacher refusal, mark constraints)          | `dotnet test` green                                                           |
| **Gate**    | **Reqs 5, 6, 8, 9, 10, 11, 12, 13, 14, 22 done**                           | See below                                                                     |

**If the gate is missed, the teacher's side overran.** Fire **cut 2 (progress as a plain table)** and **cut 5 (mark correction via the marks form, not the grade screen)** — ~3 hours, both on work still ahead of you — and drop the reorder UI to a position field on the edit form. Do not borrow from Day 18: everything there is either the spine or frozen.

### Day 18 — the student's side, the rules that cannot be clicked, then freeze

| Time        | Work                                                                                   | Done when                                                                     |
| :---------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| 09:00–11:00 | `VisibleTo` projection, student course view, embedded recording, quiz/answer timing    | The raw JSON for an unopened quiz has **no `quizUrl` key**                    |
| 11:00–12:30 | **Test suites C + D** (timing enforcement, ownership isolation) — _deliberately early_ | `dotnet test` green on all four suites                                        |
| 13:15–14:30 | What's-new, per course and totalled                                                    | Opening course A twice says nothing new, and does not silence course B        |
| 14:30–16:00 | Helper intents, unknown-question path, no-courses path                                 | An unknown question lists what it does know                                   |
| 16:00–17:15 | `StatePanelComponent` on **every** list; error interceptor; theme pass (§8)            | API stopped → every screen says so; contrast ratios re-checked in the browser |
| 17:15–18:00 | Isolation sweep in Postman, then **FREEZE**                                            | Every row of §4's failure column has been seen at least once                  |
| **Gate**    | **Reqs 15, 16, 17, 18, 19, 20, 21, 23 done — everything is now built**                 | See below                                                                     |

Suites C and D sit **before lunch on purpose**. They cover the two requirements that cannot be faked and are the two most likely to expose a design problem; at 16:00 there would be no room left to fix one.

**If the gate is missed, the spine is at risk, and the spine cannot be cut.** Fire **cut 6 (what's-new totals only)** and **cut 7 (profile read-only)** — the two that hurt, ~3.5 hours — and accept that Reqs 17 and 6 partially fail. That is the correct trade: Reqs 19–22 and 23 are what the demo is built to expose, and a partial Req 17 costs less than an unproven Req 19.

### Day 19 — no new features

| Time        | Work                                                                    | Done when                                                     |
| :---------- | :---------------------------------------------------------------------- | :------------------------------------------------------------ |
| 09:00–10:00 | README, verified by cloning to a fresh folder and following it verbatim | A stranger can run it from a clean clone                      |
| 10:00–12:30 | **Two full rehearsals of the brief's demo script**, timed               | Twice, start to finish, without touching the database by hand |
| 13:15–15:30 | Fix only what rehearsal exposed. **Bug fixes, not features.**           | Every defect found this morning is closed or consciously left |
| 15:30–16:30 | Third rehearsal, cold, from `seed --demo`                               | Same result as the first two                                  |
| 16:30–18:00 | Reserve                                                                 | —                                                             |
| **Gate**    | **Demo rehearsed three times; nothing added since Day 18**              | —                                                             |

### Cut list — ordered by hours freed, not by comfort

The brief says _"your cut list matters more here than the list does."_ These are ordered so the first line actually buys time back. **Each gate above names which of these fire**, chosen so they free time on work still ahead rather than on work already overrun:

| #   | Cut                                                                               | Frees | Costs                                                               |
| :-- | :-------------------------------------------------------------------------------- | :---- | :------------------------------------------------------------------ |
| 1   | **Pagination controls in the UI** — keep the API contract, don't build the pager  | ~2h   | Nothing at demo scale                                               |
| 2   | **Class progress as a table, not a visual**                                       | ~1.5h | Req 14 still passes; it is less striking                            |
| 3   | **Theme pass reduced to palette + fonts only** — skip icons, role chips           | ~1.5h | Looks like default Material. **Nothing fails.**                     |
| 4   | **Helper cut to 8 intents**                                                       | ~1h   | Req 18 still passes; the "what I know" list is shorter              |
| 5   | **Mark correction from the grade-detail screen; edit via the marks form instead** | ~1.5h | Req 13 loses a convenience, keeps its substance                     |
| 6   | **What's-new totals only, no per-lesson naming** — _this one hurts_               | ~2h   | **Req 17 partially fails** — "named and attributed" is in the brief |
| 7   | **Student profile edit becomes read-only** — _this one hurts_                     | ~1.5h | **Req 6 partially fails**                                           |

**Never cut:** Reqs 19, 20, 21, 22 — server-side timing, isolation, access control, mark constraints — and Req 23's three states. These cannot be faked in the UI and are exactly what the demo is designed to expose. Cutting a screen costs marks on one requirement; cutting one of these fails the project's spine.

---

## 10. Verification

### Automated — the rules that fail silently

Manual checks get run once, late, by a tired person. These are the rules a click-through cannot give you confidence in, and they are the ones worth defending line by line. Four were planned for the twenty-three requirements (**A–D**); four more came with the extensions (**E–H**, §12). **Sixty tests in total**, `cd server && dotnet test`.

**The test database, named once:** xUnit + `WebApplicationFactory` over **`Microsoft.Data.Sqlite`** in shared-cache in-memory mode — `Data Source=file:{guid}?mode=memory&cache=shared` — one database per test class, with the seeding connection **held open for the class's lifetime** (the database vanishes when the last connection closes). Fast, isolated, and disposable, with none of the file cleanup a temp `.db` needs.

**Never `Microsoft.EntityFrameworkCore.InMemory`.** It is not a database: it ignores unique indexes entirely, so suite B's duplicate-mark **409** would pass whether or not the constraint exists — the exact opposite of what that test is for. Same for suite D's ownership checks and every relational guarantee in §3. If the provider does not enforce the constraint, the test proves nothing about the constraint.

| Suite | Rule                    | Cases                                                                                                                                                                                                                                          |
| :---- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Pending-teacher refusal | pending teacher → every teacher route answers 403 · rejected → 403 · approved → 200 · approval mid-session takes effect on the **next** call, no re-login                                                                                      |
| **B** | Mark constraints        | second mark on the same lesson → 409 · `score = max` → 201 · `score = max + 1` → 400 · `score = -1` → 400 · the bound follows when the lesson's maximum changes · `passed` posted from the client is ignored                                   |
| **C** | Timing enforcement      | quiz opening tomorrow → response has **no `quizUrl` key** (assert on the raw JSON, not the DTO) · lesson unopened → absent from the list **and** 404 by id · `TimeProvider` advanced → both appear · answers independent of quiz               |
| **D** | Ownership isolation     | teacher B cannot read/edit/delete teacher A's lesson (404) · student cannot read a course they never joined (**403**, and the body is not an empty list) · student cannot read another student's marks · mark for a non-enrolled student → 404 · a student profile shows the **calling** teacher's marks and lesson count only |
| **E** | Photos (§12.1)          | `AvatarImageProcessor`: any accepted upload comes out **256×256 WebP** whatever went in · a non-image is a 400, not an exception · an oversized declared dimension is refused before the decode. `AvatarEndpointTests`: upload → `photoETag` changes · `If-None-Match` → **304** · delete → 404 and the tile returns · over 5 MB → **413** |
| **F** | Public directory (§12.2)| the anonymous directory answers **with no session** · lists **approved teachers only** · its raw body carries neither an email nor a join code · a teacher photo is public **only while that teacher is approved**, and "not approved" and "no photo" both answer 404 |
| **G** | AI helper (§12.3)       | the context pack **excludes an unopened lesson and carries no URL at all** — asserted on the serialised pack, in suite C's style · one student's pack never mentions another · **every** failure path (no key · a model that throws · times out · returns unparseable JSON · invents a route · is rate-limited) answers **200 with the phrase-list answer**, never a 5xx |
| **H** | Password reset (§12.4)  | the old password stops working and the new one starts · a wrong current password is a **400 that changes nothing** · the policy is enforced in registration's own words · reusing the current password is refused · signed out is **401** · a session **without the CSRF header is refused and the password is unchanged** · one person's reset leaves every other account alone · the administrator can replace the seeded password |

Suite C asserts against `response.Content.ReadAsStringAsync()`, not a deserialised object — a missing key and a null key deserialise identically, and the difference is the entire requirement. **Suite G borrows that discipline**: it asserts on the serialised context pack rather than the object, because the question is what the model was *shown*, and a field that serialises is a field that was shown.

Suite G injects a fake at `IAnswerModel`, the one seam between the helper and a model vendor, so **no test in CI spends a cent or needs a network**. `AiHelperLiveTests` is the single exception, skipped unless `HELPER_LIVE=1` — it exists so a real key is exercised *before* a demo, not during one, and it asserts that the **model** answered rather than merely that the endpoint did (every failure path degrades to a 200, so a test reading only the status would pass with a dead key).

### Automated — the browser, optional

`client/web/smoke.mjs` drives the real UI through the brief's demo script with Playwright — twenty checks, including that an unopened lesson never reaches the page and an unopened quiz renders a message rather than a dead control. `smoke-api-down.mjs` covers Req 23's hardest case: it kills the API underneath a signed-in session and checks that every screen says so, both when navigating inside the app and after a cold reload. Point either at a deployment with `SMOKE_BASE`.

### Manual — the raw-response check

- `GET /api/student/courses/{teacherId}/lessons` as an enrolled student, lesson quiz opening tomorrow → the JSON has **no `quizUrl` key at all**. Present-but-null-and-hidden-in-the-UI means the requirement is not built.
- The same call for a lesson whose `OpensAtUtc` is in the future → the lesson is **absent**; fetching it by id → **404**.

### Manual — the brief's own demo script

approve a teacher → add a lesson whose quiz opens tomorrow → register a student who belongs to nobody → `GET /api/student/courses/{teacherId}/lessons` → **403** → enter the teacher's code → the course appears → the recording plays and the quiz does not → shift `QuizOpensAtUtc` to now → the quiz appears → enter a second teacher's code → two courses, each with its own notices → ask for a course never joined → **403**.

### Manual — the awkward ones

- **Empty database:** delete the SQLite file, `dotnet ef database update`, load `/` in a private window → counts read `0`, nothing crashes.
- **Cookie (Req 2):** DevTools → Application → Cookies shows `tls_auth` flagged `HttpOnly` and `Secure`, and `document.cookie` does **not** show it. F5 → still signed in.
- **Logout — what it proves, and what it does not.** After `POST /api/auth/logout` the response clears `tls_auth` and the next API call answers **401**. That proves **the browser has stopped sending the ticket**, which is what signing out means on a device you control. It does **not** prove the ticket was invalidated: a cookie ticket cannot be recalled, so a copy captured before logout stays valid until it expires. The 8-hour sliding window is the blast radius, and revocation — not a shorter window — is the real fix; that is what Appendix A is for. Written out because a check whose name claims more than it demonstrates is worse than no check.
- **Mid-demo failure:** stop the API, then click through **every** screen → each shows the error state; none shows a blank panel or an endless spinner.

---

## 11. Running it

### Secrets — nothing sensitive in the repository

Two values are secret and neither belongs in `appsettings.json`:

| Setting                                  | Dev                   | What it is                                                               | Missing?                        |
| :--------------------------------------- | :-------------------- | :----------------------------------------------------------------------- | :------------------------------ |
| `Auth:DataProtectionKey`                 | `dotnet user-secrets` | signs the auth cookie; a fixed key stops sessions dying on every restart | sessions drop on restart        |
| `Seed:AdminEmail` / `Seed:AdminPassword` | `dotnet user-secrets` | the seeded administrator                                                 | **fatal** — fail fast at startup |
| `Ai:ApiKey` (§12.3)                      | `dotnet user-secrets` | the Gemini key the AI helper answers with                                | **not fatal** — the helper drops to `helper-intents.json`, and the choice is logged at startup |

The third one is deliberately different in kind. An app that refuses to boot because an *optional
enhancement* is unconfigured is a worse app, and this enhancement has an exact fallback: with no
key the service graph does not even contain the AI path (`ServiceRegistration`), so unsetting the
secret is a complete rollback with no deploy. Everything else about the helper — model, token cap,
timeout, question-length cap, rate limits — is non-secret and lives in `appsettings.json` under
`Ai`.

```bash
dotnet user-secrets set "Seed:AdminPassword" "<choose one>" --project server/TeachersLessons.Api
```

`appsettings.json` holds the connection string and nothing else. The README lists exactly what a clean clone must set, and the API **fails fast at startup** with a readable message if a required secret is missing — better than a mystery 500 on day 18.

### Demo data — one command

`dotnet run -- seed --demo` drops, migrates, and seeds a known set: one administrator, three teachers (one approved, one pending, one rejected), eight lessons across the approved teachers with **deliberately staggered moments** — one open, one opening in an hour, one quiz opening tomorrow, one answers already released — two students, one on two courses, and a scatter of marks including a pass and a fail.

A broken database at 09:00 on demo day is then a thirty-second fix, not an improvisation. The `--demo` flag refuses to run when `ASPNETCORE_ENVIRONMENT=Production`.

### Observability — twenty minutes, paid back once

- **One structured log line per request:** method, path, status, duration, `userId`, `role`. Serilog request logging, enriched from `CurrentUser`. This is what turns "why is this a 403" into a five-second answer.
- **`GET /api/health`** returns `{ status, db }` and actually opens a connection.

### README — in the order a stranger needs it

`restore → user-secrets → ef database update → seed --demo → run API → npm ci → npm start`, with the two URLs and the demo credentials. Verified by doing it from a clean clone once, on Day 19.

---

## 12. Extensions — three features built after the requirements passed

Everything in §1–§11 was planned before a line was written. This section is the opposite: three features designed **after** the twenty-three requirements were green, each with a full plan file of its own. They share one rule, which is why they are grouped rather than appended separately:

> **Nothing here may weaken a guarantee already made.** Every one of them adds a read path, and every one of them goes through the same door the original feature used — `LessonQueries.VisibleTo` for lessons, `CurrentUser.UserId` for identity, a separate DTO for anything anonymous. A feature that needed a second door was redesigned until it did not.

| §    | Feature                            | Plan                         | Data model      | The guarantee it must not break                             |
| :--- | :--------------------------------- | :--------------------------- | :-------------- | :----------------------------------------------------------- |
| 12.1 | Profile photos                     | [`media.md`](media.md)       | `Avatars` table | the bytes served are always ours; a photo is never a file path |
| 12.2 | Public directory + student profile | [`discover.md`](discover.md) | none            | an anonymous row carries aggregates, never a person          |
| 12.3 | The AI helper                      | [`ai.md`](ai.md)             | none            | the model is shown only what the student's own screens show  |
| 12.4 | Resetting your own password        | this section                 | none            | the account is taken from the cookie, never from the request |

### 12.1 Profile photos — bytes in the database, on purpose

**One decision:** a photo is a row in `Avatars` (§3), stored as a `byte[]`, served by the API.

Not S3/R2/GCS — a second vendor, a second secret and a signed-URL story for a 200 KB square, on a project whose entire database is one SQLite file. Not a folder on disk either: the deployed API has exactly one writable volume, and putting user-supplied bytes in the same filesystem as the executable is a category of bug (path traversal, stale files after a restore) this app has no reason to accept. In the database, a photo is covered by the same backup, the same transaction and the same delete cascade as the person it belongs to.

**The upload is never the thing that is stored.** `AvatarImageProcessor` runs three steps in order, and the order is the security property:

1. **Header only, first.** `Image.Identify` reads dimensions without decoding pixels. A file that is not a raster image is a 400 here — before anything expensive — and a declared dimension over 8000px is refused as a decompression bomb rather than discovered as an OOM.
2. **Re-encode, always.** Auto-orient (EXIF), centre-crop to 256×256 with Lanczos3, encode WebP at q80, retry at q60 if it lands over 200 KB. The output is produced by _our_ encoder, so the bytes in the response are bytes we wrote — a payload disguised as a JPEG does not survive a round trip through a decoder and an encoder.
3. **Store what we made, not what we were told.** `ContentType` is written as `image/webp` literally; the upload's own header is used only to reject obviously wrong types up front.

Served with `X-Content-Type-Options: nosniff`, an `ETag` and a 5-minute `max-age`; a repeat visit sends `If-None-Match` and gets a **304**. `PUT` is 5 MB-capped twice — `[RequestSizeLimit]` behind Kestrel, plus an explicit `Content-Length` check so the **413** is deterministic across hosts (without it the multipart binder simply drops the oversized part and hands the action a null file).

**The client contract is one nullable string.** Every DTO showing a person carries `photoETag`; `AvatarComponent` turns non-null into an `<img>` and null into an initials tile. No payload anywhere carries image bytes, and no screen has to ask "does this person have a photo" separately. The ETag doubles as the cache-buster: a new photo is a new ETag is a new URL.

### 12.2 The public directory, and a student row that opens a profile

Two halves of one idea: **there was nothing to look at before signing in, and a teacher's student list was a dead end.**

**Part A — `/teachers`, the first anonymous _per-row_ read path.** `/api/public/home` only ever returned two totals, so nothing it sent could be traced to a person. The directory sends rows, and that is a different problem. Three rules hold it:

- **A separate DTO, never a reused one.** `PublicTeacherDto` exists so that a field added later to the admin screen's `TeacherSummaryDto` — which already carries `Email` — cannot arrive on an anonymous page by accident. Suite F asserts on the **raw body** that neither an email nor a join code appears.
- **Approved teachers only.** Pending and rejected are not a public record; a rejection certainly is not.
- **Every number is an aggregate over the teacher's own course** — open lessons, published lessons, students, marks, passes. None can be traced to one student. The open-lesson count uses the same predicate as `LessonQueries.VisibleTo`, so it cannot drift from what a student sees inside the course. Pass _rate_ is deliberately not computed server-side: a course with no marks has no pass rate, and rendering "—" is the client's decision, not a number the server should invent.

Ordered by **open lessons descending, then name**, so a newly approved teacher with nothing to show lands at the bottom and the first screen of the directory is never empty. `?q=` filters on name.

**The photo problem, and why a second photo route.** The directory is read with no session, and `GET /api/users/{id}/photo` is `[Authorize]` — it answers those readers 401. Opening that route to every id would make _holding an id_ a permission, and §3 chose UUIDv7 precisely so an id would carry no authority. So there is a second action, `GET /api/public/teachers/{id}/photo`, whose authorisation is a question asked **in SQL** — "is this an approved teacher?" — rather than a claim. A teacher who is not approved and a teacher with no photo answer **identically (404)**, so nothing there tells a caller whether a given id is a person at all. The two routes differ in exactly one header: `public, max-age=300` for a directory photo, `private` for anyone else's.

**Part B — the student row becomes a link.** `GET /api/teacher/students/{studentId}` was already a list of marks; it becomes a profile — details, photo, joined-at, counts, then marks in lesson order. Three isolation rules hold, and suite D is what keeps them holding:

- a student the caller never enrolled is a **404, not a 403** — no existence oracle;
- the marks are filtered by **the caller's own lessons**, so a student on two courses shows each teacher only their own;
- `TotalLessons` counts **the caller's** lessons only, so the denominator cannot leak the size of another teacher's course.

### 12.3 The AI helper — the model answers, the server decides what it may know

This is the one extension that contradicts the brief. [`project.md`](project.md) says _"the helper is not an AI: it is a list of phrases you write"_. That line is a **scope fence**, not an architecture requirement — it existed so Req 18 could not balloon into a chatbot project. The fence is removed; **the phrase list stays wired in underneath**, so with no key configured the app behaves exactly as it did, byte for byte, and Req 18 still passes on its own terms.

**The shape.** `AiHelperService` is a **decorator** over the original `HelperService`, not a replacement. `ServiceRegistration` decides once, at startup, which implementation is registered as `IHelperService`: with a usable key the graph is `AiHelperService → HelperService`, and without one it is `HelperService` alone. **The wire contract does not move** — same route, same `HelperAnswerResponse`, no change to the Angular widget's model, no migration, no new table.

**The context pack is the whole security story.** Before the call the server builds a small JSON snapshot of the asking student's world and sends _that_ — the model is never given a tool, a connection or a query. Everything in the pack comes from a query the student could have run themselves: lessons through `LessonQueries.VisibleTo`, marks from their own `Marks` rows, courses from their own `Enrollments`, "new since last visit" from the same service behind `/student/whats-new`. Three things are deliberately **absent**, and adding any of them back is a security change rather than a tidy-up:

- **every URL** — the model answers _where to look_, never _here is the link_, so a successful prompt injection has nothing to exfiltrate;
- **every future moment** — an unopened quiz arrives as `false`, never as a date, because a guessed date is worse than no date;
- **every id but the teacher's**, which the deep route needs.

A lesson the teacher has not opened is not in the pack at all — it is absent from `VisibleTo`, so the model cannot leak a title it was never shown. _`VisibleTo` is the only door, and there is deliberately no second one._

**The model can suggest; it cannot decide.** Its reply is a structured JSON object (`{answer, route, unknown}`) requested through a response schema, and the `route` is then **validated against this student's own screens** — a static allow-list, plus a course route accepted only when the guid is one of the teachers in this student's own pack, checked against the pack rather than against a regex. A hallucinated, foreign or off-app route becomes `null`: the answer still shows, the "Take me there" button simply does not. `HelperService`'s no-courses rule is then applied to the model's answer exactly as it is applied to the phrase list's — one rule, one place.

**Degradation is the feature.** The route's entire promise is that it never fails. Every one of these lands on the same line — _`HelperService` answers_ — with a **200**:

| What happened                                                                   | What the student gets                                                                                               |
| :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| No key configured                                                               | the phrase list                                                                                                     |
| Over the per-student rate limit                                                 | the phrase list — deliberately **not a 429**: a helper that stops helping is worse than one that answers from a list |
| The model threw, or the SDK threw something undocumented                        | the phrase list, warning logged                                                                                     |
| The call took longer than `Ai:TimeoutSeconds`                                   | the phrase list — the timeout guards the **seam**, so it holds whatever is behind it                                |
| The reply did not finish cleanly (safety block, token cut-off, empty candidate) | the phrase list                                                                                                     |
| The reply was not parseable JSON                                                | the phrase list — a schema is a _request_, not a guarantee                                                          |
| The model said `unknown`, or answered empty                                     | the phrase list, including its "here's what I do know" list                                                         |

The one thing that is **not** degraded is the caller going away: a cancelled request rethrows rather than spending a fallback nobody is waiting for.

**Cost, and what the limiter is actually for.** `gemini-3.5-flash-lite` with thinking off, measured at ~687 tokens a question — roughly **two hundredths of a cent**. The per-student sliding window (6/minute, 60/day, in memory) is therefore an **abuse guard, not a cost guard**: it is there so one bored student with a loop cannot make the app noisy, and so the free tier's per-minute quota is never what fails. In-memory is correct here and stays correct — §11 and the README both state the API is a single instance by necessity, because a Fly volume attaches to one machine and SQLite cannot be shared. A distributed counter would be infrastructure for a topology this app cannot have.

**Content, not code.** `helper-system-prompt.md` sits beside `helper-intents.json` and is read once at startup, for the same reason: whoever tunes the helper's voice should not be writing a C# diff.

**What would make this a mistake.** If the pack ever starts carrying a URL, a future date, or a field that did not come through `VisibleTo`; if the route allow-list becomes a regex; or if a failure path starts answering 5xx instead of the phrase list. Each of those has a test in suite G, and each of those tests exists because it is the thing that would quietly stop being true.

### 12.4 Resetting your own password — the one reset that needs no email

**The brief bundled two things under one cause.** [`project.md`](project.md) says _"there is no password reset, and no notification leaves the app — **both need email**"_. Only one of them does. Proving identity to somebody who **cannot sign in** needs a message sent to an address they control; that is the *forgotten*-password case, and it still does not exist here. But somebody who **is** signed in has already proved who they are, twice over — they hold the session cookie, and they can type the password the account currently has. Nothing needs to be sent anywhere for that.

So this is the half that was built, and the naming is deliberate: **`PUT /api/me/password`**, not `/api/auth/forgot`. It is a property of *me*, changed by *me*.

**No user id crosses the wire.** The account is read from `ICurrentUser.UserId`, which comes from the cookie's `NameIdentifier` claim. There is no id in the route and no id in the body, so there is nothing to tamper with — the endpoint cannot be aimed at another account no matter what is posted to it. This is the same rule §5 states for every authenticated route, and it is worth restating here because a password endpoint is the one where getting it wrong is worst.

**Two checks the validator deliberately does not do.** `ChangePasswordRequestValidator` answers questions about the *shape* of the request — is a current password present, does the new one meet the policy. The two questions that need the stored hash are answered in `AccountService`, which is the only place allowed to touch it:

1. **Does the current password verify?** If not, `400` named on `currentPassword`. Unlike sign-in, being specific costs nothing: the caller already holds this session.
2. **Is the new password the one already in use?** If it verifies against the stored hash, `400` named on `newPassword`. Not a history — one comparison, against the only hash there is. A password *history* would mean storing old hashes, which is more retained credential material to protect for a benefit this app does not need.

**One policy, reused rather than restated.** The validator calls the same `RegistrationRules.Password()` extension registration calls, and the client reuses the same `PASSWORD_RULE` string it shows on the sign-up screens. The rule a person reads before they break it and the rule they are told they broke are one string, in one place, for both screens.

**Who gets the screen.** All three roles, through one shared `PasswordCardComponent` on `/student/profile`, `/teacher/profile` and the new `/admin/profile`. The administrator is the reason `/admin/profile` exists at all: the admin account's first password is seeded from `Seed:AdminPassword`, so it also lives in a config file, a deploy script and somebody's shell history. `DbSeeder` only ever *inserts* — it never rewrites an existing row — so a password changed in the app is the password from then on, and the seeded one can stop being a live credential.

**What this does not do, stated plainly.** Changing a password does **not** sign out that person's other sessions. The cookie carries id, email and role and is validated by its own signature; there is no server-side session record to revoke and no security stamp on `User` to invalidate against. Nothing here pretends otherwise. The fix is the same one Appendix A already describes for a different reason — a stored, revocable token — and it is the same single change that would close both.

| Failure                                      | Status | Where the message lands  |
| :------------------------------------------- | :----- | :----------------------- |
| Not signed in                                | `401`  | — |
| No `X-XSRF-TOKEN` header                     | `400`  | banner — the same middleware every other write goes through |
| Current password wrong                       | `400`  | under **Current password** |
| New password breaks the policy               | `400`  | under **New password**, in registration's own words |
| New password is the one already in use       | `400`  | under **New password** |
| New and confirm differ                       | —      | under **Confirm new password**, client-side, never sent |

---

## Appendix C — The public directory is the first anonymous read path beyond `/api/public/home`

`GET /api/public/teachers` and `GET /api/public/teachers/{id}/photo` (see [`discover.md`](discover.md))
are the first endpoints to serve *per-row* data to someone with no session. `/api/public/home`
only ever returned two totals, so nothing it sent could be traced to a person.

Two consequences worth keeping in mind before anything else is added under `/api/public`:

- **A separate DTO, not a reused one.** `PublicTeacherDto` exists so that a field added later to
  the admin screen's `TeacherSummaryDto` — which already carries `Email` — cannot arrive on an
  anonymous page by accident. Every statistic on it is an aggregate over a teacher's own course.
- **Authorisation moved into the query.** `PhotoController` stays `[Authorize]` at the class
  level; the one public action asks "is this an approved teacher?" in SQL rather than opening
  `/api/users/{id}/photo` to every id. §4 chose UUIDv7 so an id would carry *no* authority — that
  choice only holds if no route treats holding one as permission.

---

## Appendix A — What I would build next: rotating refresh tokens

**Not built.** Nothing in the 23 requirements asks for it, it is roughly a day, and it would sit on the main request path ahead of every lesson, mark and enrolment. The sliding cookie ticket in §4 covers Req 2 completely. This is the design I would reach for on a real system, and it is a real answer to "how would you harden this".

**Why it is worth doing at all:** a cookie ticket is valid until it expires and **cannot be recalled**. Signing out on a shared machine, or an administrator ending a session, has no server-side effect. A refresh token buys **revocation** — and nothing else. The cost is a second table on the hot path.

**Shape:** a short access cookie (`tls_access`, 15 min, `Path=/`) plus a long refresh cookie (`tls_refresh`, 14 days, `SameSite=Strict`, **`Path=/api/auth`** so it rides three routes instead of twenty-eight). A `RefreshTokens` table stores only the **SHA-256** of each token, plus `FamilyId`, `ExpiresAtUtc`, `ConsumedAtUtc?`, `RevokedAtUtc?`, `ReplacedById?`.

**Rotation:** `POST /api/auth/refresh` consumes the presented token and issues a successor in the same family, inside a transaction, with `TokenHash` unique-indexed so two tabs cannot both mint one.

**Reuse detection:** a token presented **after** it was consumed is either a benign race or a stolen cookie. The server cannot tell, so it assumes the worse and **revokes the whole `FamilyId`**. Both the thief and the real user must sign in again — the only signal a stolen refresh token ever gives.

**Client:** a `refreshInterceptor` holding **one** in-flight refresh shared via `shareReplay(1)`, so a dashboard firing six parallel calls against a lapsed cookie triggers one refresh, not six — and ignoring 401s from `login`, `register/*` and `refresh` itself, or a failed refresh loops forever.

**And what it unlocks:** `GET`/`DELETE /api/auth/sessions` — "signed in on 2 devices", "sign out everywhere" — which is impossible with a cookie ticket alone.

**Half of this is worse than none of it.** Rotation without reuse detection hands out 14-day credentials that nothing ever checks. It goes in whole or not at all, which is the other reason it is not in a four-day plan.

---

## Appendix B — Response to the reviews

### Round 2 — the final review, all six open items closed

| Item                                          | What changed                                                                                                                                                                                                                                                                                                                                                             |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1** reordering impossible as designed      | Correct, and it would have bitten within ten minutes. Kept the unique index (Req 8 requires the 400 that a sort hint cannot promise) and added `PUT /api/teacher/lessons/order` with a **two-phase renumber** — negative scratch range, then flip positive — in one transaction. Rules **R1–R2** in §5; the whole-list payload makes ownership fall out of set equality. |
| **M2** no freeze, features on demo morning    | **Feature freeze at end of Day 18**, stated at the top of §9. Helper, state panels and the theme pass moved to Day 18 afternoon; Day 19 is README, three rehearsals, and bug fixes only. Anything unbuilt at the freeze is cut, not carried.                                                                                                                             |
| **M3** test database named twice, differently | Named once, in §10, and §1 now points at it: **`Microsoft.Data.Sqlite`** shared-cache in-memory, connection held open per class. With the reason attached — EF Core InMemory ignores unique indexes, so suite B would pass against a constraint that does not exist.                                                                                                     |
| **D1** gates cut from the wrong end           | Each gate now names its own cuts, chosen to free time on work **still ahead**. Missing Day 16 means you are behind on auth, which cannot be cut — so cuts 1, 3, 4 fire forward into Days 18–19. Day 17 fires cuts 2 and 5; Day 18 fires 6 and 7, the two that hurt.                                                                                                      |
| **D2** logout check claims too much           | Reworded in §10 to say exactly what it proves — the **browser stopped sending** the ticket — and what it does not: a cookie ticket cannot be recalled, the 8-hour sliding window is the blast radius, and revocation is the actual fix (Appendix A). Kept the 8 hours; the honest answer was the wording, not a shorter number.                                          |
| **V1** two theme colours fail the AA claim    | They did. `tertiary` was 2.9:1 and `warning` 3.6:1 on `surface`. Both are now **fills only**, with `tertiary-text #8A5A12` (5.6:1) and `warning-text #7A4E10` (6.8:1) carrying the words. The §8 palette table now prints the **measured ratio for every token**, because the claim is checkable in a browser in ten seconds.                                            |

**On the advisory notes:** suite D moved to **before lunch on Day 18**, alongside suite C, for the reason given — they are the two most likely to expose a design problem and there is no room to fix one at 16:00. And the Day 16 realism warning is now written into §9: if the day is not really nine hours of build, the cuts fire on **Day 17 morning**, before starting.

**With thanks for the two withdrawals** — antiforgery and the seeded administrator. Both are still in, and both now read as decisions rather than oversights, which is the more useful outcome than being right.

### Round 1 — blocking, all five taken

1. **Refresh-token subsystem cut** to a plain sliding cookie ticket; the full design moved to Appendix A. Agreed, and the reasoning was the part I had wrong: the design being good is what made it a trap.
2. **What gets proven first changed** from "`Users` plus the whole auth stack" to _one form → one POST → one EF write → one read after refresh_, in the first 90 minutes of Day 16, with no auth in it. The integration risk (CORS, proxy, https, cookie flags) now surfaces before anything is stacked on it.
3. **The phase list is now a schedule** (§9) with wall-clock slots, a definition of done per phase, and an end-of-day gate that fires the cut list.
4. **Cut list re-ordered by hours freed** (§9), with the two that genuinely hurt named as hurting.
5. **Four test suites named** (§10) for the pending-teacher refusal, timing, ownership, and mark constraints — including the detail that suite C must assert on **raw JSON**, since a missing key and a null key deserialise identically.

### Round 1 — worth changing, all seven taken

Bounded lists with a stated order and a `pageSize` cap of 100 (§4) · secrets in user-secrets with fail-fast startup (§11) · `seed --demo` as one command (§11) · one structured log line per request plus `/api/health` (§11) · the status-code convention stated once as a table (§4) · a README verified from a clean clone (§11). The seventh is not a document change: **the lines on the request path are mine to read before I am asked about them** — §5, §6 and §10 are where that reading matters most.

### Round 1 — suggestions

- **Keeping all six of the named decisions**, each with a one-sentence defence written into the section it belongs to: the `VisibleTo` projection (§6), `int` scores on SQLite (§3), injected `TimeProvider` (§1), `ProblemDetails` with field-keyed errors (§4), 403-vs-404 (§4), and the shared state panel with an error interceptor behind it (§8).
- **Enum plus `DecidedAtUtc` kept** (§3) — noted in the table as making the impossible state unrepresentable.
- **Single identity table kept**, with one correction to the review's premise: the **administrator is a seeded row in `Users`**, not a config-only account, so it is inside the unique index rather than beside it. The service-level uniqueness check stays anyway, because a check plus an index is what makes the race safe.
- **`Guid` kept**, and the enumeration argument is in §3 in one sentence. If that sentence stops sounding like mine under questioning, `int` is the honest answer and the migration is small.
- **Definition of done added per phase** (§9).

### Round 1 — one refusal, stated as a decision (since withdrawn by the reviewer)

**Antiforgery stays.** The review groups it with the refresh-token subsystem, but it is not the same size or the same kind of thing: it is ~15 lines — one `withXsrfConfiguration` call on the client, one `IAntiforgery` filter on the server — and it is the price of choosing cookies at all. A cookie rides every request _including one a foreign page triggers_, which is precisely what a bearer header does not do. Dropping it would mean any page a signed-in teacher visits could delete their lessons. If cookies are the choice, CSRF protection is not an extra; the alternative is not "cookies without antiforgery", it is going back to a bearer token.
