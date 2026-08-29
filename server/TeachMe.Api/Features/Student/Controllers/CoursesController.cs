using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Student.Services;

namespace TeachMe.Api.Features.Student.Controllers;

[ApiController]
[Route("api/student/courses")]
[Authorize(Policy = PolicyNames.Student)]
public class CoursesController(ICourseService courses) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CourseSummaryDto>>> List(CancellationToken ct) =>
        Ok(await courses.ListAsync(ct));

    [HttpGet("{teacherId:guid}/lessons")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<ActionResult<PagedResult<StudentLessonWithMarkDto>>> Lessons(
        Guid teacherId, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Ok(await courses.GetLessonsAsync(teacherId, page, pageSize, ct));

    [HttpGet("{teacherId:guid}/lessons/{id:guid}")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<ActionResult<StudentLessonWithMarkDto>> LessonDetail(Guid teacherId, Guid id, CancellationToken ct) =>
        Ok(await courses.GetLessonAsync(teacherId, id, ct));

    [HttpPost("{teacherId:guid}/seen")]
    [Authorize(Policy = PolicyNames.EnrolledInCourse)]
    public async Task<IActionResult> MarkSeen(Guid teacherId, CancellationToken ct)
    {
        await courses.MarkSeenAsync(teacherId, ct);
        return NoContent();
    }
}
