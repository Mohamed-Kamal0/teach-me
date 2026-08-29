namespace TeachMe.Api.Features.Student.Services;

public interface IStudentMarkService
{
    Task<List<StudentMarkDto>> ListAsync(CancellationToken ct);
}

public class StudentMarkService(AppDbContext db, ICurrentUser currentUser) : IStudentMarkService
{
    public async Task<List<StudentMarkDto>> ListAsync(CancellationToken ct)
    {
        var studentId = currentUser.UserId;

        return (await db.Marks
            .Where(m => m.StudentUserId == studentId)
            .Select(m => new StudentMarkDto(
                m.LessonId, m.Lesson.Title, m.Lesson.TeacherUserId, m.Lesson.Teacher.User.FullName,
                m.Score, m.Lesson.QuizMaxScore, m.Lesson.PassMark, m.Score >= m.Lesson.PassMark, m.RecordedAtUtc))
            .ToListAsync(ct))
            .OrderBy(m => m.RecordedAtUtc)
            .ToList();
    }
}
