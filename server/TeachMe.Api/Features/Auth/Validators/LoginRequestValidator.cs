using FluentValidation;

namespace TeachMe.Api.Features.Auth.Validators;

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
