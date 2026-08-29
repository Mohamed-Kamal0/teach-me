# Media Plan — Profile Photos

> Companion to [`plan.md`](plan.md). `plan.md` decided the stack; this file decides how one new
> thing — a profile photo per person — is stored, served, processed and shown, without adding a
> service, a bucket or a secret to a project whose whole premise is "no engine to install".

**Stack touched:** EF Core (SQLite) · one new table · `SixLabors.ImageSharp` · Angular Material ·
one shared `AvatarComponent`.

---

## 1. The decision in one line

**Store each photo as re-encoded bytes in a dedicated `Avatars` table, serve it from one
cached endpoint, and fall back to a deterministic initials tile when there is no photo.**

No object storage, no CDN, no `wwwroot` upload folder.

### Why not S3 / R2 / GCS / Azure Blob

The app is one container + one SQLite file (persistent on the Fly volume, ephemeral by design on
Render / Cloud Run — see [`DEPLOY.md`](DEPLOY.md)). An external bucket would add an account, a
credential pair, a client library, a lifecycle policy and a second failure mode, to hold objects
that are ~10 KB each and number at most a few hundred. A `256×256` WebP is smaller than most rows
we already store as text. The bytes belong next to the data they describe.

### Why not a folder on disk

On Render / Cloud Run there is no disk. On Fly the volume exists but a loose file tree beside the
database is a second thing to back up, migrate and reason about. One store, one restore.

### Why a separate table, not a column on `Users`

`Users` is read on every authenticated request (`MeController`, `CurrentUser`, every policy). A
`byte[]` column there is pulled into memory on every one of those reads unless every query is
rewritten with an explicit projection. A 1:0..1 side table is loaded **only** by the endpoint that
serves the image.

---

## 2. Scope

| In | Out |
| :-- | :-- |
| One square photo per **user** (teachers *and* students) | Multiple photos, galleries, cover images |
| Upload, replace, remove | Cropping UI beyond a fixed centre-crop |
| Initials fallback with a stable colour | Gravatar / external avatar providers |
| Photo in: app bar, drawer, profile page, teacher's student roster + detail + progress, admin approvals | Lesson media (recordings/handouts stay URLs — `Lesson.cs` is unchanged) |
| Server re-encodes every upload to WebP | Serving the original bytes as uploaded |

The photo is a **User** property, not a Student one: teachers have photos too (a student sees the
teacher's photo on the course page; a teacher sees student photos in the roster).

---

## 3. Data model

New entity `Domain/Avatar.cs`:

```csharp
public class Avatar
{
    public Guid UserId { get; set; }          // PK and FK to User, 1:0..1
    public User User { get; set; } = null!;

    public byte[] Bytes { get; set; } = [];   // always WebP, always 256x256, produced by us
    public string ContentType { get; set; } = "image/webp";
    public int ByteSize { get; set; }
    public string ETag { get; set; } = string.Empty;   // "\"<32 hex>\"" — new value on every write
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
```

`Data/Configurations/AvatarConfiguration.cs`:

- `ToTable("Avatars")`, `HasKey(a => a.UserId)`.
- `HasOne(a => a.User).WithOne().HasForeignKey<Avatar>(a => a.UserId).OnDelete(DeleteBehavior.Cascade)`
  — deleting a user drops the photo.
- `Property(a => a.Bytes).IsRequired()` (SQLite `BLOB`).
- `Property(a => a.ContentType).HasMaxLength(40)`, `Property(a => a.ETag).HasMaxLength(40)`.
- Optional CHECK constraint `ByteSize <= 200000` — belt-and-braces; the processor already caps it.

`AppDbContext`: add `public DbSet<Avatar> Avatars => Set<Avatar>();`

Add a navigation on `User` **only if** a use case needs `Include` — none currently does, so leave
`User.cs` untouched and query `Avatars` directly by `UserId`.

Migration: `dotnet ef migrations add AddAvatars`. New table only; no change to any existing table,
so it applies cleanly on the Fly volume and is picked up by `db.Database.MigrateAsync()` on boot
(`Program.cs` already calls it).

---

## 4. Image processing

**Library: `SixLabors.ImageSharp` (>= 3.1).** Fully managed, no native dependency, runs the same on
the Windows dev box and the Linux container. `System.Drawing.Common` is out — unsupported on
non-Windows since .NET 7.

`Common/AvatarImageProcessor.cs`, registered `AddSingleton<IAvatarImageProcessor,...>()`:

```
Process(Stream upload) -> (byte[] webp, int width, int height)
  1. Image.Identify(stream)         — read header only; reject if it isn't a raster image
                                      or if width/height > 8000 (decompression-bomb guard)
  2. Image.Load(stream)             — decode
  3. mutate:
       - AutoOrient()               — honour EXIF rotation, then metadata is dropped on encode
       - Resize with ResizeMode.Crop to 256x256 (centre), Sampler = Lanczos3
  4. encode: WebpEncoder { Quality = 80, FileFormat = Lossy }
  5. if result > 200 KB, re-encode at Quality = 60 once; if still over, throw ValidationException
```

Re-encoding unconditionally is the security boundary: the bytes we store and serve are produced by
our encoder, never the caller's. That strips EXIF GPS, defuses polyglot files (a valid JPEG that is
also a valid HTML/JS payload), and makes "upload an SVG with a script" a non-question — SVG isn't a
raster format, step 1 rejects it.

