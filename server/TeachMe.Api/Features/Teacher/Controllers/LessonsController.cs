using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Teacher.Services;

namespace TeachMe.Api.Features.Teacher.Controllers;

[ApiController]
[Route("api/teacher/lessons")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class LessonsController(ILessonService lessons) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CursorPage<LessonDto>>> List([FromQuery] string? cursor, [FromQuery] int? limit, CancellationToken ct) =>
        Ok(await lessons.ListAsync(cursor, limit, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LessonDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await lessons.GetAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<LessonDto>> Create(LessonRequest request, CancellationToken ct)
    {
        var lesson = await lessons.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = lesson.Id }, lesson);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LessonDto>> Update(Guid id, LessonRequest request, CancellationToken ct) =>
        Ok(await lessons.UpdateAsync(id, request, ct));

    [HttpPut("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, MoveLessonRequest request, CancellationToken ct)
    {
        await lessons.MoveAsync(id, request.Up, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await lessons.DeleteAsync(id, ct);
        return NoContent();
    }
}
