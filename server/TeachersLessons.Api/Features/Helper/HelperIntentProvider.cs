using System.Text.Json;
using System.Text.Json.Serialization;

namespace TeachersLessons.Api.Features.Helper;

public record HelperIntent(
    [property: JsonPropertyName("keywords")] List<string> Keywords,
    [property: JsonPropertyName("answer")] string Answer,
    [property: JsonPropertyName("route")] string? Route);

public interface IHelperIntentProvider
{
    IReadOnlyList<HelperIntent> Intents { get; }
}

public class HelperIntentProvider : IHelperIntentProvider
{
    public IReadOnlyList<HelperIntent> Intents { get; }

    public HelperIntentProvider(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "helper-intents.json");
        var json = File.ReadAllText(path);
        Intents = JsonSerializer.Deserialize<List<HelperIntent>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }
}
