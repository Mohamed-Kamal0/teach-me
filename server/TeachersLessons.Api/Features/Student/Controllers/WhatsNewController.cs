using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Student.Services;

namespace TeachersLessons.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/whats-new")]
[Authorize(Policy = PolicyNames.Student)]
public class WhatsNewController(IWhatsNewService whatsNew) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WhatsNewResponse>> Get(CancellationToken ct) =>
        Ok(await whatsNew.GetAsync(ct));
}
