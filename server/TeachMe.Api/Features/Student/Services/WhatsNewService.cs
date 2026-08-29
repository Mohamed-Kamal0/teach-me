namespace TeachMe.Api.Features.Student.Services;

public interface IWhatsNewService
{
    Task<WhatsNewResponse> GetAsync(CancellationToken ct);
}

public class WhatsNewService(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : IWhatsNewService
{
    public async Task<WhatsNewResponse> GetAsync(CancellationToken ct)
    {
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var enrollments = await db.Enrollments
            .Where(e => e.StudentUserId == studentId)
            .Select(e => new { e.TeacherUserId, TeacherFullName = e.Teacher.User.FullName, e.LastViewedAtUtc })
            .ToListAsync(ct);

        var courses = new List<WhatsNewCourseDto>();
        var totalNew = 0;

        foreach (var enrollment in enrollments)
        {
            if (enrollment.LastViewedAtUtc is null)
            {
                courses.Add(new WhatsNewCourseDto(enrollment.TeacherUserId, enrollment.TeacherFullName, Welcome: true, []));
                continue;
            }

            var since = enrollment.LastViewedAtUtc.Value;

            var lessons = await db.Lessons
                .Where(l => l.TeacherUserId == enrollment.TeacherUserId)
                .Select(l => new { l.Id, l.Title, l.OpensAtUtc, l.QuizOpensAtUtc, l.AnswersOpenAtUtc })
                .ToListAsync(ct);

            var entries = new List<WhatsNewLessonEntry>();
            foreach (var lesson in lessons)
            {
                if (JustOpened(lesson.OpensAtUtc, since, now))
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "lesson"));
                }
                if (JustOpened(lesson.QuizOpensAtUtc, since, now))
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "quiz"));
                }
                if (JustOpened(lesson.AnswersOpenAtUtc, since, now))
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "answers"));
                }
            }

            totalNew += entries.Count;
            courses.Add(new WhatsNewCourseDto(enrollment.TeacherUserId, enrollment.TeacherFullName, Welcome: false, entries));
        }

        return new WhatsNewResponse(totalNew, courses);
    }

    /// <summary>Opened after the student last looked, and not still in the future.</summary>
    private static bool JustOpened(DateTimeOffset? opensAt, DateTimeOffset since, DateTimeOffset now) =>
        opensAt is not null && opensAt > since && opensAt <= now;
}
