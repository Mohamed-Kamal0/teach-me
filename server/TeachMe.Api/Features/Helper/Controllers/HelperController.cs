using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Helper.Services;

namespace TeachMe.Api.Features.Helper.Controllers;

[ApiController]
[Route("api/helper")]
[Authorize(Policy = PolicyNames.Student)]
public class HelperController(IHelperService helper) : ControllerBase
{
    [HttpGet("ask")]
    public async Task<ActionResult<HelperAnswerResponse>> Ask([FromQuery] string? q, CancellationToken ct) =>
        Ok(await helper.AskAsync(q, ct));
}
