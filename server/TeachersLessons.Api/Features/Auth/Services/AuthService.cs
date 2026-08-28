using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using DomainTeacher = TeachersLessons.Api.Domain.Teacher;
using DomainStudent = TeachersLessons.Api.Domain.Student;

namespace TeachersLessons.Api.Features.Auth.Services;

/// <summary>
/// A verified sign-in. The principal is handed back rather than signed in here: issuing the
/// cookie is the controller's job, so this service stays free of HttpContext.
/// </summary>
public record AuthenticatedUser(ClaimsPrincipal Principal, LoginResponse Response);

public interface IAuthService
{
    Task RegisterTeacherAsync(RegisterTeacherRequest request, CancellationToken ct);
    Task RegisterStudentAsync(RegisterStudentRequest request, CancellationToken ct);
    Task<AuthenticatedUser> AuthenticateAsync(LoginRequest request, CancellationToken ct);
}

public class AuthService(
    AppDbContext db,
    IValidator<RegisterTeacherRequest> teacherValidator,
    IValidator<RegisterStudentRequest> studentValidator,
    IValidator<LoginRequest> loginValidator,
    IPasswordHasher<User> passwordHasher,
    TimeProvider clock) : IAuthService
{
    public async Task RegisterTeacherAsync(RegisterTeacherRequest request, CancellationToken ct)
    {
        await teacherValidator.ValidateOrThrowAsync(request, ct);

        var user = NewUser(request.FullName, request.Email, request.Password, UserRole.Teacher);

        db.Users.Add(user);
        db.Teachers.Add(new DomainTeacher
        {
            UserId = user.Id,
            JoinCode = await GenerateUniqueJoinCode(ct),
            Status = TeacherStatus.Pending,
            Subject = request.Subject.Trim()
        });

        await db.SaveChangesAsync(ct);
    }

    public async Task RegisterStudentAsync(RegisterStudentRequest request, CancellationToken ct)
    {
        await studentValidator.ValidateOrThrowAsync(request, ct);

        var user = NewUser(request.FullName, request.Email, request.Password, UserRole.Student);

        db.Users.Add(user);
        db.Students.Add(new DomainStudent { UserId = user.Id });

        await db.SaveChangesAsync(ct);
    }

    public async Task<AuthenticatedUser> AuthenticateAsync(LoginRequest request, CancellationToken ct)
    {
        await loginValidator.ValidateOrThrowAsync(request, ct);

        var email = Normalize(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        // One message for both "no such account" and "wrong password" — nothing here tells a
        // caller whether an email is registered. It is named after the pair rather than after
        // `email` for the same reason: a key is a field name, and naming one of the two blames
        // the half we have no reason to think is wrong. `credentials` matches no box on the form,
        // so the client shows it over the form, which is where an answer about both belongs.
        if (user is null || passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            throw new ValidationApiException("credentials", "Email or password is incorrect.");
        }

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);

        string? teacherStatus = null;
        if (user.Role == UserRole.Teacher)
        {
            teacherStatus = (await db.Teachers.Where(t => t.UserId == user.Id).Select(t => t.Status).FirstAsync(ct)).ToString();
        }

        return new AuthenticatedUser(
            new ClaimsPrincipal(identity),
            new LoginResponse(user.Role.ToString(), teacherStatus));
    }

    private User NewUser(string fullName, string email, string password, UserRole role)
    {
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = Normalize(email),
            FullName = fullName.Trim(),
            Role = role,
            CreatedAtUtc = clock.GetUtcNow()
        };
        user.PasswordHash = passwordHasher.HashPassword(user, password);
        return user;
    }

    private async Task<string> GenerateUniqueJoinCode(CancellationToken ct)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = JoinCodeGenerator.Generate();
            if (!await db.Teachers.AnyAsync(t => t.JoinCode == code, ct))
            {
                return code;
            }
        }
        throw new InvalidOperationException("Could not generate a unique join code.");
    }

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();
}
