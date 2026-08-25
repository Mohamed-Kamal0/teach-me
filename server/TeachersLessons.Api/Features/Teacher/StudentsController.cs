using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Teacher;

[ApiController]
[Route("api/teacher/students")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class StudentsController(AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TeacherStudentsResponse>> List([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);

        var joinCode = await db.Teachers.Where(t => t.UserId == teacherId).Select(t => t.JoinCode).FirstAsync(ct);

        var query = db.Enrollments
            .Where(e => e.TeacherUserId == teacherId)
            .OrderBy(e => e.Student.User.FullName);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((p - 1) * ps).Take(ps)
            .Select(e => new StudentSummaryDto(e.StudentUserId, e.Student.User.FullName, e.Student.User.Email, e.JoinedAtUtc))
            .ToListAsync(ct);

        return Ok(new TeacherStudentsResponse(joinCode, new PagedResult<StudentSummaryDto> { Items = items, Page = p, PageSize = ps, Total = total }));
    }

    [HttpGet("{studentId:guid}")]
    public async Task<ActionResult<StudentGradeDetailDto>> Detail(Guid studentId, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        var enrollment = await db.Enrollments
            .Where(e => e.TeacherUserId == teacherId && e.StudentUserId == studentId)
            .Select(e => new { e.Student.User.FullName, e.Student.User.Email })
            .FirstOrDefaultAsync(ct);

        if (enrollment is null)
        {
            throw new NotFoundApiException();
        }

        var marks = await db.Marks
            .Where(m => m.StudentUserId == studentId && m.Lesson.TeacherUserId == teacherId)
            .OrderBy(m => m.Lesson.OrderIndex)
            .Select(m => new LessonMarkDto(
                m.LessonId, m.Lesson.Title, m.Lesson.OrderIndex, m.Lesson.QuizMaxScore, m.Lesson.PassMark,
                m.Score, m.Score >= m.Lesson.PassMark, m.RecordedAtUtc, m.UpdatedAtUtc, m.Id))
            .ToListAsync(ct);

        return Ok(new StudentGradeDetailDto(studentId, enrollment.FullName, enrollment.Email, marks));
    }
}
