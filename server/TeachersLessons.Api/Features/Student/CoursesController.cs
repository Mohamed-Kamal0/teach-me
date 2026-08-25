using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Student;

[ApiController]
[Route("api/student/courses")]
[Authorize(Policy = PolicyNames.Student)]
public class CoursesController(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CourseSummaryDto>>> List(CancellationToken ct)
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
        courses = courses.OrderBy(c => c.JoinedAtUtc).ToList();

        var result = new List<CourseSummaryDto>();
        foreach (var c in courses)
        {
            var lessonCount = await db.Lessons.VisibleTo(c.TeacherUserId, now).CountAsync(ct);
            result.Add(new CourseSummaryDto(c.TeacherUserId, c.TeacherFullName, c.JoinedAtUtc, lessonCount));
        }

        return Ok(result);
    }

    [HttpGet("{teacherId:guid}/lessons")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<ActionResult<PagedResult<StudentLessonWithMarkDto>>> Lessons(
        Guid teacherId, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct)
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

        return Ok(new PagedResult<StudentLessonWithMarkDto> { Items = items, Page = p, PageSize = ps, Total = total });
    }

    [HttpGet("{teacherId:guid}/lessons/{id:guid}")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<ActionResult<StudentLessonWithMarkDto>> LessonDetail(Guid teacherId, Guid id, CancellationToken ct)
    {
        var studentId = currentUser.UserId;
        var now = clock.GetUtcNow();

        var lesson = await db.Lessons.VisibleTo(teacherId, now).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lesson is null)
        {
            throw new NotFoundApiException();
        }

        var mark = await db.Marks.FirstOrDefaultAsync(m => m.StudentUserId == studentId && m.LessonId == id, ct);

        return Ok(new StudentLessonWithMarkDto(lesson, mark?.Score, mark is null ? null : mark.Score >= lesson.PassMark));
    }

    [HttpPost("{teacherId:guid}/seen")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<IActionResult> MarkSeen(Guid teacherId, CancellationToken ct)
    {
        var studentId = currentUser.UserId;

        var enrollment = await db.Enrollments.FirstAsync(e => e.StudentUserId == studentId && e.TeacherUserId == teacherId, ct);
        enrollment.LastViewedAtUtc = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
