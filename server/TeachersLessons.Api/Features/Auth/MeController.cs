using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Auth;

[ApiController]
[Route("api/me")]
[Authorize]
public class MeController(AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MeResponse>> Get(CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);

        string? teacherStatus = null;
        DateTimeOffset? teacherDecidedAtUtc = null;
        if (user.Role == UserRole.Teacher)
        {
            var teacher = await db.Teachers.Where(t => t.UserId == user.Id)
                .Select(t => new { t.Status, t.DecidedAtUtc })
                .FirstAsync(ct);
            teacherStatus = teacher.Status.ToString();
            teacherDecidedAtUtc = teacher.DecidedAtUtc;
        }

        return Ok(new MeResponse(user.Id, user.Email, user.FullName, user.Role.ToString(), teacherStatus, teacherDecidedAtUtc));
    }
}
