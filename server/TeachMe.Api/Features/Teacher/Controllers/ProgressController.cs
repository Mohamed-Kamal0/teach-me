using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Teacher.Services;

namespace TeachMe.Api.Features.Teacher.Controllers;

[ApiController]
[Route("api/teacher/progress")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class ProgressController(IProgressService progress) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CursorPage<ProgressDto>>> Get([FromQuery] string? cursor, [FromQuery] int? limit, CancellationToken ct) =>
        Ok(await progress.GetAsync(cursor, limit, ct));
}
