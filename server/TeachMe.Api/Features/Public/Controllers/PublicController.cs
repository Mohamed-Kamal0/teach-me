using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Public.Services;

namespace TeachMe.Api.Features.Public.Controllers;

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController(IPublicDirectoryService directory) : ControllerBase
{
    [HttpGet("home")]
    public async Task<ActionResult<HomeResponse>> Home(CancellationToken ct) =>
        Ok(await directory.GetHomeAsync(ct));

    [HttpGet("teachers")]
    public async Task<ActionResult<CursorPage<PublicTeacherDto>>> Teachers(
        [FromQuery] string? cursor, [FromQuery] int? limit, [FromQuery] string? q, CancellationToken ct) =>
        Ok(await directory.GetTeachersAsync(cursor, limit, q, ct));
}
