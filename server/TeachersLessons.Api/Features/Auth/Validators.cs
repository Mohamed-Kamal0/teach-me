using FluentValidation;

namespace TeachersLessons.Api.Features.Auth;

file static class EmailUniqueness
{
    public static async Task<bool> BeUnique(AppDbContext db, string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return !await db.Users.AnyAsync(u => u.Email == normalized, ct);
    }
}

public class RegisterTeacherRequestValidator : AbstractValidator<RegisterTeacherRequest>
{
    public RegisterTeacherRequestValidator(AppDbContext db)
    {
        RuleFor(x => x.FullName)
            .Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter your full name.")
            .Length(2, 120).WithMessage("Enter your full name.");

        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter a valid email address.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256).WithMessage("Enter a valid email address.")
            .MustAsync((email, ct) => EmailUniqueness.BeUnique(db, email, ct))
            .WithMessage("That email is already registered. Sign in instead?");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Use at least 8 characters, with a letter and a number.")
            .MinimumLength(8).WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[A-Za-z]").WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[0-9]").WithMessage("Use at least 8 characters, with a letter and a number.");
    }
}

public class RegisterStudentRequestValidator : AbstractValidator<RegisterStudentRequest>
{
    public RegisterStudentRequestValidator(AppDbContext db)
    {
        RuleFor(x => x.FullName)
            .Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter your full name.")
            .Length(2, 120).WithMessage("Enter your full name.");

        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter a valid email address.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256).WithMessage("Enter a valid email address.")
            .MustAsync((email, ct) => EmailUniqueness.BeUnique(db, email, ct))
            .WithMessage("That email is already registered. Sign in instead?");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Use at least 8 characters, with a letter and a number.")
            .MinimumLength(8).WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[A-Za-z]").WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[0-9]").WithMessage("Use at least 8 characters, with a letter and a number.");
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter a valid email address.")
            .EmailAddress().WithMessage("Enter a valid email address.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Enter your password.");
    }
}
