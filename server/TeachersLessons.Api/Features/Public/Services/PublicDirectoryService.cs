namespace TeachersLessons.Api.Features.Public.Services;

public interface IPublicDirectoryService
{
    Task<HomeResponse> GetHomeAsync(CancellationToken ct);
    Task<PagedResult<PublicTeacherDto>> GetTeachersAsync(int? page, int? pageSize, string? q, CancellationToken ct);
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
    /// </summary>
    public async Task<PagedResult<PublicTeacherDto>> GetTeachersAsync(int? page, int? pageSize, string? q, CancellationToken ct)
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

        // Most open lessons first, then alphabetical: a newly approved teacher with nothing to
        // show lands at the bottom, so the first screen of the directory never looks empty.
        var items = await teachers
            .OrderByDescending(t => t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now))
            .ThenBy(t => t.User.FullName)
            .Skip((p - 1) * ps).Take(ps)
            .Select(t => new PublicTeacherDto(
                t.UserId,
                t.User.FullName,
                db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault(),
                t.User.CreatedAtUtc,
                // The same predicate LessonQueries.VisibleTo uses, so this count and the one a
                // student sees inside the course cannot drift apart.
                t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now),
                t.Lessons.Count(),
                t.Enrollments.Count(),
                t.Lessons.SelectMany(l => l.Marks).Count(),
                t.Lessons.SelectMany(l => l.Marks).Count(m => m.Score >= m.Lesson.PassMark)))
            .ToListAsync(ct);

        return new PagedResult<PublicTeacherDto> { Items = items, Page = p, PageSize = ps, Total = total };
    }
}
