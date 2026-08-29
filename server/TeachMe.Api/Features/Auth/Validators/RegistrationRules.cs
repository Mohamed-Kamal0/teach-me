using FluentValidation;

namespace TeachMe.Api.Features.Auth.Validators;

/// <summary>
/// Teacher and student registration ask for the same three fields under exactly the same rules
/// — the wording of every message is part of the contract, so it lives once here rather than
/// being copied into each validator. A teacher is asked for two more, the subject they teach and
/// a phone number, and their rules live here too because the profile screen resets the same two
/// fields later and the two screens must not drift.
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

    /// <summary>
    /// What a teacher teaches. Kept short on purpose: this is a subject, not a syllabus, and a
    /// directory search over free paragraphs would match on the wrong half of the sentence.
    /// </summary>
    public static IRuleBuilderOptions<T, string> Subject<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter the subject you teach.")
            .Length(2, 60).WithMessage("Enter the subject you teach, in 60 characters or fewer.");

    /// <summary>
    /// How to reach a teacher off the platform. The shape is the same one a student's profile
    /// accepts — digits, spaces, and the punctuation an international number is written with —
    /// so the two screens cannot disagree about what a phone number is. Unlike the student's,
    /// this one is required: it is asked for at registration and read before an approval.
    /// </summary>
    public static IRuleBuilderOptions<T, string> Phone<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .Must(v => !string.IsNullOrWhiteSpace(v)).WithMessage("Enter a phone number.")
            .MaximumLength(30).WithMessage("Enter a phone number of 30 characters or fewer.")
            .Matches(PhonePattern).WithMessage("Enter a phone number using digits, spaces, + - or ( ).");

    /// <summary>The one place the shape of a phone number is written down.</summary>
    internal const string PhonePattern = @"^[0-9 +\-()]*$";

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
