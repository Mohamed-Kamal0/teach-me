using FluentValidation;

namespace TeachersLessons.Api.Features.Auth.Validators;

/// <summary>
/// The new password is held to exactly the rule registration holds it to — the same
/// <see cref="RegistrationRules.Password{T}"/> extension, so the policy cannot drift between the
/// screen that first sets a password and the screen that resets it.
///
/// "Is the current password right" is deliberately NOT here. A validator answers questions about
/// the shape of a request; that one is answered against the stored hash by
/// <c>AccountService</c>, which is the only place allowed to touch it.
/// </summary>
public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Enter your current password.");

        RuleFor(x => x.NewPassword).Password();
    }
}
