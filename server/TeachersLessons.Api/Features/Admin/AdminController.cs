using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Admin;

[ApiController]
[Route("api/admin/teachers")]
[Authorize(Policy = PolicyNames.Admin)]
public class AdminController(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<TeacherSummaryDto>>> List(
        [FromQuery] string? status, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct)
    {
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);

        var query = db.Teachers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TeacherStatus>(status, true, out var parsed))
        {
            query = query.Where(t => t.Status == parsed);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(t => t.User.FullName)
            .Skip((p - 1) * ps)
            .Take(ps)
            .Select(t => new TeacherSummaryDto(
                t.UserId, t.User.FullName, t.User.Email, t.Status.ToString(), t.User.CreatedAtUtc, t.DecidedAtUtc,
                db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        return Ok(new PagedResult<TeacherSummaryDto> { Items = items, Page = p, PageSize = ps, Total = total });
    }

    [HttpPost("{id:guid}/approve")]
    public Task<IActionResult> Approve(Guid id, CancellationToken ct) => Decide(id, TeacherStatus.Approved, ct);

    [HttpPost("{id:guid}/reject")]
    public Task<IActionResult> Reject(Guid id, CancellationToken ct) => Decide(id, TeacherStatus.Rejected, ct);

    private async Task<IActionResult> Decide(Guid id, TeacherStatus decision, CancellationToken ct)
    {
        var teacher = await db.Teachers.FirstOrDefaultAsync(t => t.UserId == id, ct);
        if (teacher is null)
        {
            throw new NotFoundApiException();
        }

        if (teacher.Status != TeacherStatus.Pending)
        {
            var decidedOn = teacher.DecidedAtUtc?.ToString("d MMM yyyy") ?? "an earlier date";
            throw new ConflictApiException($"This teacher was already {teacher.Status.ToString().ToLowerInvariant()} on {decidedOn}.");
        }

        teacher.Status = decision;
        teacher.DecidedAtUtc = clock.GetUtcNow();
        teacher.DecidedByUserId = currentUser.UserId;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}
