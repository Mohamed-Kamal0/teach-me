using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeachersLessons.Api.Features.Helper;
using TeachersLessons.Api.Features.Helper.Services;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>
/// The one test that spends money. It is skipped unless HELPER_LIVE=1 is set, so it never runs in
/// CI — it exists so a real key is exercised before a demo rather than during one.
///
/// It asserts that the *model* answered, not merely that the endpoint did: every failure path in
/// this feature degrades to the phrase list with a 200, so a test that only checked the response
/// body would pass with no working key at all. The real GeminiAnswerModel is wrapped in a spy, and
/// a null from it fails the test with whatever the API actually said.
/// </summary>
public class AiHelperLiveTests
{
    /// <summary>GEMINI_API_KEY if it is set, otherwise Ai:ApiKey from the API project's user-secrets.</summary>
    private static string? ApiKey
    {
        get
        {
            if (Environment.GetEnvironmentVariable("HELPER_LIVE") != "1")
            {
                return null;
            }

            var fromEnvironment = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (!string.IsNullOrWhiteSpace(fromEnvironment))
            {
                return fromEnvironment;
            }

            // The README tells you to put the key in user-secrets, so look where it was put. The
            // id is TeachersLessons.Api's UserSecretsId.
            return new ConfigurationBuilder()
                .AddUserSecrets("b2147ebe-a8d4-4971-8642-2552a4732333")
                .Build()["Ai:ApiKey"];
        }
    }

    private static readonly HashSet<string> AllowedRoutes =
    [
        "/student/courses", "/student/marks", "/student/whats-new",
        "/student/join", "/student/profile", "/teachers",
    ];

    [Fact]
    public async Task A_real_question_comes_back_grounded_and_routed_inside_the_allowlist()
    {
        var apiKey = ApiKey;
        if (apiKey is null)
        {
            return;   // opt-in only: set HELPER_LIVE=1, and a key in user-secrets or GEMINI_API_KEY
        }

        var factory = new LiveAiApiFactory(apiKey);
        await ((IAsyncLifetime)factory).InitializeAsync();
        try
        {
            var now = factory.Clock.GetUtcNow();
            var teacher = await TestAuth.RegisterAndSignInTeacherAsync(factory, "liveteacher@test.local", "Amal Hassan");
            var admin = await TestAuth.SignedInAdminAsync(factory);
            var pending = await (await admin.GetAsync("/api/admin/teachers?status=Pending&pageSize=200"))
                .Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
            var teacherUserId = pending!.Items.First(t => t.Email == "liveteacher@test.local").UserId;
            await admin.PostAsync($"/api/admin/teachers/{teacherUserId}/approve", null);

            // One lesson open, its quiz not yet, its answers not yet — so "have the answers gone up"
            // has a real answer that is only in this student's data.
            await teacher.PostAsJsonAsync("/api/teacher/lessons", new
            {
                title = "Vectors, part one",
                orderIndex = 1,
                recordingUrl = "https://example.com/recording-1",
                handoutUrl = (string?)null,
                quizUrl = "https://example.com/quiz",
                answersUrl = "https://example.com/answers",
                durationMinutes = 30,
                quizMaxScore = 10,
                passMark = 5,
                opensAtUtc = now.AddHours(-1),
                quizOpensAtUtc = now.AddDays(1),
                answersOpenAtUtc = now.AddDays(2)
            });

            var joinCode = (await (await teacher.GetAsync("/api/teacher/students"))
                .Content.ReadFromJsonAsync<TeacherStudents>(JsonDefaults.Options))!.JoinCode;

            var student = await TestAuth.RegisterAndSignInStudentAsync(factory, "livestudent@test.local", "Sara Nabil");
            await student.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });

            // HELPER_LIVE_Q asks something else instead — this is how you read ten real answers
            // before a demo (ai.md §16) without editing the test each time.
            var question = Environment.GetEnvironmentVariable("HELPER_LIVE_Q")
                ?? "has my teacher put the answers up yet";

            var response = await student.GetAsync($"/api/helper/ask?q={Uri.EscapeDataString(question)}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // The model actually answered — not the phrase list standing in for it.
            Assert.True(
                factory.Spy.LastAnswer is not null,
                "The model returned nothing, so the phrase list answered instead. The reason is on "
                + "this run's console, logged by GeminiAnswerModel as \"Helper: model call failed\" "
                + "or \"Helper: model did not finish cleanly\".");

            var answer = (await response.Content.ReadFromJsonAsync<HelperAnswer>(JsonDefaults.Options))!;
            Assert.False(string.IsNullOrWhiteSpace(answer.Answer) && !answer.Unknown);

            if (answer.Route is not null)
            {
                Assert.True(
                    AllowedRoutes.Contains(answer.Route) || answer.Route == $"/student/courses/{teacherUserId}",
                    $"The model chose a route outside the allowlist: {answer.Route}");
            }

            // Printed so `dotnet test -l "console;verbosity=detailed"` shows what it actually said —
            // §16's "read ten real answers before the demo, not after".
            Console.WriteLine($"[live] asked : {question}");
            Console.WriteLine($"[live] answer: {answer.Answer}");
            Console.WriteLine($"[live] route : {answer.Route ?? "(none)"}  unknown: {answer.Unknown}");
        }
        finally
        {
            await ((IAsyncLifetime)factory).DisposeAsync();
        }
    }

    /// <summary>Wraps the real model so the test can tell "it answered" from "it fell over".</summary>
    private class SpyAnswerModel(IAnswerModel inner) : IAnswerModel
    {
        public ModelAnswer? LastAnswer { get; private set; }

        public async Task<ModelAnswer?> AnswerAsync(string question, ContextPack pack, CancellationToken ct)
        {
            LastAnswer = await inner.AnswerAsync(question, pack, ct);
            return LastAnswer;
        }
    }

    private class LiveAiApiFactory(string apiKey) : ApiFactory
    {
        public SpyAnswerModel Spy { get; private set; } = null!;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("Ai:Enabled", "true");
            builder.UseSetting("Ai:ApiKey", apiKey);
            // GeminiAnswerModel logs the per-call token counts at debug, and this is the run where
            // you want to read them. Serilog owns the logging pipeline (Program.cs calls UseSerilog
            // without writeToProviders), so the level has to be set where Serilog reads it and the
            // output arrives on the test run's console rather than through an ILoggerProvider.
            builder.UseSetting("Serilog:MinimumLevel:Default", "Debug");

            builder.ConfigureServices(services =>
            {
                services.AddScoped<GeminiAnswerModel>();
                services.RemoveAll<IAnswerModel>();
                services.AddSingleton<IAnswerModel>(sp =>
                {
                    // Scoped inner, resolved once: the spy has to outlive the request to be read
                    // after it, and one request is all this test makes.
                    var scope = sp.CreateScope();
                    Spy = new SpyAnswerModel(scope.ServiceProvider.GetRequiredService<GeminiAnswerModel>());
                    return Spy;
                });

            });
        }
    }

    private record HelperAnswer(string? Answer, string? Route, bool Unknown, List<string>? KnownTopics);
    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record TeacherStudents(string JoinCode, PagedStudents Students);
    private record PagedStudents(List<StudentRow> Items);
    private record StudentRow(Guid UserId, string Email);
}