Accepted upload types: `image/jpeg`, `image/png`, `image/webp`. Raw upload hard-capped at **5 MB**
via `[RequestSizeLimit(5_242_880)]` and `MultipartBodyLengthLimit`.

---

## 5. API

New `Features/Auth/PhotoController.cs` (sits with `MeController` — it's "my account").

| Route | Method | Auth | Notes |
| :-- | :-- | :-- | :-- |
| `/api/me/photo` | `PUT` | any authenticated user | `multipart/form-data`, field `file`. Antiforgery `X-XSRF-TOKEN` enforced by the existing `AntiforgeryMiddleware` (not on the exempt list — correct). Runs §4, upserts the `Avatars` row, returns `{ eTag, updatedAtUtc }`. |
| `/api/me/photo` | `DELETE` | any authenticated user | Deletes the row if present; `204` either way (idempotent). |
| `/api/users/{userId}/photo` | `GET` | any authenticated user | Streams the bytes. `Content-Type: image/webp`, `Cache-Control: private, max-age=300`, `ETag`, `X-Content-Type-Options: nosniff`. Honours `If-None-Match` → `304`. `404` when the user has no photo — the client treats 404 as "draw initials", so this is a normal path, logged at Debug not Warning. |

`GET` is authorated but not role-scoped: every signed-in user in this app can already see every
other participant's name in some view, and an `<img>` tag sends the session cookie on a same-origin
request, so it just works with no token plumbing. It is **not** `AllowAnonymous` — photos are not
public.

### Telling the client whether a photo exists

Add `photoETag: string | null` to the payloads that render a person:

- `MeResponse` (`MeController`) — drives the app bar / drawer.
- `ProfileDto` (`Features/Student/Dtos.cs`) — the profile page.
- The teacher's `StudentSummary` / `StudentGradeDetail` / `ProgressRow` DTOs — roster, detail,
  progress table.
- Admin `TeacherSummary` — approvals list.

`null` → render initials, skip the network call entirely. Non-null → `<img src="/api/users/{id}/photo?v={etag}">`;
the `?v=` busts the cache the instant a photo changes, and `max-age=300` covers the steady state.

Populate it with a cheap projection, e.g.
`db.Avatars.Where(a => a.UserId == id).Select(a => a.ETag).FirstOrDefault()`, or a single
`.Select` join when building a list.

---

## 6. Frontend

### `shared/avatar.component.ts` — one component, used everywhere

```
@Input() userId!: string;
@Input() name = '';           // for initials + alt text
@Input() photoETag: string | null = null;
@Input() size: 'sm' | 'md' | 'lg' = 'md';   // 32 / 48 / 96 px
```

- `photoETag` set → `<img [src]="'/api/users/' + userId + '/photo?v=' + photoETag" [alt]="name">`
  with `(error)` swapping to the initials tile (covers a race where the row was deleted between
  payload and paint).
- `photoETag` null → initials tile: up to two initials from `name`, background colour picked by
  `hashHue(userId)` (stable per person, ~12 hues), foreground white/near-black for contrast.
- `loading="lazy"`, `decoding="async"`, fixed width/height to avoid layout shift.

Drop it into: `app.component.html` (the `account_circle` button and the drawer head), the profile
page, `students-list`, `student-detail`, `progress`, `approvals`.

### Profile page — the upload UI

`features/student/profile.component.ts` already has an "Account" card. Add a **Photo** card
beside it:

- Current `<app-avatar size="lg">`.
- "Upload photo" → hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`.
- On pick: client-side downscale through a `<canvas>` to ≤ `1024×1024` before `PUT` (keeps a phone
  photo from being a 8 MB upload; the server still re-processes and remains the source of truth).
  Show a local `URL.createObjectURL` preview immediately.
- `PUT /api/me/photo` as `FormData`. On success: `auth.refreshMe()` so the app bar updates, then
  `notify.success('Updated your photo.')`.
- "Remove photo" (only when one exists) → `DELETE`, then `auth.refreshMe()`.
- Client-side guardrails mirroring the server: reject > 5 MB or wrong type before sending, with the
  same wording the server would return.

### Teachers need this page too

Today only students have `/student/profile` (`app.routes.ts`). Add `/teacher/profile`
(`roleGuard('Teacher')`) rendering the **same Photo card** (extract it into
`shared/photo-card.component.ts`), plus name/email read-only. Link it from the account `mat-menu`
in `app.component.html` for every role. Full teacher profile fields are out of scope — just the
photo.

### `AuthService` / `models.ts`

- `MeResponse` gains `photoETag: string | null`.
- `Profile`, `StudentSummary`, `StudentGradeDetail`, `ProgressRow`, `TeacherSummary` gain the same.
- No new service; components call `HttpClient` directly, as the rest of the app does.

---

## 7. Seeding

`DemoSeeder` leaves avatars empty — the initials tiles make the demo look finished on their own and
keep the seed fast. If a populated look is wanted later, embed two or three ~8 KB WebPs as base64
constants and attach them to a couple of demo teachers; do **not** pull images over the network at
seed time.

---

## 8. Security checklist

- [x] Every stored/served byte is produced by our encoder — original upload bytes never leave the request.
- [x] Header-only `Image.Identify` + dimension ceiling before full decode (bomb guard).
- [x] `image/svg+xml` and every non-raster type rejected at step 1.
- [x] Raw upload capped at 5 MB (`RequestSizeLimit` + multipart limit); processed output capped at 200 KB.
- [x] Response `Content-Type` hard-coded `image/webp` + `X-Content-Type-Options: nosniff`.
- [x] `PUT` / `DELETE` covered by existing antiforgery middleware.
- [x] `GET` requires authentication; not public, not role-bound.
- [x] `Cache-Control: private` so a shared proxy never keeps one user's photo.
- [ ] Rate limiting on `PUT` — not implemented at this scope; note it if abuse appears.

---

## 9. Tests

`server/TeachMe.Api.Tests`:

- **`AvatarImageProcessorTests`** — a 4000×1000 PNG becomes a 256×256 WebP; a text file throws
  `ValidationException`; a 12000×12000 header is rejected without a full decode; centre-crop keeps
  the middle of a wide image.
- **`AvatarEndpointTests`** (`WebApplicationFactory`):
  - `PUT` a valid PNG → `200` + ETag; `GET /api/users/{me}/photo` → `200`, `image/webp`.
  - `GET` again with `If-None-Match: <etag>` → `304`.
  - `DELETE` → `204`; subsequent `GET` → `404`.
  - `GET` while unauthenticated → `401`.
  - `PUT` without `X-XSRF-TOKEN` → `400` (antiforgery).
  - `PUT` a 6 MB body → `413`.

Client: an `AvatarComponent` spec — renders `<img>` with the `?v=` param when `photoETag` is set,
renders initials + a stable hue when it is null, falls back to initials on `img` error.

---

## 10. Build order

1. Add `SixLabors.ImageSharp` to `TeachMe.Api.csproj`.
2. `Domain/Avatar.cs` + `AvatarConfiguration` + `DbSet` + `dotnet ef migrations add AddAvatars`.
3. `AvatarImageProcessor` + DI registration + its unit tests.
4. `PhotoController` (`PUT` / `DELETE` / `GET`) + endpoint tests.
5. Add `photoETag` to `MeResponse`, `ProfileDto`, and the teacher/admin list DTOs + their queries.
6. `models.ts` updates; `shared/avatar.component.ts`; wire into `app.component.html` + drawer.
7. `shared/photo-card.component.ts`; add it to the student profile page; `auth.refreshMe()` on change.
8. `/teacher/profile` route + component reusing the photo card; link from the account menu.
9. Drop `<app-avatar>` into roster, student-detail, progress, approvals.
10. Deploy. On Fly: upload a photo, `fly apps restart`, reload — the photo is still there (same
    proof as the lesson-persistence check in `DEPLOY.md`). On Render / Cloud Run it resets with the
    rest of the demo data, as expected.

---

## 11. Rollback

The feature is additive: one table, one controller, one nullable field on five DTOs, one shared
component. To disable without reverting code, stop rendering `<app-avatar>` and hide the photo card;
the `Avatars` table can be left in place or dropped with a down-migration. Nothing in auth, lessons
or marking depends on it.
