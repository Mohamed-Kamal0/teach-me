using FluentValidation;

namespace TeachersLessons.Api.Features.Auth.Validators;

/// <summary>
/// Teacher and student registration ask for exactly the same three fields under exactly the
/// same rules — the wording of every message is part of the contract, so it lives once here
/// rather than being copied into each validator.
/// </summary>
internal static class RegistrationRules
{
    public static IRuleBuilderOptions<T, string> FullName<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter your full name.")
            .Length(2, 120).WithMessage("Enter your full name.");

    public static IRuleBuilderOptions<T, string> UniqueEmail<T>(this IRuleBuilderInitial<T, string> rule, AppDbContext db) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Enter a valid email address.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256).WithMessage("Enter a valid email address.")
            .MustAsync((email, ct) => BeUnique(db, email, ct))
            .WithMessage("That email is already registered. Sign in instead?");

    public static IRuleBuilderOptions<T, string> Password<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Use at least 8 characters, with a letter and a number.")
            .MinimumLength(8).WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[A-Za-z]").WithMessage("Use at least 8 characters, with a letter and a number.")
            .Matches("[0-9]").WithMessage("Use at least 8 characters, with a letter and a number.");

    private static async Task<bool> BeUnique(AppDbContext db, string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return !await db.Users.AnyAsync(u => u.Email == normalized, ct);
    }
}
