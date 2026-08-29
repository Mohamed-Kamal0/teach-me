using FluentValidation;

namespace TeachMe.Api.Features.Auth.Validators;

public class RegisterStudentRequestValidator : AbstractValidator<RegisterStudentRequest>
{
    public RegisterStudentRequestValidator(AppDbContext db)
    {
        RuleFor(x => x.FullName).FullName();
        RuleFor(x => x.Email).UniqueEmail(db);
        RuleFor(x => x.Password).Password();
    }
}
