using FluentValidation;

namespace TeachersLessons.Api.Features.Student.Services;

public interface IStudentProfileService
{
    Task<ProfileDto> GetAsync(CancellationToken ct);
    Task<ProfileDto> UpdateAsync(ProfileUpdateRequest request, CancellationToken ct);
}

public class StudentProfileService(
    AppDbContext db,
    IValidator<ProfileUpdateRequest> validator,
    ICurrentUser currentUser) : IStudentProfileService
{
    public Task<ProfileDto> GetAsync(CancellationToken ct) => BuildProfile(currentUser.UserId, ct);

    public async Task<ProfileDto> UpdateAsync(ProfileUpdateRequest request, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(request, ct);

        var userId = currentUser.UserId;
        var student = await db.Students.FirstAsync(s => s.UserId == userId, ct);

        student.DisplayName = Optional(request.DisplayName);
        student.Phone = Optional(request.Phone);
        student.Bio = Optional(request.Bio);

        await db.SaveChangesAsync(ct);

        return await BuildProfile(userId, ct);
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

    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
