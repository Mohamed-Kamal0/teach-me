namespace TeachMe.Api.Features.Student.Services;

public interface ICourseService
{
    Task<List<CourseSummaryDto>> ListAsync(CancellationToken ct);
    Task<CursorPage<StudentLessonWithMarkDto>> GetLessonsAsync(Guid teacherId, string? cursor, int? limit, string? q, string? state, CancellationToken ct);
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

    /// <summary>
    /// The lessons a student may see, in teaching order, a slice at a time. VisibleTo already
    /// orders by OrderIndex and already drops the unopened, so the cursor is that one number and
    /// a lesson the teacher opens mid-scroll simply appears in its place on a later slice.
    ///
    /// <paramref name="q"/> matches a title and <paramref name="state"/> keeps either the
    /// lessons that have been marked or the ones that have not. Both narrow the lessons *before*
    /// VisibleTo does, so what is withheld is still withheld — a search cannot reach past the
    /// one place that decides what a student may see.
    /// </summary>
    public async Task<CursorPage<StudentLessonWithMarkDto>> GetLessonsAsync(Guid teacherId, string? cursor, int? limit, string? q, string? state, CancellationToken ct)
    {
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, fields: 1);
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var candidates = db.Lessons.AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            candidates = candidates.Where(l => EF.Functions.Like(l.Title, $"%{term}%"));
        }

        // "Marked" is this student's own mark and nobody else's — the same rule the score on
        // each row is read under.
        candidates = state?.Trim().ToLowerInvariant() switch
        {
            "marked" => candidates.Where(l => l.Marks.Any(m => m.StudentUserId == studentId)),
            "unmarked" => candidates.Where(l => !l.Marks.Any(m => m.StudentUserId == studentId)),
            _ => candidates
        };

        var visible = candidates.VisibleTo(teacherId, now);

        int? total = key is null ? await visible.CountAsync(ct) : null;

        if (key is { } k)
        {
            var afterOrder = k.Int(0);
            visible = visible.Where(l => l.OrderIndex > afterOrder).OrderBy(l => l.OrderIndex);
        }

        var rows = await visible.Take(take + 1).ToListAsync(ct);
        var hasMore = rows.Count > take;
        var lessons = hasMore ? rows[..take] : rows;

        var lessonIds = lessons.Select(l => l.Id).ToList();
        var marks = await db.Marks
            .Where(m => m.StudentUserId == studentId && lessonIds.Contains(m.LessonId))
            .ToListAsync(ct);

        var items = lessons.Select(l =>
        {
            var mark = marks.FirstOrDefault(m => m.LessonId == l.Id);
            return new StudentLessonWithMarkDto(l, mark?.Score, mark is null ? null : mark.Score >= l.PassMark);
        }).ToList();

        return new CursorPage<StudentLessonWithMarkDto>
        {
            Items = items,
            NextCursor = hasMore && lessons.Count > 0 ? Cursor.Encode(lessons[^1].OrderIndex.ToString()) : null,
            Total = total
        };
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
