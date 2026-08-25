using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Student;

[ApiController]
[Route("api/student/marks")]
[Authorize(Policy = PolicyNames.Student)]
public class MarksController(AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<StudentMarkDto>>> Get(CancellationToken ct)
    {
        var studentId = currentUser.UserId;

        var marks = (await db.Marks
            .Where(m => m.StudentUserId == studentId)
            .Select(m => new StudentMarkDto(
                m.LessonId, m.Lesson.Title, m.Lesson.TeacherUserId, m.Lesson.Teacher.User.FullName,
                m.Score, m.Lesson.QuizMaxScore, m.Lesson.PassMark, m.Score >= m.Lesson.PassMark, m.RecordedAtUtc))
            .ToListAsync(ct))
            .OrderBy(m => m.RecordedAtUtc)
            .ToList();

        return Ok(marks);
    }
}
