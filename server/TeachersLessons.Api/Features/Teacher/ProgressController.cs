using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Teacher;

[ApiController]
[Route("api/teacher/progress")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class ProgressController(AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProgressDto>>> Get([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct)
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

        var photoETags = await db.Avatars
            .Where(a => studentIds.Contains(a.UserId))
            .Select(a => new { a.UserId, a.ETag })
            .ToListAsync(ct);
        var photoByStudent = photoETags.ToDictionary(x => x.UserId, x => x.ETag);

        var items = enrolled.Select(e =>
        {
            var studentMarks = marks.Where(m => m.StudentUserId == e.StudentUserId).ToList();
            return new ProgressDto(
                e.StudentUserId, e.FullName,
                photoByStudent.GetValueOrDefault(e.StudentUserId),
                studentMarks.Count, totalLessons,
                studentMarks.Count(m => m.Passed), studentMarks.Count(m => !m.Passed));
        }).ToList();

        return Ok(new PagedResult<ProgressDto> { Items = items, Page = p, PageSize = ps, Total = total });
    }
}
