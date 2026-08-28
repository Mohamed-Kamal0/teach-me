using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Student.Services;

namespace TeachersLessons.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/enrollments")]
[Authorize(Policy = PolicyNames.Student)]
public class EnrollmentsController(IEnrollmentService enrollments) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Join(JoinCourseRequest request, CancellationToken ct)
    {
        await enrollments.JoinAsync(request, ct);
        return Created();
    }
}
