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
            .Select(e => new StudentSummaryDto(
                e.StudentUserId, e.Student.User.FullName, e.Student.User.Email, e.JoinedAtUtc,
                db.Avatars.Where(a => a.UserId == e.StudentUserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        return Ok(new TeacherStudentsResponse(joinCode, new PagedResult<StudentSummaryDto> { Items = items, Page = p, PageSize = ps, Total = total }));
    }

    /// <summary>
    /// Three isolation rules hold here and must survive any later edit: a student the caller
    /// never enrolled is a 404 and not a 403 (no existence oracle); the marks are filtered by
    /// the caller's own lessons, so a student on two courses shows each teacher only their own;
    /// and TotalLessons counts the caller's lessons only, so the denominator cannot leak the
    /// size of another teacher's course.
    /// </summary>
    [HttpGet("{studentId:guid}")]
    public async Task<ActionResult<StudentProfileDto>> Detail(Guid studentId, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        var enrollment = await db.Enrollments
            .Where(e => e.TeacherUserId == teacherId && e.StudentUserId == studentId)
            .Select(e => new
            {
                e.Student.User.FullName,
                e.Student.User.Email,
                e.Student.DisplayName,
                e.Student.Phone,
                e.Student.Bio,
                e.JoinedAtUtc,
                PhotoETag = db.Avatars.Where(a => a.UserId == studentId).Select(a => a.ETag).FirstOrDefault()
            })
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

        // Counted the way ProgressController counts it, so "3 of 8 marked" here and the progress
        // bar on the progress table cannot disagree.
        var totalLessons = await db.Lessons.CountAsync(l => l.TeacherUserId == teacherId, ct);

        return Ok(new StudentProfileDto(
            studentId, enrollment.FullName, enrollment.DisplayName, enrollment.Email,
            enrollment.Phone, enrollment.Bio, enrollment.PhotoETag, enrollment.JoinedAtUtc,
            totalLessons, marks.Count, marks.Count(m => m.Passed), marks.Count(m => !m.Passed),
            marks));
    }
}
