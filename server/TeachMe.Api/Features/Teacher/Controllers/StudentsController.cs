using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Teacher.Services;

namespace TeachMe.Api.Features.Teacher.Controllers;

[ApiController]
[Route("api/teacher/students")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class StudentsController(ITeacherStudentService students) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TeacherStudentsResponse>> List([FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct) =>
        Ok(await students.ListAsync(page, pageSize, ct));

    [HttpGet("{studentId:guid}")]
    public async Task<ActionResult<StudentProfileDto>> Detail(Guid studentId, CancellationToken ct) =>
        Ok(await students.GetProfileAsync(studentId, ct));
}
