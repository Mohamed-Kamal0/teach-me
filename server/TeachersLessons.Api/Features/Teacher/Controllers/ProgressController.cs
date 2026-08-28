using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Teacher.Services;

namespace TeachersLessons.Api.Features.Teacher.Controllers;

[ApiController]
[Route("api/teacher/progress")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class ProgressController(IProgressService progress) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProgressDto>>> Get([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Ok(await progress.GetAsync(page, pageSize, ct));
}
