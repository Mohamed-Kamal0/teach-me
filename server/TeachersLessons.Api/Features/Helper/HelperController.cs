using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

namespace TeachersLessons.Api.Features.Helper;

[ApiController]
[Route("api/helper")]
[Authorize(Policy = PolicyNames.Student)]
public class HelperController(IHelperIntentProvider intents, AppDbContext db, ICurrentUser currentUser) : ControllerBase
{
    private static readonly string[] CourseDependentRoutes = ["/student/courses", "/student/whats-new", "/student/marks"];

    [HttpGet("ask")]
    public async Task<IActionResult> Ask([FromQuery] string? q, CancellationToken ct)
    {
        var question = (q ?? string.Empty).Trim().ToLowerInvariant();

        HelperIntent? best = null;
        var bestScore = 0;
        foreach (var intent in intents.Intents)
        {
            var score = intent.Keywords.Count(k => question.Contains(k.ToLowerInvariant()));
            if (score > bestScore)
            {
                bestScore = score;
                best = intent;
            }
        }

        if (best is null)
        {
            var knownTopics = intents.Intents.Select(i => i.Keywords.First()).ToList();
            return Ok(new { unknown = true, knownTopics });
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

        return Ok(new { answer, route });
    }
}
