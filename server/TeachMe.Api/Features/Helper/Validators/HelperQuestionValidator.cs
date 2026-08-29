using FluentValidation;
using Microsoft.Extensions.Options;

namespace TeachMe.Api.Features.Helper.Validators;

/// <summary>The query string's <c>q</c>, wrapped so the error key the client reads back is "q".</summary>
public record HelperQuestion(string? Q);

/// <summary>
/// The question is checked before anything is spent on it. 300 characters is comfortably more than
/// "where are my results" and firmly less than a pasted instruction payload.
/// </summary>
public class HelperQuestionValidator : AbstractValidator<HelperQuestion>
{
    public HelperQuestionValidator(IOptions<AiOptions> options)
    {
        var maxLength = options.Value.MaxQuestionLength;

        RuleFor(x => x.Q)
            .Must(q => !string.IsNullOrWhiteSpace(q))
            .WithMessage("Type a question first.");

        RuleFor(x => x.Q)
            .Must(q => (q ?? string.Empty).Trim().Length <= maxLength)
            .WithMessage($"Keep your question to {maxLength} characters or fewer.");
    }
}
