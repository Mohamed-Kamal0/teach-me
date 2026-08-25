using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Student;

[ApiController]
[Route("api/student/whats-new")]
[Authorize(Policy = PolicyNames.Student)]
public class WhatsNewController(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WhatsNewResponse>> Get(CancellationToken ct)
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
                if (lesson.OpensAtUtc is not null && lesson.OpensAtUtc > since && lesson.OpensAtUtc <= now)
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "lesson"));
                }
                if (lesson.QuizOpensAtUtc is not null && lesson.QuizOpensAtUtc > since && lesson.QuizOpensAtUtc <= now)
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "quiz"));
                }
                if (lesson.AnswersOpenAtUtc is not null && lesson.AnswersOpenAtUtc > since && lesson.AnswersOpenAtUtc <= now)
                {
                    entries.Add(new WhatsNewLessonEntry(lesson.Id, lesson.Title, "answers"));
                }
            }

            totalNew += entries.Count;
            courses.Add(new WhatsNewCourseDto(enrollment.TeacherUserId, enrollment.TeacherFullName, Welcome: false, entries));
        }

        return Ok(new WhatsNewResponse(totalNew, courses));
    }
}
