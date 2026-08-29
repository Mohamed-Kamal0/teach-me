namespace TeachMe.Api.Features.Helper.Services;

/// <summary>
/// The seam between the helper and whatever answers it. Every test in Suite G injects a fake here,
/// which is why not one of them spends a cent or needs a network.
/// </summary>
public interface IAnswerModel
{
    /// <summary>Null means "could not answer" — never an exception the caller has to interpret.</summary>
    Task<ModelAnswer?> AnswerAsync(string question, ContextPack pack, CancellationToken ct);
}

/// <summary>
/// What the model claims. <see cref="Route"/> is a suggestion and nothing more: it is checked
/// against this student's own screens before it reaches the client (AiHelperService).
/// </summary>
public record ModelAnswer(string? Answer, string? Route, bool Unknown);
