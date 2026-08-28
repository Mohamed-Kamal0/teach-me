using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Auth.Services;

namespace TeachersLessons.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public class MeController(IAccountService account) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MeResponse>> Get(CancellationToken ct) =>
        Ok(await account.GetMeAsync(ct));
}
