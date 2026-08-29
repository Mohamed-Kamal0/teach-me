namespace TeachMe.Api.Features.Teacher.Services;

public interface IMarkService
{
    Task<MarkDto> RecordAsync(RecordMarkRequest request, CancellationToken ct);
    Task<MarkDto> UpdateAsync(Guid id, UpdateMarkRequest request, CancellationToken ct);
}

public class MarkService(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : IMarkService
{
    private const string DuplicateMessage = "This student already has a mark for this lesson — edit that one.";

    public async Task<MarkDto> RecordAsync(RecordMarkRequest request, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        // M1 — the lesson must belong to the calling teacher.
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == request.LessonId && l.TeacherUserId == teacherId, ct);
        if (lesson is null)
        {
            throw new NotFoundApiException();
        }

        // M2 — the student must be enrolled with the calling teacher.
        var enrolled = await db.Enrollments.AnyAsync(e => e.TeacherUserId == teacherId && e.StudentUserId == request.StudentUserId, ct);
        if (!enrolled)
        {
            throw new NotFoundApiException();
        }

        // M3 — the bound is read from the lesson, not the code.
        EnsureScoreInRange(request.Score, lesson.QuizMaxScore);

        // M4 — no second mark for the same student on the same lesson.
        var exists = await db.Marks.AnyAsync(m => m.LessonId == request.LessonId && m.StudentUserId == request.StudentUserId, ct);
        if (exists)
        {
            throw new ConflictApiException(DuplicateMessage);
        }

        var mark = new Mark
        {
            Id = Guid.CreateVersion7(),
            LessonId = request.LessonId,
            StudentUserId = request.StudentUserId,
            Score = request.Score,
            RecordedAtUtc = clock.GetUtcNow()
        };

        db.Marks.Add(mark);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ConflictApiException(DuplicateMessage);
        }

        return ToDto(mark, lesson);
    }

    public async Task<MarkDto> UpdateAsync(Guid id, UpdateMarkRequest request, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        var mark = await db.Marks.Include(m => m.Lesson)
            .FirstOrDefaultAsync(m => m.Id == id && m.Lesson.TeacherUserId == teacherId, ct);
        if (mark is null)
        {
            throw new NotFoundApiException();
        }

        EnsureScoreInRange(request.Score, mark.Lesson.QuizMaxScore);

        mark.Score = request.Score;
        mark.UpdatedAtUtc = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        return ToDto(mark, mark.Lesson);
    }

    private static void EnsureScoreInRange(int score, int quizMaxScore)
    {
        if (score < 0 || score > quizMaxScore)
        {
            throw new ValidationApiException("score", $"Score must be between 0 and {quizMaxScore}.");
        }
    }

    private static MarkDto ToDto(Mark m, Lesson l) =>
        new(m.Id, m.LessonId, m.StudentUserId, m.Score, m.Score >= l.PassMark, m.RecordedAtUtc, m.UpdatedAtUtc);
}
