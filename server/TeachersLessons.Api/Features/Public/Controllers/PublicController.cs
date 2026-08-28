using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Public.Services;

namespace TeachersLessons.Api.Features.Public.Controllers;

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController(IPublicDirectoryService directory) : ControllerBase
{
    [HttpGet("home")]
    public async Task<ActionResult<HomeResponse>> Home(CancellationToken ct) =>
        Ok(await directory.GetHomeAsync(ct));

    [HttpGet("teachers")]
    public async Task<ActionResult<PagedResult<PublicTeacherDto>>> Teachers(
        [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? q, CancellationToken ct) =>
        Ok(await directory.GetTeachersAsync(page, pageSize, q, ct));
}
