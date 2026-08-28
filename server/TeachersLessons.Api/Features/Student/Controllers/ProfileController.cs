using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Student.Services;

namespace TeachersLessons.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/profile")]
[Authorize(Policy = PolicyNames.Student)]
public class ProfileController(IStudentProfileService profile) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ProfileDto>> Get(CancellationToken ct) =>
        Ok(await profile.GetAsync(ct));

    [HttpPut]
    public async Task<ActionResult<ProfileDto>> Update(ProfileUpdateRequest request, CancellationToken ct) =>
        Ok(await profile.UpdateAsync(request, ct));
}
