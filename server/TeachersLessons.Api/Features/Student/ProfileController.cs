using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Student;

[ApiController]
[Route("api/student/profile")]
[Authorize(Policy = PolicyNames.Student)]
public class ProfileController(AppDbContext db, IValidator<ProfileUpdateRequest> validator, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ProfileDto>> Get(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var dto = await BuildProfile(userId, ct);
        return Ok(dto);
    }

    [HttpPut]
    public async Task<ActionResult<ProfileDto>> Update(ProfileUpdateRequest request, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(request, ct);

        var userId = currentUser.UserId;
        var student = await db.Students.FirstAsync(s => s.UserId == userId, ct);

        student.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        student.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        student.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();

        await db.SaveChangesAsync(ct);

        return Ok(await BuildProfile(userId, ct));
    }

    private async Task<ProfileDto> BuildProfile(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        var student = await db.Students.FirstAsync(s => s.UserId == userId, ct);

        var photoETag = await db.Avatars.Where(a => a.UserId == userId)
            .Select(a => a.ETag)
            .FirstOrDefaultAsync(ct);

        var courses = (await db.Enrollments
            .Where(e => e.StudentUserId == userId)
            .Select(e => new CourseMembershipDto(e.TeacherUserId, e.Teacher.User.FullName, e.JoinedAtUtc, e.LastViewedAtUtc))
            .ToListAsync(ct))
            .OrderBy(c => c.JoinedAtUtc)
            .ToList();

        return new ProfileDto(user.Id, user.Email, user.FullName, student.DisplayName, student.Phone, student.Bio, photoETag, courses);
    }
}
