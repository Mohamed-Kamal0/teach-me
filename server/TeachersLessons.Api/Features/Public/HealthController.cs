using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Public;

public record HealthResponse(string Status, string Db);

[ApiController]
[Route("api/health")]
[AllowAnonymous]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var canConnect = await db.Database.CanConnectAsync(ct);
        if (!canConnect)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new HealthResponse("unhealthy", "unreachable"));
        }

        return Ok(new HealthResponse("ok", "ok"));
    }
}
