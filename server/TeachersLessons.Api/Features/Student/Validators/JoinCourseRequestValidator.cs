using FluentValidation;

namespace TeachersLessons.Api.Features.Student.Validators;

public class JoinCourseRequestValidator : AbstractValidator<JoinCourseRequest>
{
    public JoinCourseRequestValidator()
    {
        RuleFor(x => x.Code)
            .Must(v => !string.IsNullOrWhiteSpace(v))
            .WithMessage("A joining code is 8 characters — check and try again.");
    }
}
