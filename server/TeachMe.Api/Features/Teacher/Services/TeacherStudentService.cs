namespace TeachMe.Api.Features.Teacher.Services;

public interface ITeacherStudentService
{
    Task<TeacherStudentsResponse> ListAsync(int? page, int? pageSize, CancellationToken ct);
    Task<StudentProfileDto> GetProfileAsync(Guid studentId, CancellationToken ct);
}

public class TeacherStudentService(AppDbContext db, ICurrentUser currentUser) : ITeacherStudentService
{
    public async Task<TeacherStudentsResponse> ListAsync(int? page, int? pageSize, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);

        var joinCode = await db.Teachers.Where(t => t.UserId == teacherId).Select(t => t.JoinCode).FirstAsync(ct);

        var query = db.Enrollments
            .Where(e => e.TeacherUserId == teacherId)
            .OrderBy(e => e.Student.User.FullName);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((p - 1) * ps).Take(ps)
            .Select(e => new StudentSummaryDto(
                e.StudentUserId, e.Student.User.FullName, e.Student.User.Email, e.JoinedAtUtc,
                db.Avatars.Where(a => a.UserId == e.StudentUserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        return new TeacherStudentsResponse(
            joinCode,
            new PagedResult<StudentSummaryDto> { Items = items, Page = p, PageSize = ps, Total = total });
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
