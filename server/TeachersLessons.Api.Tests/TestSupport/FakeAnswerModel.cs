using System.Text.Json;
using TeachersLessons.Api.Features.Helper;
using TeachersLessons.Api.Features.Helper.Services;

namespace TeachersLessons.Api.Tests.TestSupport;

/// <summary>
/// The seam Suite G injects itself into. Because IAnswerModel is the only thing between the helper
/// and a model vendor, not one test in CI spends a cent or needs a network — and the context pack
/// the real builder produced is captured here as text, which is how the leak tests read it.
/// </summary>
public class FakeAnswerModel : IAnswerModel
{
    private int _invocations;

    public int Invocations => Volatile.Read(ref _invocations);

    /// <summary>The pack exactly as the model would have been shown it.</summary>
    public string? LastPackJson { get; private set; }

    public string? LastQuestion { get; private set; }

    public Func<string, ContextPack, CancellationToken, Task<ModelAnswer?>> Handler { get; set; } =
        (_, _, _) => Task.FromResult<ModelAnswer?>(null);

    public void Reset(Func<string, ContextPack, CancellationToken, Task<ModelAnswer?>>? handler = null)
    {
        Volatile.Write(ref _invocations, 0);
        LastPackJson = null;
        LastQuestion = null;
        Handler = handler ?? ((_, _, _) => Task.FromResult<ModelAnswer?>(null));
    }

    /// <summary>Answers with this, and records nothing else.</summary>
    public void Returns(string? answer, string? route, bool unknown = false) =>
        Reset((_, _, _) => Task.FromResult<ModelAnswer?>(new ModelAnswer(answer, route, unknown)));

    public Task<ModelAnswer?> AnswerAsync(string question, ContextPack pack, CancellationToken ct)
    {
        Interlocked.Increment(ref _invocations);
        LastQuestion = question;
        LastPackJson = JsonSerializer.Serialize(pack, JsonSerializerOptions.Web);
        return Handler(question, pack, ct);
    }
}
