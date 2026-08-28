using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace TeachersLessons.Api.Features.Auth.Services;

public interface IAccountService
{
    Task<MeResponse> GetMeAsync(CancellationToken ct);
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct);
}

public class AccountService(
    AppDbContext db,
    ICurrentUser currentUser,
    IValidator<ChangePasswordRequest> changePasswordValidator,
    IPasswordHasher<User> passwordHasher) : IAccountService
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

    /// <summary>
    /// Resets the signed-in person's own password. The account is taken from the cookie and never
    /// from the request, so this endpoint cannot be pointed at somebody else's account no matter
    /// what is posted to it — there is no user id in the body to tamper with.
    /// </summary>
    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        await changePasswordValidator.ValidateOrThrowAsync(request, ct);

        var user = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
        if (verification == PasswordVerificationResult.Failed)
        {
            // Named against the field it belongs to, so the message lands under that box rather
            // than at the foot of the form. Unlike sign-in, being specific costs nothing here:
            // the caller already holds this session, so "that isn't your password" tells them
            // nothing they could not find out by signing in again.
            throw new ValidationApiException("currentPassword", "That isn't your current password.");
        }

        if (passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.NewPassword) != PasswordVerificationResult.Failed)
        {
            throw new ValidationApiException("newPassword", "Choose a password you aren't already using.");
        }

        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        await db.SaveChangesAsync(ct);
    }
}
