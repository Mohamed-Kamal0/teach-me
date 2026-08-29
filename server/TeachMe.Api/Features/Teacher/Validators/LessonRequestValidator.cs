using FluentValidation;

namespace TeachMe.Api.Features.Teacher.Validators;

/// <summary>Structural rules L1, L2, L4-L12. L3 (position uniqueness) needs the teacher's other
/// lessons, so it is checked in LessonService alongside the unique-index backstop.</summary>
public class LessonRequestValidator : AbstractValidator<LessonRequest>
{
    public LessonRequestValidator()
    {
        // L1
        RuleFor(x => x.Title)
            .Must(v => !string.IsNullOrWhiteSpace(v) && v.Trim().Length <= 200)
            .WithMessage("A lesson needs a title.");

        // L2
        RuleFor(x => x.OrderIndex)
            .GreaterThanOrEqualTo(1).WithMessage("Position must be 1 or higher.");

        // L4
        RuleFor(x => x.RecordingUrl)
            .Must(v => BeAnAbsoluteHttpUrl(v) && v.Length <= 2048)
            .WithMessage("Paste the link to the recording.");

        // L5
        RuleFor(x => x.HandoutUrl)
            .Must(v => string.IsNullOrEmpty(v) || (BeAnAbsoluteHttpUrl(v) && v.Length <= 2048))
            .WithMessage("That doesn't look like a web address.");
        RuleFor(x => x.QuizUrl)
            .Must(v => string.IsNullOrEmpty(v) || (BeAnAbsoluteHttpUrl(v) && v.Length <= 2048))
            .WithMessage("That doesn't look like a web address.");
        RuleFor(x => x.AnswersUrl)
            .Must(v => string.IsNullOrEmpty(v) || (BeAnAbsoluteHttpUrl(v) && v.Length <= 2048))
            .WithMessage("That doesn't look like a web address.");

        // L6
        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(1, 600).WithMessage("Length must be between 1 and 600 minutes.");

        // L7
        RuleFor(x => x.QuizMaxScore)
            .GreaterThan(0).WithMessage("The quiz must be marked out of more than zero.");

        // L8
        RuleFor(x => x)
            .Must(x => x.PassMark >= 0 && x.PassMark <= x.QuizMaxScore)
            .WithMessage(x => $"The pass mark can't be higher than the quiz maximum ({x.QuizMaxScore}).")
            .OverridePropertyName("passMark");

        // L9
        RuleFor(x => x)
            .Must(x => x.QuizOpensAtUtc is null || !string.IsNullOrWhiteSpace(x.QuizUrl))
            .WithMessage("This lesson has no quiz, so it can't have a quiz opening time.")
            .OverridePropertyName("quizOpensAtUtc");

        // L10
        RuleFor(x => x)
            .Must(x => x.AnswersOpenAtUtc is null || !string.IsNullOrWhiteSpace(x.AnswersUrl))
            .WithMessage("This lesson has no answer sheet, so it can't have a release time.")
            .OverridePropertyName("answersOpenAtUtc");

        // L11
        RuleFor(x => x)
            .Must(x => x.QuizOpensAtUtc is null || (x.OpensAtUtc is not null && x.QuizOpensAtUtc >= x.OpensAtUtc))
            .WithMessage("The quiz can't open before the lesson does.")
            .OverridePropertyName("quizOpensAtUtc");

        // L12
        RuleFor(x => x)
            .Must(x => x.AnswersOpenAtUtc is null || (x.QuizOpensAtUtc is not null && x.AnswersOpenAtUtc >= x.QuizOpensAtUtc))
            .WithMessage("The answers can't be released before the quiz opens.")
            .OverridePropertyName("answersOpenAtUtc");
    }

    private static bool BeAnAbsoluteHttpUrl(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
