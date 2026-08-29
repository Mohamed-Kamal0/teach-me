using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Student.Services;

namespace TeachMe.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/marks")]
[Authorize(Policy = PolicyNames.Student)]
public class MarksController(IStudentMarkService marks) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<StudentMarkDto>>> Get(CancellationToken ct) =>
        Ok(await marks.ListAsync(ct));
}
