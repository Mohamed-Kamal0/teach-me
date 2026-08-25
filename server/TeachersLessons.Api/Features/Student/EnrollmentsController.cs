using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Student;

[ApiController]
[Route("api/student/enrollments")]
[Authorize(Policy = PolicyNames.Student)]
public class EnrollmentsController(AppDbContext db, IValidator<JoinCourseRequest> validator, ICurrentUser currentUser, TimeProvider clock) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Join(JoinCourseRequest request, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(request, ct);

        var normalized = JoinCodeGenerator.Normalize(request.Code);
        if (!JoinCodeGenerator.IsWellFormed(normalized))
        {
            throw new ValidationApiException("code", "A joining code is 8 characters — check and try again.");
        }

        var teacher = await db.Teachers.FirstOrDefaultAsync(t => t.JoinCode == normalized, ct);
        if (teacher is null)
        {
            throw new ValidationApiException("code", "No course found for that code.");
        }

        if (teacher.Status != TeacherStatus.Approved)
        {
            throw new ValidationApiException("code", "That teacher isn't taking students yet.");
        }

        var studentId = currentUser.UserId;
        var alreadyEnrolled = await db.Enrollments.AnyAsync(e => e.StudentUserId == studentId && e.TeacherUserId == teacher.UserId, ct);
        if (alreadyEnrolled)
        {
            throw new ConflictApiException("You're already on this course.");
        }

        var enrollment = new Enrollment
        {
            Id = Guid.CreateVersion7(),
            StudentUserId = studentId,
            TeacherUserId = teacher.UserId,
            JoinedAtUtc = clock.GetUtcNow(),
            LastViewedAtUtc = null
        };
        db.Enrollments.Add(enrollment);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ConflictApiException("You're already on this course.");
        }

        return Created();
    }
}
