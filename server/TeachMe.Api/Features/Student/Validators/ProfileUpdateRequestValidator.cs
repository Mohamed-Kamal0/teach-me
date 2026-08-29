using FluentValidation;
using TeachMe.Api.Features.Auth.Validators;

namespace TeachMe.Api.Features.Student.Validators;

public class ProfileUpdateRequestValidator : AbstractValidator<ProfileUpdateRequest>
{
    public ProfileUpdateRequestValidator()
    {
        RuleFor(x => x.DisplayName)
            .MaximumLength(120).WithMessage("Display name is too long.");

        // The shape a teacher's phone is held to as well, so the two screens cannot disagree
        // about what a phone number is. The message differs because this one may be left blank.
        RuleFor(x => x.Phone)
            .Matches(RegistrationRules.PhonePattern).WithMessage("Enter a phone number, or leave it blank.")
            .MaximumLength(30).WithMessage("Enter a phone number, or leave it blank.");

        RuleFor(x => x.Bio)
            .MaximumLength(500).WithMessage("Keep your bio under 500 characters.");

        // A birthday that has not happened yet is a typo, and one from the 1800s is a slipped
        // digit in the year. Both are worth catching here rather than storing and rendering.
        RuleFor(x => x.DateOfBirth)
            .Must(d => d!.Value <= DateOnly.FromDateTime(DateTime.UtcNow))
                .WithMessage("Your date of birth can't be in the future.")
            .Must(d => d!.Value.Year >= 1900)
                .WithMessage("Enter a date of birth after 1900.")
            .When(x => x.DateOfBirth.HasValue);

        // Not on the form — and the server refuses it too if a client posts them anyway.
        RuleFor(x => x.Email).Null().WithMessage("Your email can't be changed here.");
        RuleFor(x => x.FullName).Null().WithMessage("Your email can't be changed here.");
        RuleFor(x => x.Role).Null().WithMessage("Your email can't be changed here.");
    }
}
