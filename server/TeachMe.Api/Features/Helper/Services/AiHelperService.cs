using FluentValidation;
using Microsoft.Extensions.Options;
using TeachMe.Api.Features.Helper.Validators;

namespace TeachMe.Api.Features.Helper.Services;

/// <summary>
/// The AI path, wrapped around the phrase list rather than replacing it. Every failure — no
/// question, too long a question, too many questions, a model that throws, times out, says it does
/// not know, or comes back empty — lands on the same line: <see cref="HelperService"/> answers,
/// exactly as it does with no key configured. The API never returns 5xx for a helper question.
/// </summary>
public class AiHelperService(
    IAnswerModel model,
    IStudentContextPackBuilder packBuilder,
    IHelperRateLimiter limiter,
    IValidator<HelperQuestion> validator,
    HelperService fallback,
    ICurrentUser currentUser,
    IOptions<AiOptions> options,
    ILogger<AiHelperService> log) : IHelperService
{
    /// <summary>Every screen the model is allowed to name. A course route is checked separately.</summary>
    private static readonly HashSet<string> StaticRoutes =
    [
        "/student/courses", "/student/marks", "/student/whats-new",
        "/student/join", "/student/profile", "/teachers",
    ];

    public async Task<HelperAnswerResponse> AskAsync(string? question, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(new HelperQuestion(question), ct);

        var trimmed = question!.Trim();

        if (!limiter.TryTake(currentUser.UserId))
        {
            // Not a 429: a helper that stops helping is worse than a helper that answers from the
            // phrase list.
            log.LogInformation("Helper: rate limit reached for {StudentUserId}, answering from intents", currentUser.UserId);
            return await fallback.AskAsync(question, ct);
        }

        var pack = await packBuilder.BuildAsync(ct);
        var answer = await AskModelAsync(trimmed, pack, ct);

        if (answer is null || answer.Unknown || string.IsNullOrWhiteSpace(answer.Answer))
        {
            return await fallback.AskAsync(question, ct);
        }

        return ApplyServerRules(answer, pack);
    }

    /// <summary>
    /// The timeout lives here rather than inside the model implementation so that it guards the
    /// seam itself: whatever is on the other side, the student waits at most TimeoutSeconds before
    /// the phrase list answers instead.
    /// </summary>
    private async Task<ModelAnswer?> AskModelAsync(string question, ContextPack pack, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.Value.TimeoutSeconds));

        try
        {
            return await model.AnswerAsync(question, pack, timeout.Token);
        }
        catch (Exception ex)
        {
            // The caller going away is not a fallback case — nobody is waiting for the answer.
            ct.ThrowIfCancellationRequested();
            log.LogWarning(ex, "Helper: model call failed, falling back to intents");
            return null;
        }
    }

    /// <summary>
    /// The model can suggest; it cannot decide. The route is checked against this student's own
    /// screens, and HelperService's no-courses guarantee is applied to the model's answer exactly
    /// as it is applied to the phrase list's.
    /// </summary>
    private static HelperAnswerResponse ApplyServerRules(ModelAnswer answer, ContextPack pack)
    {
        var route = ValidateRoute(answer.Route, pack);
        var text = answer.Answer;

        if (route is not null && HelperService.CourseDependentRoutes.Contains(route) && pack.Courses.Count == 0)
        {
            route = "/student/join";
            text = HelperService.NoCoursesAnswer;
        }

        return new HelperAnswerResponse(text, route, Unknown: false, null);
    }

    /// <summary>
    /// A rejected route becomes null: the answer still shows, the "Take me there" button simply
    /// does not. A course route is valid only when the guid is one of *this student's* teachers —
    /// checked against the pack, never against a regex.
    /// </summary>
    private static string? ValidateRoute(string? route, ContextPack pack) => route switch
    {
        null or "" => null,
        _ when StaticRoutes.Contains(route) => route,
        _ when route.StartsWith("/student/courses/", StringComparison.Ordinal) &&
               pack.Courses.Any(c => route == $"/student/courses/{c.TeacherUserId}") => route,
        _ => null,   // hallucinated, foreign, or an off-app URL — dropped silently
    };
}
