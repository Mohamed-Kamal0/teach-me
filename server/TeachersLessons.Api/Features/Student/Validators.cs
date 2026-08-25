using FluentValidation;

namespace TeachersLessons.Api.Features.Student;

public class ProfileUpdateRequestValidator : AbstractValidator<ProfileUpdateRequest>
{
    public ProfileUpdateRequestValidator()
    {
        RuleFor(x => x.DisplayName)
            .MaximumLength(120).WithMessage("Display name is too long.");

        RuleFor(x => x.Phone)
            .Matches(@"^[0-9 +\-()]*$").WithMessage("Enter a phone number, or leave it blank.")
            .MaximumLength(30).WithMessage("Enter a phone number, or leave it blank.");

        RuleFor(x => x.Bio)
            .MaximumLength(500).WithMessage("Keep your bio under 500 characters.");

        // Not on the form — and the server refuses it too if a client posts them anyway.
        RuleFor(x => x.Email).Null().WithMessage("Your email can't be changed here.");
        RuleFor(x => x.FullName).Null().WithMessage("Your email can't be changed here.");
        RuleFor(x => x.Role).Null().WithMessage("Your email can't be changed here.");
    }
}

public class JoinCourseRequestValidator : AbstractValidator<JoinCourseRequest>
{
    public JoinCourseRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => !string.IsNullOrWhiteSpace(v))
            .WithMessage("A joining code is 8 characters — check and try again.");
    }
}
