namespace TeachersLessons.Api.Features.Helper.Services;

public interface IHelperService
{
    Task<HelperAnswerResponse> AskAsync(string? question, CancellationToken ct);
}

public class HelperService(IHelperIntentProvider intents, AppDbContext db, ICurrentUser currentUser) : IHelperService
{
    /// <summary>Answers that send the student into a course make no sense before they join one.</summary>
    private static readonly string[] CourseDependentRoutes = ["/student/courses", "/student/whats-new", "/student/marks"];

    public async Task<HelperAnswerResponse> AskAsync(string? question, CancellationToken ct)
    {
        var normalized = (question ?? string.Empty).Trim().ToLowerInvariant();

        HelperIntent? best = null;
        var bestScore = 0;
        foreach (var intent in intents.Intents)
        {
            var score = intent.Keywords.Count(k => normalized.Contains(k.ToLowerInvariant()));
            if (score > bestScore)
            {
                bestScore = score;
                best = intent;
            }
        }

        if (best is null)
        {
            var knownTopics = intents.Intents.Select(i => i.Keywords.First()).ToList();
            return new HelperAnswerResponse(null, null, Unknown: true, knownTopics);
        }

        var route = best.Route;
        var answer = best.Answer;

        if (route is not null && CourseDependentRoutes.Contains(route))
        {
            var hasCourses = await db.Enrollments.AnyAsync(e => e.StudentUserId == currentUser.UserId, ct);
            if (!hasCourses)
            {
                route = "/student/join";
                answer = "You're not on any course yet — enter your teacher's joining code to get started.";
            }
        }

        return new HelperAnswerResponse(answer, route, Unknown: false, null);
    }
}
