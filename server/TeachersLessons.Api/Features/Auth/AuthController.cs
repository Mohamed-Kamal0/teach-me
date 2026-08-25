using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;
using DomainTeacher = TeachersLessons.Api.Domain.Teacher;
using DomainStudent = TeachersLessons.Api.Domain.Student;

namespace TeachersLessons.Api.Features.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    IValidator<RegisterTeacherRequest> teacherValidator,
    IValidator<RegisterStudentRequest> studentValidator,
    IValidator<LoginRequest> loginValidator,
    IPasswordHasher<User> passwordHasher,
    TimeProvider clock) : ControllerBase
{
    [HttpPost("register/teacher")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterTeacher(RegisterTeacherRequest request, CancellationToken ct)
    {
        await teacherValidator.ValidateOrThrowAsync(request, ct);

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = request.Email.Trim().ToLowerInvariant(),
            FullName = request.FullName.Trim(),
            Role = UserRole.Teacher,
            CreatedAtUtc = clock.GetUtcNow()
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        var teacher = new DomainTeacher
        {
            UserId = user.Id,
            JoinCode = await GenerateUniqueJoinCode(ct),
            Status = TeacherStatus.Pending
        };

        db.Users.Add(user);
        db.Teachers.Add(teacher);
        await db.SaveChangesAsync(ct);

        return Created();
    }

    [HttpPost("register/student")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterStudent(RegisterStudentRequest request, CancellationToken ct)
    {
        await studentValidator.ValidateOrThrowAsync(request, ct);

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = request.Email.Trim().ToLowerInvariant(),
            FullName = request.FullName.Trim(),
            Role = UserRole.Student,
            CreatedAtUtc = clock.GetUtcNow()
        };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        db.Students.Add(new DomainStudent { UserId = user.Id });
        await db.SaveChangesAsync(ct);

        return Created();
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        await loginValidator.ValidateOrThrowAsync(request, ct);

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null || passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
        {
            throw new ValidationApiException("email", "Email or password is incorrect.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString())
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        string? teacherStatus = null;
        if (user.Role == UserRole.Teacher)
        {
            teacherStatus = (await db.Teachers.Where(t => t.UserId == user.Id).Select(t => t.Status).FirstAsync(ct)).ToString();
        }

        return Ok(new LoginResponse(user.Role.ToString(), teacherStatus));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
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
}
