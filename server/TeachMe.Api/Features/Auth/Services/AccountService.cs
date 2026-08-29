using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace TeachMe.Api.Features.Auth.Services;

public interface IAccountService
{
    Task<MeResponse> GetMeAsync(CancellationToken ct);
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct);
    Task UpdateTeacherProfileAsync(UpdateTeacherProfileRequest request, CancellationToken ct);
}

public class AccountService(
    AppDbContext db,
    ICurrentUser currentUser,
    IValidator<ChangePasswordRequest> changePasswordValidator,
    IValidator<UpdateTeacherProfileRequest> teacherProfileValidator,
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
        string? subject = null;
        string? phone = null;
        if (user.Role == UserRole.Teacher)
        {
            var teacher = await db.Teachers.Where(t => t.UserId == user.Id)
                .Select(t => new { t.Status, t.DecidedAtUtc, t.Subject, t.Phone })
                .FirstAsync(ct);
            teacherStatus = teacher.Status.ToString();
            teacherDecidedAtUtc = teacher.DecidedAtUtc;
            // Carried on identity for the same reason standing is: they are facts about who is
            // asking, and a second endpoint for two strings would be a second thing to keep in
            // step. Null for everyone who is not a teacher.
            subject = teacher.Subject;
            phone = teacher.Phone;
        }

        // The name a student chose for themselves. Carried here for the same reason standing is:
        // every bar, drawer and menu in the app names the signed-in person from the session, so a
        // display name that lived only on /api/student/profile would leave all three showing the
        // registration name after the student had renamed themselves.
        string? displayName = null;
        if (user.Role == UserRole.Student)
        {
            displayName = await db.Students.Where(s => s.UserId == user.Id)
                .Select(s => s.DisplayName)
                .FirstOrDefaultAsync(ct);
        }

        return new MeResponse(user.Id, user.Email, user.FullName, user.Role.ToString(), teacherStatus, teacherDecidedAtUtc, photoETag, subject, phone, displayName);
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

    /// <summary>
    /// Restates what the signed-in teacher teaches and how to reach them. Like the password reset
    /// above, the account is taken from the cookie and never from the request, so there is no id
    /// in the body to point at somebody else. A teacher who is still pending may call it: these
    /// are the fields an administrator reads before deciding, and a typo in either should be
    /// fixable while waiting.
    /// </summary>
    public async Task UpdateTeacherProfileAsync(UpdateTeacherProfileRequest request, CancellationToken ct)
    {
        await teacherProfileValidator.ValidateOrThrowAsync(request, ct);

        var teacher = await db.Teachers.FirstAsync(t => t.UserId == currentUser.UserId, ct);
        teacher.Subject = request.Subject.Trim();
        teacher.Phone = request.Phone.Trim();

        await db.SaveChangesAsync(ct);
    }
}
