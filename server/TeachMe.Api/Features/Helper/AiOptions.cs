namespace TeachMe.Api.Features.Helper;

/// <summary>
/// Bound from the <c>Ai</c> section. <see cref="ApiKey"/> is the only value that never appears in
/// appsettings.json — it comes from user-secrets locally and <c>Ai__ApiKey</c> in production — and
/// its absence is not fatal: with no key the helper answers from helper-intents.json exactly as it
/// always has. That is the rollback plan, and it is one unset secret away.
/// </summary>
public class AiOptions
{
    public const string SectionName = "Ai";

    public bool Enabled { get; set; } = true;
    public string? ApiKey { get; set; }
    public string Model { get; set; } = "gemini-3.5-flash-lite";
    public int MaxTokens { get; set; } = 512;
    public int TimeoutSeconds { get; set; } = 6;
    public int MaxQuestionLength { get; set; } = 300;
    public int RateLimitPerMinute { get; set; } = 6;
    public int RateLimitPerDay { get; set; } = 60;

    /// <summary>The AI path is wired only when it is switched on *and* there is a key to use.</summary>
    public bool IsUsable => Enabled && !string.IsNullOrWhiteSpace(ApiKey);
}
