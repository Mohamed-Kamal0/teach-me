using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Admin.Services;

namespace TeachMe.Api.Features.Admin.Controllers;

[ApiController]
[Route("api/admin/teachers")]
[Authorize(Policy = PolicyNames.Admin)]
public class AdminController(ITeacherApprovalService teachers) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CursorPage<TeacherSummaryDto>>> List(
        [FromQuery] string? status, [FromQuery] string? cursor, [FromQuery] int? limit,
        [FromQuery] string? q, CancellationToken ct) =>
        Ok(await teachers.ListAsync(status, cursor, limit, q, ct));

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        await teachers.ApproveAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct)
    {
        await teachers.RejectAsync(id, ct);
        return NoContent();
    }
}
