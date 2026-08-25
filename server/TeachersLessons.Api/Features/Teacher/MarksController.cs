using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Teacher;

[ApiController]
[Route("api/teacher/marks")]
[Authorize(Policy = PolicyNames.ApprovedTeacher)]
public class MarksController(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MarkDto>> Record(RecordMarkRequest request, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        // M1 — the lesson must belong to the calling teacher.
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == request.LessonId && l.TeacherUserId == teacherId, ct);
        if (lesson is null)
        {
            throw new NotFoundApiException();
        }

        // M2 — the student must be enrolled with the calling teacher.
        var enrolled = await db.Enrollments.AnyAsync(e => e.TeacherUserId == teacherId && e.StudentUserId == request.StudentUserId, ct);
        if (!enrolled)
        {
            throw new NotFoundApiException();
        }

        // M3 — the bound is read from the lesson, not the code.
        if (request.Score < 0 || request.Score > lesson.QuizMaxScore)
        {
            throw new ValidationApiException("score", $"Score must be between 0 and {lesson.QuizMaxScore}.");
        }

        // M4 — no second mark for the same student on the same lesson.
        var exists = await db.Marks.AnyAsync(m => m.LessonId == request.LessonId && m.StudentUserId == request.StudentUserId, ct);
        if (exists)
        {
            throw new ConflictApiException("This student already has a mark for this lesson — edit that one.");
        }

        var mark = new Mark
        {
            Id = Guid.CreateVersion7(),
            LessonId = request.LessonId,
            StudentUserId = request.StudentUserId,
            Score = request.Score,
            RecordedAtUtc = clock.GetUtcNow()
        };

        db.Marks.Add(mark);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ConflictApiException("This student already has a mark for this lesson — edit that one.");
        }

        return CreatedAtAction(nameof(Record), new { id = mark.Id }, ToDto(mark, lesson));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MarkDto>> Update(Guid id, UpdateMarkRequest request, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;

        var mark = await db.Marks.Include(m => m.Lesson)
            .FirstOrDefaultAsync(m => m.Id == id && m.Lesson.TeacherUserId == teacherId, ct);
        if (mark is null)
        {
            throw new NotFoundApiException();
        }

        if (request.Score < 0 || request.Score > mark.Lesson.QuizMaxScore)
        {
            throw new ValidationApiException("score", $"Score must be between 0 and {mark.Lesson.QuizMaxScore}.");
        }

        mark.Score = request.Score;
        mark.UpdatedAtUtc = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);

        return Ok(ToDto(mark, mark.Lesson));
    }

    private static MarkDto ToDto(Mark m, Lesson l) =>
        new(m.Id, m.LessonId, m.StudentUserId, m.Score, m.Score >= l.PassMark, m.RecordedAtUtc, m.UpdatedAtUtc);
}
