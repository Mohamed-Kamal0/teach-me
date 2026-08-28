namespace TeachersLessons.Api.Features.Auth.Services;

public interface IAccountService
{
    Task<MeResponse> GetMeAsync(CancellationToken ct);
}

public class AccountService(AppDbContext db, ICurrentUser currentUser) : IAccountService
{
    public async Task<MeResponse> GetMeAsync(CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);

        var photoETag = await db.Avatars.Where(a => a.UserId == user.Id)
            .Select(a => a.ETag)
            .FirstOrDefaultAsync(ct);

        string? teacherStatus = null;
        DateTimeOffset? teacherDecidedAtUtc = null;
        if (user.Role == UserRole.Teacher)
        {
            var teacher = await db.Teachers.Where(t => t.UserId == user.Id)
                .Select(t => new { t.Status, t.DecidedAtUtc })
                .FirstAsync(ct);
            teacherStatus = teacher.Status.ToString();
            teacherDecidedAtUtc = teacher.DecidedAtUtc;
        }

        return new MeResponse(user.Id, user.Email, user.FullName, user.Role.ToString(), teacherStatus, teacherDecidedAtUtc, photoETag);
    }
}
