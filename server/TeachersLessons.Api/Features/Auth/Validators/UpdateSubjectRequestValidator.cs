using FluentValidation;

namespace TeachersLessons.Api.Features.Auth.Validators;

/// <summary>
/// The same <see cref="RegistrationRules.Subject{T}"/> rule registration holds a teacher to, so
/// the screen that first states a subject and the screen that changes it cannot disagree about
/// what a subject is.
/// </summary>
public class UpdateSubjectRequestValidator : AbstractValidator<UpdateSubjectRequest>
{
    public UpdateSubjectRequestValidator()
    {
        RuleFor(x => x.Subject).Subject();
    }
}
