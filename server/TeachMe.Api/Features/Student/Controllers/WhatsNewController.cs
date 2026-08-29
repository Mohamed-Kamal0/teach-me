using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Student.Services;

namespace TeachMe.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/whats-new")]
[Authorize(Policy = PolicyNames.Student)]
public class WhatsNewController(IWhatsNewService whatsNew) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WhatsNewResponse>> Get(CancellationToken ct) =>
        Ok(await whatsNew.GetAsync(ct));
}
