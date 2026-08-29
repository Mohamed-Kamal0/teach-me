# Discover Plan — The Public Teacher Directory & the Student Profile

> Companion to [`plan.md`](plan.md) and [`media.md`](media.md). `plan.md` decided the stack;
> `media.md` decided how a face is stored. This file decides two navigations the app is currently
> missing: **who is teaching here** (visible before anyone signs in) and **who is this student**
> (one click from a teacher's roster).

**Stack touched:** one new anonymous controller action · one widened teacher DTO · one new
Angular route · two existing tables made clickable. No new entity, no migration, no new package.

---

## 1. The decision in two lines

**A — Directory.** A signed-out visitor, and a signed-in student, land on a page that lists every
**approved** teacher as a card carrying that teacher's public numbers: lessons open, lessons
published, students enrolled, quizzes marked, pass rate, member since.

**B — Student profile.** On a teacher's roster and progress table, **the row itself is the link**,
and what it opens is a *profile* — photo, name, contact, bio, joining date, a progress rollup —
with the marks table underneath it, not instead of it.

Both are read-only. Nothing here creates, edits or deletes anything.

---

## 2. Scope

| In | Out |
| :-- | :-- |
| `GET /api/public/teachers` — paged, anonymous, approved teachers only | A public page *per* teacher, with their lesson list |
| Aggregate statistics per teacher, computed in one query | Any statistic that names an individual student |
| Teacher photos served to anonymous visitors, safely | Making the existing `/api/users/{id}/photo` anonymous |
| A `/teachers` route reachable signed-out and as a student | Teachers/admins browsing each other (they may, it is just not the point) |
| The home page linking into the directory | Replacing the home page's existing three-moments narrative |
| Whole-row navigation on the roster and the progress table | Row navigation on the lesson tables |
| The teacher-side student detail page widened into a profile | Letting a teacher *edit* a student's profile |
| Search by teacher name (`?q=`) | Sorting the directory from the UI, filters, tags, subjects |

**The rule that governs part A:** a teacher's own numbers are theirs to advertise; a student's
numbers are not. Every statistic in the directory is an aggregate over a teacher's own course.
Nothing in the payload can be traced to one student.

---

## 3. Part A — the public teacher directory

### 3.1 What is public, and what may never be

The existing `TeacherSummaryDto` in `Features/Admin/Dtos.cs` carries `Email`, and the admin
endpoints carry `JoinCode`. **Neither may be reused here.** A separate DTO exists precisely so a
field added later for the admin screen cannot leak onto an anonymous page.

| Public | Never public |
| :-- | :-- |
| `UserId` (UUIDv7 — already in URLs, carries no information) | `Email` |
| `FullName` | `JoinCode` — the whole join flow depends on it being asked for, not found |
| `PhotoETag` (and the photo itself, §3.4) | Pending and rejected teachers — approval is not a public record |
| `CreatedAtUtc` → "member since" | Any student's name, mark, photo, or count-of-one |
| `OpenLessonCount`, `PublishedLessonCount` | A teacher's own email, phone or decision history |
| `StudentCount`, `MarkCount`, `PassedMarkCount` | |

`StudentCount` is the one judgement call: it is a count, never a roster, and it is the number a
prospective student actually wants ("is anyone here?"). If that is later judged too much, it is one
field to drop — the client already renders each stat independently.

### 3.2 The endpoint

```
GET /api/public/teachers?page=1&pageSize=20&q=amina        [AllowAnonymous]
→ 200 PagedResult<PublicTeacherDto>
```

It goes on the **existing** `PublicController` (`Features/Public/PublicController.cs`), which is
already `[AllowAnonymous]` and already on the `AntiforgeryMiddleware` exempt prefix list
(`/api/public`). No pipeline change, no new policy, no CORS change.

Paging reuses `PagingExtensions.Normalize` — default 20, hard cap 100 — so an anonymous caller
cannot ask for the whole table in one breath.

### 3.3 The DTO and the query

`Features/Public/PublicController.cs`:

```csharp
public record PublicTeacherDto(
    Guid UserId,
    string FullName,
    string? PhotoETag,
    DateTimeOffset MemberSinceUtc,
    int OpenLessonCount,        // released — OpensAtUtc <= now
    int PublishedLessonCount,   // every lesson the teacher has created
    int StudentCount,
    int MarkCount,
    int PassedMarkCount);
```

```csharp
[HttpGet("teachers")]
public async Task<ActionResult<PagedResult<PublicTeacherDto>>> Teachers(
    [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? q, CancellationToken ct)
{
    var (p, ps) = PagingExtensions.Normalize(page, pageSize);
    var now = clock.GetUtcNow();

    var teachers = db.Teachers.Where(t => t.Status == TeacherStatus.Approved);

    if (!string.IsNullOrWhiteSpace(q))
    {
        var term = q.Trim();
        teachers = teachers.Where(t => EF.Functions.Like(t.User.FullName, $"%{term}%"));
    }

    var total = await teachers.CountAsync(ct);

    var items = await teachers
        .OrderByDescending(t => t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now))
        .ThenBy(t => t.User.FullName)
        .Skip((p - 1) * ps).Take(ps)
        .Select(t => new PublicTeacherDto(
            t.UserId,
            t.User.FullName,
            db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault(),
            t.User.CreatedAtUtc,
            t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now),
            t.Lessons.Count(),
            t.Enrollments.Count(),
            t.Lessons.SelectMany(l => l.Marks).Count(),
            t.Lessons.SelectMany(l => l.Marks).Count(m => m.Score >= m.Lesson.PassMark)))
        .ToListAsync(ct);

    return Ok(new PagedResult<PublicTeacherDto> { Items = items, Page = p, PageSize = ps, Total = total });
}
```

Three things this deliberately does:

- **`TimeProvider clock` is injected**, not `DateTimeOffset.UtcNow`. `PublicController` currently
  takes only `AppDbContext`; add `TimeProvider clock` to its primary constructor. Every timing
  decision in this codebase is shiftable, and "lessons open" is a timing decision.
- **"Open" reuses the `OpensAtUtc != null && <= now` rule** from `LessonQueries.VisibleTo`, so the
  public number and the number a student sees inside the course agree. The projection there returns
  a `StudentLessonDto` and cannot be reused for a count; the *predicate* is what must not drift, so
  extract it into a shared expression if a third caller ever appears.
- **Pass rate is not sent.** `MarkCount` and `PassedMarkCount` go over the wire and the client
  divides. A `0/0` course has no pass rate, and that is a rendering decision ("—"), not a `NaN` the
  server has to invent a value for.

**Ordering.** Most open lessons first, then alphabetical. A newly approved teacher with no lessons
therefore lands at the bottom, not the top — the first screen of the directory is never
empty-looking.

### 3.4 The photo problem — and why a second photo route

`PhotoController` is `[Authorize]` at the class level, including
`GET /api/users/{userId:guid}/photo`. **An anonymous visitor cannot load any photo today**, so a
directory built on `AvatarComponent` as it stands would render initials tiles for everyone.

Two ways out:

| Option | Verdict |
| :-- | :-- |
| Put `[AllowAnonymous]` on the existing `Get` action | **No.** It opens *every* user's photo — every student's — to anyone holding a `Guid`. UUIDv7 is not enumerable, but `plan.md` chose it so an id would carry no authority, not so it would carry all of it. |
| Add an anonymous route that serves **only approved teachers** | **Yes.** The authorisation is in the query, not in a claim. |

Add to `PhotoController` (the class keeps its `[Authorize]`; this one action opts out):

```csharp
[HttpGet("api/public/teachers/{userId:guid}/photo")]
[AllowAnonymous]
public async Task<IActionResult> PublicTeacherPhoto(Guid userId, CancellationToken ct)
{
    var isPublicTeacher = await db.Teachers
        .AnyAsync(t => t.UserId == userId && t.Status == TeacherStatus.Approved, ct);

    if (!isPublicTeacher)
    {
        return NotFound();   // "no photo" and "not a public teacher" answer identically
    }

    return await ServeAvatar(userId, ct);
}
```

Refactor the body of the existing `Get` into a private `ServeAvatar(Guid, CancellationToken)` so
the caching contract — `ETag`, `If-None-Match` → 304, `X-Content-Type-Options: nosniff` — is
written once. One difference between the two callers: `Cache-Control` becomes
`public, max-age=300` on the public route and stays `private, max-age=300` on the authenticated
one. A teacher's directory photo is fine in a shared cache; a student's is not.

**Client side**, `AvatarComponent` grows one optional input rather than a second component:

```ts
/** Overrides the photo route. The directory is read by people with no session, and the
 *  authenticated /api/users/:id/photo route answers them 401. */
@Input() photoBase = '/api/users';

get src(): string {
  return `${this.photoBase}/${this.userId}/photo?v=${encodeURIComponent(this.photoETag ?? '')}`;
}
```

The directory passes `photoBase="/api/public/teachers"`. Every existing call site is untouched and
keeps the default. The `(error)` → initials fallback already covers a route that answers 404, so a
mistake here degrades to initials rather than a broken image.

### 3.5 The client — route, model, component

**`core/models.ts`**

```ts
export interface PublicTeacher {
  userId: string;
  fullName: string;
  photoETag: string | null;
  memberSinceUtc: string;
  openLessonCount: number;
  publishedLessonCount: number;
  studentCount: number;
  markCount: number;
  passedMarkCount: number;
}
```

**`app.routes.ts`** — above the guarded blocks, with no guard at all:

```ts
{ path: 'teachers', loadComponent: () => import('./features/public/teachers.component').then(m => m.TeachersComponent) },
```

**`features/public/teachers.component.ts`** — a standalone signals component in the same shape as
`courses-list.component.ts`: `loading` / `error` / `data` signals, one `load()`, everything wrapped
in `<app-state-panel>` with `[empty]` and a `(retry)`. It reuses the existing card-grid idiom
(`repeat(auto-fill, minmax(15rem, 1fr))`, `var(--paper)`, `var(--shadow-1)`, the hover lift) so the
page looks like it was always there.

Each card:

```
┌──────────────────────────────────────┐
│  (photo)   Amina Farouk              │
│            Teaching since Aug 2026   │
├──────────────────────────────────────┤
│   4         12         68%           │
│  lessons   students   pass rate      │
│   open                               │
├──────────────────────────────────────┤
│  12 lessons published · 25 marked    │
└──────────────────────────────────────┘
```

- **Pass rate** renders `—` when `markCount === 0`. Never `0%` — "nobody has sat a quiz yet" and
  "everybody failed" are not the same sentence.
- **Numbers use the existing `tabular-nums` class**, as every other figure in the app does.
- **Empty state:** `emptyIcon="school"`, "No teachers have been approved yet." A visitor arriving on
  launch day sees a sentence, not a blank grid.
- **Search:** one `<mat-form-field>` bound to a signal, debounced 250 ms, re-issuing `load()`. It
  appears only once `total` exceeds one page — a search box over six cards is furniture.

### 3.6 Where the card goes when you click it

The destination depends on who is looking, and the component knows via the injected `AuthService`
(`home.component.ts` already injects it for exactly this kind of decision):

| Viewer | Card action |
| :-- | :-- |
| Signed out | "Sign up to join" → `/register/student` |
| Student, **enrolled** with this teacher | The whole card links to `/student/courses/:teacherId` |
| Student, **not enrolled** | "Ask this teacher for their joining code" → `/student/join` |
| Teacher / Admin | No action — the card is informational |

Knowing which courses a student is already on costs nothing new: `/student/courses` is the endpoint
`CoursesListComponent` already uses. The directory calls it **only when
`auth.role() === 'Student'`** and holds the teacher ids in a `Set`. If that second call fails, the
card degrades to the "not enrolled" action — it never blocks the directory from rendering.

### 3.7 Wiring it into the app

- **Home page** (`features/public/home.component.ts`): under the existing stats block, a
  "Meet the teachers" strip showing the first three cards from the same endpoint, and a
  `Browse all teachers` button to `/teachers`. The existing `approvedTeacherCount` stat becomes the
  strip's heading number rather than a second, separate fetch.
- **App bar** (`app.component.ts` → `links()`): `links()` returns `[]` for a signed-out visitor
  today, which is why the signed-out bar shows only account links. Add one always-present link —
  `{ path: '/teachers', label: 'Teachers', icon: 'groups' }` — for the signed-out case and for
  `Student`. Not for `Teacher` or `Admin`: their bars are already full and the page is not for them.
- **Helper widget** (`helper-intents.json`): one new intent —
  `keywords: ["teachers", "who teaches", "find a teacher", "browse teachers"]`,
  `route: "/teachers"`. It is content, not code, exactly as `plan.md` intended.

---

## 4. Part B — a student row that opens a student profile

### 4.1 What is wrong today

`students-list.component.ts` renders four columns and puts a small `View grades` anchor in the last
one. The row — the thing the eye and the mouse both treat as the object — does nothing. And
`/teacher/students/:studentId` is titled with the student's name but is, in substance, a marks
table: `Student.DisplayName`, `Phone` and `Bio` exist on the entity and on the student's own profile
screen, and the teacher never sees any of them.

### 4.2 The row becomes the link

In `students-list.component.ts`:

- Drop the `actions` column. `columns` becomes `['fullName', 'email', 'joinedAtUtc']`.
- Keep a **real anchor** in the name cell — it carries the accessible name, gives a right-click
  target and middle-click-to-new-tab, and needs no ARIA:

```html
<td mat-cell *matCellDef="let row" data-label="Name" class="cell-name">
  <app-avatar size="sm" [userId]="row.userId" [name]="row.fullName" [photoETag]="row.photoETag"></app-avatar>
  <a [routerLink]="['/teacher/students', row.userId]" class="cell-name__link">{{ row.fullName }}</a>
</td>
```

- Make the rest of the row a convenience click, not the only way in:

```html
<tr mat-row *matRowDef="let row; columns: columns;" class="row-link" (click)="open(row, $event)"></tr>
```

```ts
/** The anchor in the name cell is the real link; this only saves the mouse a trip to it.
 *  A click that began on something else interactive (the copy button, a future menu) or that
 *  ends a text selection is left alone. */
open(row: StudentSummary, event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('a, button, input')) return;
  if (window.getSelection()?.toString()) return;
  this.router.navigate(['/teacher/students', row.userId]);
}
```

Styling: `.row-link { cursor: pointer; }`, a `--paper-sunk` hover, and
`.row-link:focus-within { outline: 2px solid var(--primary); outline-offset: -2px; }` so tabbing to
the name anchor lights the whole row. **No `tabindex` on the `<tr>`** — that adds a second tab stop
per row leading to the same place as the first.

The same three edits go into `progress.component.ts` (its rows key on `studentUserId`), which is
where a teacher is *most* likely to want to open a student — it is the screen that tells them who is
falling behind.

### 4.3 The detail endpoint becomes a profile

`GET /api/teacher/students/{studentId}` keeps its URL and its ownership check. The response widens.
`Features/Teacher/StudentDtos.cs`:

```csharp
public record StudentProfileDto(
    Guid UserId,
    string FullName,
    string? DisplayName,
    string Email,
    string? Phone,
    string? Bio,
    string? PhotoETag,
    DateTimeOffset JoinedAtUtc,
    int TotalLessons,
    int LessonsMarked,
    int PassedCount,
    int FailedCount,
    List<LessonMarkDto> Marks);
```

`StudentGradeDetailDto` is deleted — its only consumers are this action and the Angular
`StudentGradeDetail` interface, both changed in the same commit. Do not keep both.

In `StudentsController.Detail`, the existing enrollment projection grows the profile columns, and
the rollup is counted off the marks already in memory:

```csharp
var enrollment = await db.Enrollments
    .Where(e => e.TeacherUserId == teacherId && e.StudentUserId == studentId)
    .Select(e => new
    {
        e.Student.User.FullName,
        e.Student.User.Email,
        e.Student.DisplayName,
        e.Student.Phone,
        e.Student.Bio,
        e.JoinedAtUtc,
        PhotoETag = db.Avatars.Where(a => a.UserId == studentId).Select(a => a.ETag).FirstOrDefault()
    })
    .FirstOrDefaultAsync(ct);

if (enrollment is null) throw new NotFoundApiException();

// ... the existing marks query, unchanged ...

var totalLessons = await db.Lessons.CountAsync(l => l.TeacherUserId == teacherId, ct);

return Ok(new StudentProfileDto(
    studentId, enrollment.FullName, enrollment.DisplayName, enrollment.Email,
    enrollment.Phone, enrollment.Bio, enrollment.PhotoETag, enrollment.JoinedAtUtc,
    totalLessons, marks.Count, marks.Count(m => m.Passed), marks.Count(m => !m.Passed),
    marks));
```

`totalLessons` is counted the same way `ProgressController` counts it, so the "3 of 8 marked" on the
profile and the progress bar on the progress table cannot disagree.

**Three isolation rules that must survive this change** — they are already true today, and the point
of writing them down is that a later edit must not quietly undo them:

1. A `studentId` not enrolled with the caller raises `NotFoundApiException` → 404. Not 403 — a
   teacher must not be able to probe whether a given id is a student at all.
2. The marks query filters `m.Lesson.TeacherUserId == teacherId`. A student on two courses shows
   each teacher only their own lessons' marks.
3. `TotalLessons` counts the caller's lessons only, so the denominator cannot leak the size of
   another teacher's course.

### 4.4 The page

`features/teacher/student-detail.component.ts` — same file, same route, restructured:

```
← Back to students

┌─────────┐  STUDENT
│ (photo) │  Nadia Hassan            ← FullName
│  96px   │  "Nadi"                  ← DisplayName, only when set and different
└─────────┘  nadia@…  ·  +20 …  ·  Joined 12 Aug 2026

  ▓▓▓▓▓▓▓░░░  3 of 8 lessons marked   ·   2 passed   ·   1 failed

  About
  Second-year, prefers evening sessions.        ← Bio, the whole block hidden when null

  Marks
  [ the existing table, with its inline Correct / Save editing, unchanged ]
```

- The existing `<app-avatar size="lg">` and `page-head` markup stay; the sub-line gains the extra
  facts.
- The rollup strip reuses `<mat-progress-bar>` exactly as `progress.component.ts` does, with the
  same `aria-label` phrasing.
- `DisplayName`, `Phone` and `Bio` are all nullable on `Student` and are commonly null. Each is
  wrapped in its own `@if` — never a dangling "Phone:" label with nothing after it.
- The marks table, the `editingId` signal, `save()`, `cancel()` and the `NotifyService` calls are
  untouched. This is an addition above the table, not a rewrite of it.

---

## 5. Files touched

| File | Change |
| :-- | :-- |
| `Features/Public/PublicController.cs` | `+ PublicTeacherDto`, `+ GET teachers`, inject `TimeProvider` |
| `Features/Auth/PhotoController.cs` | `+ GET api/public/teachers/{id}/photo` `[AllowAnonymous]`; extract `ServeAvatar` |
| `Features/Teacher/StudentDtos.cs` | `StudentGradeDetailDto` → `StudentProfileDto` |
| `Features/Teacher/StudentsController.cs` | `Detail` returns the profile + rollup |
| `helper-intents.json` | `+` one "teachers" intent |
| `client/…/core/models.ts` | `+ PublicTeacher`; `StudentGradeDetail` → `StudentProfile` |
| `client/…/app.routes.ts` | `+ /teachers`, unguarded |
| `client/…/app.component.ts` | `links()` gains `/teachers` for signed-out and Student |
| `client/…/shared/avatar.component.ts` | `+ @Input() photoBase` |
| `client/…/features/public/teachers.component.ts` | **new** |
| `client/…/features/public/home.component.ts` | `+` the "Meet the teachers" strip |
| `client/…/features/teacher/students-list.component.ts` | row link, drop the `actions` column |
| `client/…/features/teacher/progress.component.ts` | row link |
| `client/…/features/teacher/student-detail.component.ts` | profile header + rollup |

No migration. No `AppDbContext` change. No new NuGet or npm package.

---

## 6. Tests

A new suite, `server/TeachMe.Api.Tests/PublicDirectoryTests.cs`, on the existing
`ApiFactory` (real SQLite in memory, `ManualTimeProvider` for the clock):

| Test | Asserts |
| :-- | :-- |
| `Directory_is_reachable_without_a_session` | An `HttpClient` with no cookie gets 200 |
| `Directory_lists_only_approved_teachers` | A pending and a rejected teacher are both absent |
| `Directory_never_carries_an_email_or_a_join_code` | The raw response body contains neither the seeded email nor the join code |
| `Open_lesson_count_follows_the_clock` | Count is 0 before `OpensAtUtc`; advance `Clock`; count is 1 |
| `Statistics_are_scoped_to_each_teacher` | A student on two courses contributes to each teacher's counts separately |
| `Page_size_is_capped_at_one_hundred` | `?pageSize=5000` answers with `pageSize: 100` |
| `Teacher_photo_is_public_only_for_approved_teachers` | Anonymous GET: 200 for an approved teacher with a photo, 404 for a pending one, 404 for a student |

Added to the existing `OwnershipIsolationTests.cs`:

| Test | Asserts |
| :-- | :-- |
| `Student_profile_is_404_for_a_student_who_never_joined` | Not 403 — no existence oracle |
| `Student_profile_marks_are_scoped_to_the_calling_teacher` | Two teachers, one shared student: each sees only their own lessons |
| `Student_profile_total_lessons_is_the_calling_teachers_count` | The denominator does not leak the other course's size |

Client: `students-list` and `progress` are the two components whose interaction changed. One spec
each — clicking a row navigates; clicking the copy button does not.

---

## 7. Edge cases, and what each one shows

| Situation | Behaviour |
| :-- | :-- |
| No approved teachers at all | State panel empty state, "No teachers have been approved yet." |
| Approved teacher, zero lessons, zero students | The card renders with `0`s and `—` for pass rate. It is not hidden — the teacher is real |
| Zero marks recorded | Pass rate `—`, never `0%`, never `NaN` |
| Teacher has no photo | The existing deterministic initials tile — already the `AvatarComponent` default |
| Teacher approved, then rejected | Drops out of the directory on the next request; the photo route 404s and the card degrades to initials. Status is read fresh per call, as `ApprovedTeacherHandler` already does for policies |
| API unreachable on the public page | `error.interceptor` sets `offline: true`; the state panel shows the `cloud_off` branch with **Try again** |
| A student's session expires while the directory is open | The `/student/courses` enrolment call 401s → `expireSession` bounces to `/login` with a `returnUrl`. The directory itself is anonymous and would have rendered regardless |
| Teacher clicks a row for a student who un-enrolled in another tab | 404 → the state panel's error branch with **Try again**, via the existing `problemFrom` path |
| Long teacher name / long bio | Cards use `min-width: 0`; the bio clamps at three lines with `-webkit-line-clamp` |
| Directory on a 360 px phone | The card grid is already `auto-fill`; the roster and progress tables already use the `data-label` stacked-row pattern |

---

## 8. Build order

Each step leaves the app running and demonstrable.

1. **Server, part A** — `PublicTeacherDto` + the endpoint. Verify against
   `dotnet run -- seed --demo`: two approved teachers with four lessons each, one pending, one
   rejected. Confirm the pending and rejected teachers are absent.
2. **Server, photo route** — extract `ServeAvatar`, add the public action, prove the 404 for a
   pending teacher and for a student.
3. **Client, part A** — `PublicTeacher`, `photoBase`, `teachers.component.ts`, the `/teachers`
   route. Anonymous behaviour only; ship it before touching the student branch.
4. **Client, part A viewer branches** — the enrolled / not-enrolled card actions, the nav link, the
   home-page strip, the helper intent.
5. **Server, part B** — `StudentProfileDto` and the widened `Detail`. The old page still renders;
   the extra fields are simply unused for one commit.
6. **Client, part B** — the profile header and rollup, then the clickable rows on both tables.
7. **Tests** — the new public suite, the three isolation additions, the two component specs.
8. **`README.md`** — one line under the feature list; **`plan.md` appendix** — a note that the
   directory is the first anonymous read path beyond `/api/public/home`.

---

## 9. Deliberately not done

- **A public page per teacher** (`/teachers/:id` listing their lesson titles). It is the obvious
  next step, and it is a different privacy question — lesson titles are course content, and the
  whole timing design exists to control who sees content when. It needs its own decision, not an
  extension of this one.
- **Subjects, tags or ratings.** There is no subject on `Lesson` and no rating anywhere. Inventing
  either here would put a schema change inside a read-only feature.
- **Caching the directory response.** The aggregate query is four correlated counts over a table
  measured in tens of rows. Cache it when a measurement says to.
- **Letting a teacher edit a student's profile.** `DisplayName`, `Phone` and `Bio` belong to the
  student; `ProfileController` is where they are written, and it stays that way.
