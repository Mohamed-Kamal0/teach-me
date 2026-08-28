using FluentValidation;

namespace TeachersLessons.Api.Features.Auth.Validators;

public class RegisterTeacherRequestValidator : AbstractValidator<RegisterTeacherRequest>
{
    public RegisterTeacherRequestValidator(AppDbContext db)
    {
        RuleFor(x => x.FullName).FullName();
        RuleFor(x => x.Email).UniqueEmail(db);
        RuleFor(x => x.Password).Password();
    }
}
