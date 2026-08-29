using TeachMe.Api.Features.Student.Services;

namespace TeachMe.Api.Features.Helper.Services;

public interface IStudentContextPackBuilder
{
    Task<ContextPack> BuildAsync(CancellationToken ct);
}

/// <summary>
/// Everything here comes from a query the student could have run themselves: lessons through
/// <c>LessonQueries.VisibleTo</c>, marks from their own Marks rows, courses from their own
/// Enrollments, "new since last visit" from the same service behind /student/whats-new. Adding a
/// field that does not come from one of those is how this feature starts leaking — VisibleTo is
/// the only door, and there is deliberately no second one.
/// </summary>
public class StudentContextPackBuilder(
    AppDbContext db,
    ICurrentUser currentUser,
    TimeProvider clock,
    IWhatsNewService whatsNew) : IStudentContextPackBuilder
{
    public async Task<ContextPack> BuildAsync(CancellationToken ct)
    {
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        // The name the student answers to: what they put on their profile, falling back to the
        // one they registered under. The helper greets them by it, so reading the registration
        // name alone made the answer address them by a name they had already replaced.
        var names = await db.Students
            .Where(s => s.UserId == studentId)
            .Select(s => new { s.DisplayName, s.User.FullName })
            .FirstOrDefaultAsync(ct);
        var name = (string.IsNullOrWhiteSpace(names?.DisplayName) ? names?.FullName : names.DisplayName) ?? string.Empty;

        var enrollments = await db.Enrollments
            .Where(e => e.StudentUserId == studentId)
            .Select(e => new { e.TeacherUserId, TeacherFullName = e.Teacher.User.FullName, e.JoinedAtUtc })
            .ToListAsync(ct);

        // This student's own marks, and nothing else's — the same rows /student/marks returns.
        var myMarks = await db.Marks
            .Where(m => m.StudentUserId == studentId)
            .Select(m => new { m.LessonId, m.Score, m.RecordedAtUtc, m.Lesson.PassMark })
            .ToListAsync(ct);

        var courses = new List<ContextCourse>();
        foreach (var enrollment in enrollments.OrderBy(e => e.JoinedAtUtc))
        {
            var lessons = await db.Lessons.VisibleTo(enrollment.TeacherUserId, now).ToListAsync(ct);

            var rows = lessons.Select(lesson =>
            {
                var mark = myMarks.FirstOrDefault(m => m.LessonId == lesson.Id);
                return new ContextLesson(
                    lesson.Title,
                    lesson.OrderIndex,
                    HasRecording: !string.IsNullOrWhiteSpace(lesson.RecordingUrl),
                    HasHandout: !string.IsNullOrWhiteSpace(lesson.HandoutUrl),
                    // VisibleTo already nulled these when their moment had not come, so the
                    // boolean is the projection's decision, not a second one taken here.
                    QuizOpen: lesson.QuizUrl is not null,
                    AnswersOpen: lesson.AnswersUrl is not null,
                    MyScore: mark?.Score,
                    OutOf: lesson.QuizMaxScore,
                    PassMark: lesson.PassMark,
                    Passed: mark is null ? null : mark.Score >= lesson.PassMark);
            }).ToList();

            courses.Add(new ContextCourse(
                enrollment.TeacherUserId,
                enrollment.TeacherFullName,
                enrollment.JoinedAtUtc,
                rows.Count,
                rows));
        }

        var newSinceLastVisit = (await whatsNew.GetAsync(ct)).TotalNew;

        var marks = new ContextMarks(
            Graded: myMarks.Count,
            Passed: myMarks.Count(m => m.Score >= m.PassMark),
            LastRecordedAtUtc: myMarks.Count == 0 ? null : myMarks.Max(m => m.RecordedAtUtc));

        return new ContextPack(
            now,
            new ContextStudent(name, courses.Count, newSinceLastVisit),
            courses,
            marks);
    }
}
