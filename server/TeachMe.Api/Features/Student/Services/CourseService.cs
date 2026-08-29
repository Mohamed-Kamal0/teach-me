namespace TeachMe.Api.Features.Student.Services;

public interface ICourseService
{
    Task<List<CourseSummaryDto>> ListAsync(CancellationToken ct);
    Task<PagedResult<StudentLessonWithMarkDto>> GetLessonsAsync(Guid teacherId, int? page, int? pageSize, CancellationToken ct);
    Task<StudentLessonWithMarkDto> GetLessonAsync(Guid teacherId, Guid lessonId, CancellationToken ct);
    Task MarkSeenAsync(Guid teacherId, CancellationToken ct);
}

public class CourseService(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ICourseService
{
    public async Task<List<CourseSummaryDto>> ListAsync(CancellationToken ct)
    {
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var courses = await db.Enrollments
            .Where(e => e.StudentUserId == studentId)
            .Select(e => new
            {
                e.TeacherUserId,
                TeacherFullName = e.Teacher.User.FullName,
                e.JoinedAtUtc
            })
            .ToListAsync(ct);

        var result = new List<CourseSummaryDto>();
        foreach (var c in courses.OrderBy(c => c.JoinedAtUtc))
        {
            var lessonCount = await db.Lessons.VisibleTo(c.TeacherUserId, now).CountAsync(ct);
            result.Add(new CourseSummaryDto(c.TeacherUserId, c.TeacherFullName, c.JoinedAtUtc, lessonCount));
        }

        return result;
    }

    public async Task<PagedResult<StudentLessonWithMarkDto>> GetLessonsAsync(Guid teacherId, int? page, int? pageSize, CancellationToken ct)
    {
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var query = db.Lessons.VisibleTo(teacherId, now);
        var total = await query.CountAsync(ct);
        var lessons = await query.Skip((p - 1) * ps).Take(ps).ToListAsync(ct);

        var lessonIds = lessons.Select(l => l.Id).ToList();
        var marks = await db.Marks
            .Where(m => m.StudentUserId == studentId && lessonIds.Contains(m.LessonId))
            .ToListAsync(ct);

        var items = lessons.Select(l =>
        {
            var mark = marks.FirstOrDefault(m => m.LessonId == l.Id);
            return new StudentLessonWithMarkDto(l, mark?.Score, mark is null ? null : mark.Score >= l.PassMark);
        }).ToList();

        return new PagedResult<StudentLessonWithMarkDto> { Items = items, Page = p, PageSize = ps, Total = total };
    }

    public async Task<StudentLessonWithMarkDto> GetLessonAsync(Guid teacherId, Guid lessonId, CancellationToken ct)
    {
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var lesson = await db.Lessons.VisibleTo(teacherId, now).FirstOrDefaultAsync(l => l.Id == lessonId, ct);
        if (lesson is null)
        {
            throw new NotFoundApiException();
        }

        var mark = await db.Marks.FirstOrDefaultAsync(m => m.StudentUserId == studentId && m.LessonId == lessonId, ct);

        return new StudentLessonWithMarkDto(lesson, mark?.Score, mark is null ? null : mark.Score >= lesson.PassMark);
    }

    public async Task MarkSeenAsync(Guid teacherId, CancellationToken ct)
    {
        var studentId = currentUser.UserId;

        var enrollment = await db.Enrollments.FirstAsync(e => e.StudentUserId == studentId && e.TeacherUserId == teacherId, ct);
        enrollment.LastViewedAtUtc = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }
}
