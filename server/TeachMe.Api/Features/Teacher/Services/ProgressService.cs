namespace TeachMe.Api.Features.Teacher.Services;

public interface IProgressService
{
    Task<PagedResult<ProgressDto>> GetAsync(int? page, int? pageSize, CancellationToken ct);
}

public class ProgressService(AppDbContext db, ICurrentUser currentUser) : IProgressService
{
    public async Task<PagedResult<ProgressDto>> GetAsync(int? page, int? pageSize, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);

        var totalLessons = await db.Lessons.CountAsync(l => l.TeacherUserId == teacherId, ct);

        var query = db.Enrollments
            .Where(e => e.TeacherUserId == teacherId)
            .OrderBy(e => e.Student.User.FullName);

        var total = await query.CountAsync(ct);

        var enrolled = await query.Skip((p - 1) * ps).Take(ps)
            .Select(e => new { e.StudentUserId, e.Student.User.FullName })
            .ToListAsync(ct);

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

        return new PagedResult<ProgressDto> { Items = items, Page = p, PageSize = ps, Total = total };
    }
}
