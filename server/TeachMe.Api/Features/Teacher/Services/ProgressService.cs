namespace TeachMe.Api.Features.Teacher.Services;

public interface IProgressService
{
    Task<CursorPage<ProgressDto>> GetAsync(string? cursor, int? limit, string? q, string? state, CancellationToken ct);
}

public class ProgressService(AppDbContext db, ICurrentUser currentUser) : IProgressService
{
    /// <summary>
    /// One row per enrolled student, walked in the same order as the roster list so a cursor
    /// means the same thing on both screens. The marks and the photos are fetched for the slice
    /// only — the two follow-up queries are bounded by the page, not by the class size.
    ///
    /// <paramref name="q"/> matches a student's name, and <paramref name="state"/> narrows to
    /// where they have got to — nobody marked yet, part way, or every lesson marked. The state
    /// is decided in the database from the same count the rows carry, so a student cannot be
    /// filtered in as "complete" and then drawn as 3 of 8.
    /// </summary>
    public async Task<CursorPage<ProgressDto>> GetAsync(string? cursor, int? limit, string? q, string? state, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, RosterQueries.CursorFields);

        var totalLessons = await db.Lessons.CountAsync(l => l.TeacherUserId == teacherId, ct);

        var enrollments = db.Enrollments.Where(e => e.TeacherUserId == teacherId);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            enrollments = enrollments.Where(e => EF.Functions.Like(e.Student.User.FullName, $"%{term}%"));
        }

        // "Complete" means nothing in a course with no lessons in it, so it matches nobody
        // rather than everybody — which is what `marked >= totalLessons` would say for 0 >= 0.
        enrollments = state?.Trim().ToLowerInvariant() switch
        {
            "notstarted" => enrollments.Where(e => !e.Student.Marks.Any(m => m.Lesson.TeacherUserId == teacherId)),
            "inprogress" => enrollments.Where(e =>
                e.Student.Marks.Count(m => m.Lesson.TeacherUserId == teacherId) > 0
                && e.Student.Marks.Count(m => m.Lesson.TeacherUserId == teacherId) < totalLessons),
            "complete" => enrollments.Where(e =>
                totalLessons > 0
                && e.Student.Marks.Count(m => m.Lesson.TeacherUserId == teacherId) >= totalLessons),
            _ => enrollments
        };

        int? total = key is null ? await enrollments.CountAsync(ct) : null;

        var rows = await enrollments
            .RosterPage(key)
            .Take(take + 1)
            .Select(e => new { e.StudentUserId, e.Student.User.FullName })
            .ToListAsync(ct);

        var hasMore = rows.Count > take;
        var enrolled = hasMore ? rows[..take] : rows;

        var studentIds = enrolled.Select(e => e.StudentUserId).ToList();
        var marks = await db.Marks
            .Where(m => studentIds.Contains(m.StudentUserId) && m.Lesson.TeacherUserId == teacherId)
            .Select(m => new { m.StudentUserId, Passed = m.Score >= m.Lesson.PassMark })
            .ToListAsync(ct);

        var photoByStudent = (await db.Avatars
            .Where(a => studentIds.Contains(a.UserId))
            .Select(a => new { a.UserId, a.ETag })
            .ToListAsync(ct))
            .ToDictionary(x => x.UserId, x => x.ETag);

        var items = enrolled.Select(e =>
        {
            var studentMarks = marks.Where(m => m.StudentUserId == e.StudentUserId).ToList();
            return new ProgressDto(
                e.StudentUserId, e.FullName,
                photoByStudent.GetValueOrDefault(e.StudentUserId),
                studentMarks.Count, totalLessons,
                studentMarks.Count(m => m.Passed), studentMarks.Count(m => !m.Passed));
        }).ToList();

        return new CursorPage<ProgressDto>
        {
            Items = items,
            NextCursor = hasMore && enrolled.Count > 0
                ? RosterQueries.RosterCursor(enrolled[^1].FullName, enrolled[^1].StudentUserId)
                : null,
            Total = total
        };
    }
}
