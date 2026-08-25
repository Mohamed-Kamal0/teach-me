using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Public;

public record HomeResponse(int ApprovedTeacherCount, int LessonCount, string HowToJoin);

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController(AppDbContext db) : ControllerBase
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
}
