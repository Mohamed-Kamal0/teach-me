using System.Text.Json;

namespace TeachMe.Api.Features.Helper.Services;

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
