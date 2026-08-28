using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Public.Services;

namespace TeachersLessons.Api.Features.Public.Controllers;

[ApiController]
[Route("api/health")]
[AllowAnonymous]
public class HealthController(IHealthService health) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!await health.IsDatabaseReachableAsync(ct))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new HealthResponse("unhealthy", "unreachable"));
        }

        return Ok(new HealthResponse("ok", "ok"));
    }
}
