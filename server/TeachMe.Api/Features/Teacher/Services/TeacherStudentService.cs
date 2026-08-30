namespace TeachMe.Api.Features.Teacher.Services;

public interface ITeacherStudentService
{
    Task<TeacherStudentsResponse> ListAsync(string? cursor, int? limit, string? q, CancellationToken ct);
    Task<StudentProfileDto> GetProfileAsync(Guid studentId, CancellationToken ct);
}

public class TeacherStudentService(AppDbContext db, ICurrentUser currentUser) : ITeacherStudentService
{
    /// <summary>
    /// The roster, a slice at a time, in the order <see cref="RosterQueries"/> fixes. The join
    /// code rides along on every slice rather than only the first: it is the one thing on the
    /// screen that is not a row, and re-sending a six-character string costs less than the
    /// branch that would avoid it.
    ///
    /// <paramref name="q"/> matches a name or an email address — one box, because a teacher
    /// hunting for somebody types whichever of the two they can remember. It narrows the roster
    /// before the cursor does its work, so the walk is over the matches and the total is the
    /// number of them.
    /// </summary>
    public async Task<TeacherStudentsResponse> ListAsync(string? cursor, int? limit, string? q, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, RosterQueries.CursorFields);

        var joinCode = await db.Teachers.Where(t => t.UserId == teacherId).Select(t => t.JoinCode).FirstAsync(ct);

        var enrollments = db.Enrollments.Where(e => e.TeacherUserId == teacherId);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            enrollments = enrollments.Where(e =>
                EF.Functions.Like(e.Student.User.FullName, $"%{term}%") ||
                EF.Functions.Like(e.Student.User.Email, $"%{term}%"));
        }

        int? total = key is null ? await enrollments.CountAsync(ct) : null;

        // One row past the slice: present means there is more to fetch, and it is dropped
        // before anything is sent.
        var rows = await enrollments
            .RosterPage(key)
            .Take(take + 1)
            .Select(e => new StudentSummaryDto(
                e.StudentUserId, e.Student.User.FullName, e.Student.User.Email, e.JoinedAtUtc,
                db.Avatars.Where(a => a.UserId == e.StudentUserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        var hasMore = rows.Count > take;
        var items = hasMore ? rows[..take] : rows;

        return new TeacherStudentsResponse(
            joinCode,
            new CursorPage<StudentSummaryDto>
            {
                Items = items,
                NextCursor = hasMore && items.Count > 0
                    ? RosterQueries.RosterCursor(items[^1].FullName, items[^1].UserId)
                    : null,
                Total = total
            });
    }

    /// <summary>
    /// Three isolation rules hold here and must survive any later edit: a student the caller
    /// never enrolled is a 404 and not a 403 (no existence oracle); the marks are filtered by
    /// the caller's own lessons, so a student on two courses shows each teacher only their own;
    /// and TotalLessons counts the caller's lessons only, so the denominator cannot leak the
    /// size of another teacher's course.
    /// </summary>
    public async Task<StudentProfileDto> GetProfileAsync(Guid studentId, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

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

        if (enrollment is null)
        {
            throw new NotFoundApiException();
        }

        var marks = await db.Marks
            .Where(m => m.StudentUserId == studentId && m.Lesson.TeacherUserId == teacherId)
            .OrderBy(m => m.Lesson.OrderIndex)
            .Select(m => new LessonMarkDto(
                m.LessonId, m.Lesson.Title, m.Lesson.OrderIndex, m.Lesson.QuizMaxScore, m.Lesson.PassMark,
                m.Score, m.Score >= m.Lesson.PassMark, m.RecordedAtUtc, m.UpdatedAtUtc, m.Id))
            .ToListAsync(ct);

        // Counted the way ProgressService counts it, so "3 of 8 marked" here and the progress
        // bar on the progress table cannot disagree.
        var totalLessons = await db.Lessons.CountAsync(l => l.TeacherUserId == teacherId, ct);

        return new StudentProfileDto(
            studentId, enrollment.FullName, enrollment.DisplayName, enrollment.Email,
            enrollment.Phone, enrollment.Bio, enrollment.PhotoETag, enrollment.JoinedAtUtc,
            totalLessons, marks.Count, marks.Count(m => m.Passed), marks.Count(m => !m.Passed),
            marks);
    }
}
