using FluentValidation;

namespace TeachMe.Api.Features.Auth.Validators;

/// <summary>
/// The same <see cref="RegistrationRules.Subject{T}"/> and <see cref="RegistrationRules.Phone{T}"/>
/// rules registration holds a teacher to, so the screen that first states these fields and the
/// screen that changes them cannot disagree about what a subject or a phone number is.
/// </summary>
public class UpdateTeacherProfileRequestValidator : AbstractValidator<UpdateTeacherProfileRequest>
{
    public UpdateTeacherProfileRequestValidator()
    {
        RuleFor(x => x.Subject).Subject();
        RuleFor(x => x.Phone).Phone();
    }
}
