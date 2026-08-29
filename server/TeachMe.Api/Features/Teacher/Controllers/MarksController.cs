using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Teacher.Services;

namespace TeachMe.Api.Features.Teacher.Controllers;

[ApiController]
[Route("api/teacher/marks")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class MarksController(IMarkService marks) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MarkDto>> Record(RecordMarkRequest request, CancellationToken ct)
    {
        var mark = await marks.RecordAsync(request, ct);
        return CreatedAtAction(nameof(Record), new { id = mark.Id }, mark);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MarkDto>> Update(Guid id, UpdateMarkRequest request, CancellationToken ct) =>
        Ok(await marks.UpdateAsync(id, request, ct));
}
