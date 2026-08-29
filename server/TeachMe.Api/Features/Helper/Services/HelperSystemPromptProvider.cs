namespace TeachMe.Api.Features.Helper.Services;

public interface IHelperSystemPrompt
{
    string Text { get; }
}

/// <summary>
/// The helper's voice is content, not code, so it lives beside helper-intents.json and is read
/// once for the same reason: it is edited by whoever tunes the helper, and a prompt change should
/// not be a C# diff.
/// </summary>
public class HelperSystemPromptProvider : IHelperSystemPrompt
{
    public string Text { get; }

    public HelperSystemPromptProvider(IWebHostEnvironment env) =>
        Text = File.ReadAllText(Path.Combine(env.ContentRootPath, "helper-system-prompt.md"));
}
