using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Public;

public record HomeResponse(int ApprovedTeacherCount, int LessonCount, string HowToJoin);

/// <summary>
/// What an approved teacher advertises about their own course. Deliberately not
/// <c>TeacherSummaryDto</c>: that one carries an email, and the admin screen may grow more
/// fields later — a separate record is what stops one of them landing on an anonymous page.
/// Every number here is an aggregate over the teacher's own course; none can be traced to
/// one student.
/// </summary>
public record PublicTeacherDto(
    Guid UserId,
    string FullName,
    string? PhotoETag,
    DateTimeOffset MemberSinceUtc,
    int OpenLessonCount,        // released — OpensAtUtc <= now
    int PublishedLessonCount,   // every lesson the teacher has created
    int StudentCount,
    int MarkCount,
    int PassedMarkCount);

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("home")]
    public async Task<ActionResult<HomeResponse>> Home(CancellationToken ct)
    {
        var approvedTeacherCount = await db.Teachers.CountAsync(t => t.Status == TeacherStatus.Approved, ct);
        var lessonCount = await db.Lessons.CountAsync(ct);

        return Ok(new HomeResponse(
            approvedTeacherCount,
            lessonCount,
            "Ask your teacher for their joining code, then enter it from your student profile."));
    }

    /// <summary>
    /// The public directory. Approved teachers only — pending and rejected are not a public
    /// record. Pass rate is not computed here: a course with no marks has no pass rate, and "—"
    /// is a rendering decision, not a number the server should invent.
    /// </summary>
    [HttpGet("teachers")]
    public async Task<ActionResult<PagedResult<PublicTeacherDto>>> Teachers(
        [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? q, CancellationToken ct)
    {
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);
        var now = clock.GetUtcNow();

        var teachers = db.Teachers.Where(t => t.Status == TeacherStatus.Approved);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            teachers = teachers.Where(t => EF.Functions.Like(t.User.FullName, $"%{term}%"));
        }

        var total = await teachers.CountAsync(ct);

        // Most open lessons first, then alphabetical: a newly approved teacher with nothing to
        // show lands at the bottom, so the first screen of the directory never looks empty.
        var items = await teachers
            .OrderByDescending(t => t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now))
            .ThenBy(t => t.User.FullName)
            .Skip((p - 1) * ps).Take(ps)
            .Select(t => new PublicTeacherDto(
                t.UserId,
                t.User.FullName,
                db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault(),
                t.User.CreatedAtUtc,
                // The same predicate LessonQueries.VisibleTo uses, so this count and the one a
                // student sees inside the course cannot drift apart.
                t.Lessons.Count(l => l.OpensAtUtc != null && l.OpensAtUtc <= now),
                t.Lessons.Count(),
                t.Enrollments.Count(),
                t.Lessons.SelectMany(l => l.Marks).Count(),
                t.Lessons.SelectMany(l => l.Marks).Count(m => m.Score >= m.Lesson.PassMark)))
            .ToListAsync(ct);

        return Ok(new PagedResult<PublicTeacherDto> { Items = items, Page = p, PageSize = ps, Total = total });
    }
}
