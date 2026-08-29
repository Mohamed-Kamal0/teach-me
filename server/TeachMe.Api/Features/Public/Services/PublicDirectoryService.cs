namespace TeachMe.Api.Features.Public.Services;

public interface IPublicDirectoryService
{
    Task<HomeResponse> GetHomeAsync(CancellationToken ct);
    Task<CursorPage<PublicTeacherDto>> GetTeachersAsync(string? cursor, int? limit, string? q, CancellationToken ct);
}

public class PublicDirectoryService(AppDbContext db, TimeProvider clock) : IPublicDirectoryService
{
    public async Task<HomeResponse> GetHomeAsync(CancellationToken ct)
    {
        var approvedTeacherCount = await db.Teachers.CountAsync(t => t.Status == TeacherStatus.Approved, ct);
        var lessonCount = await db.Lessons.CountAsync(ct);

        return new HomeResponse(
            approvedTeacherCount,
            lessonCount,
            "Ask your teacher for their joining code, then enter it from your student profile.");
    }

    /// <summary>
    /// The public directory. Approved teachers only — pending and rejected are not a public
    /// record. Pass rate is not computed here: a course with no marks has no pass rate, and "—"
    /// is a rendering decision, not a number the server should invent.
    ///
    /// <paramref name="q"/> matches a name or a subject. It stays a substring match rather than a
    /// prefix one because "algebra" should find "Mathematics and Algebra", and the directory is
    /// small enough that the scan an unanchored LIKE forces is not a cost worth designing around.
    ///
    /// Paged by cursor over (open lessons desc, name, id) — the same three keys the rows are
    /// ordered by, which is what makes resuming exact. The open-lesson count is recomputed in the
    /// resume predicate rather than trusted from the cursor, so a teacher who published a lesson
    /// mid-scroll moves to where they now belong instead of appearing twice.
    /// </summary>
    public async Task<CursorPage<PublicTeacherDto>> GetTeachersAsync(string? cursor, int? limit, string? q, CancellationToken ct)
    {
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, fields: 3);
        var now = clock.GetUtcNow();

        var teachers = db.Teachers.Where(t => t.Status == TeacherStatus.Approved);

        // One box, two fields: somebody looking for a teacher knows either the person or the
        // subject, rarely both, and asking them which of the two they typed is a question the
        // server can answer itself. OR rather than two parameters for the same reason — a
        // second box would make the visitor choose before they have any results to choose from.
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            teachers = teachers.Where(t =>
                EF.Functions.Like(t.User.FullName, $"%{term}%") ||
                (t.Subject != null && EF.Functions.Like(t.Subject, $"%{term}%")));
        }

        // The count belongs to the search, not to the slice, so it is answered once — the first
        // request — and the client carries it down the rest of the scroll.
        int? total = key is null ? await teachers.CountAsync(ct) : null;

        // Most open lessons first, then alphabetical: a newly approved teacher with nothing to
        // show lands at the bottom, so the first screen of the directory never looks empty.
        var ranked = teachers.Select(t => new
        {
            Teacher = t,
            // The same predicate LessonQueries.VisibleTo uses, so this count and the one a
            // student sees inside the course cannot drift apart.
            OpenLessons = t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now)
        });

        if (key is { } k)
        {
            var afterOpen = k.Int(0);
            var afterName = k.Text(1);
            var afterId = k.Uuid(2);

            ranked = ranked.Where(x =>
                x.OpenLessons < afterOpen
                || (x.OpenLessons == afterOpen
                    && (string.Compare(x.Teacher.User.FullName, afterName) > 0
                        || (x.Teacher.User.FullName == afterName && x.Teacher.UserId.CompareTo(afterId) > 0))));
        }

        var rows = await ranked
            .OrderByDescending(x => x.OpenLessons)
            .ThenBy(x => x.Teacher.User.FullName)
            .ThenBy(x => x.Teacher.UserId)
            .Take(take + 1)
            .Select(x => new
            {
                x.OpenLessons,
                Dto = new PublicTeacherDto(
                    x.Teacher.UserId,
                    x.Teacher.User.FullName,
                    x.Teacher.Subject,
                    x.Teacher.Phone,
                    db.Avatars.Where(a => a.UserId == x.Teacher.UserId).Select(a => a.ETag).FirstOrDefault(),
                    x.Teacher.User.CreatedAtUtc,
                    x.OpenLessons,
                    x.Teacher.Lessons.Count(),
                    x.Teacher.Enrollments.Count(),
                    x.Teacher.Lessons.SelectMany(l => l.Marks).Count(),
                    x.Teacher.Lessons.SelectMany(l => l.Marks).Count(m => m.Score >= m.Lesson.PassMark))
            })
            .ToListAsync(ct);

        // One row past the slice is how "is there more" gets answered without a second count.
        var hasMore = rows.Count > take;
        var page = hasMore ? rows[..take] : rows;

        return new CursorPage<PublicTeacherDto>
        {
            Items = page.Select(r => r.Dto).ToList(),
            NextCursor = hasMore && page.Count > 0
                ? Cursor.Encode(
                    page[^1].OpenLessons.ToString(),
                    page[^1].Dto.FullName,
                    page[^1].Dto.UserId.ToString())
                : null,
            Total = total
        };
    }
}
