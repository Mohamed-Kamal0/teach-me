using System.Text.Json.Serialization;

namespace TeachersLessons.Api.Features.Helper;

public record HelperIntent(
    [property: JsonPropertyName("keywords")] List<string> Keywords,
    [property: JsonPropertyName("answer")] string Answer,
    [property: JsonPropertyName("route")] string? Route);

/// <summary>
/// Either an answer (with an optional route to send the student to) or, when nothing matched,
/// <c>Unknown</c> plus the topics that would have. The unused half is omitted from the JSON
/// rather than sent as null, so each response carries only the shape the client will read.
/// </summary>
public record HelperAnswerResponse(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Answer,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Route,
    bool Unknown,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] List<string>? KnownTopics);
