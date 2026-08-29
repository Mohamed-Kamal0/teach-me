using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Options;

namespace TeachMe.Api.Features.Helper.Services;

/// <summary>
/// The only file in the codebase that knows a model vendor exists. Everything above it talks to
/// <see cref="IAnswerModel"/>, which is why swapping vendors — or switching the whole feature off —
/// touches nothing else.
/// </summary>
public class GeminiAnswerModel(
    Client client,
    IHelperSystemPrompt systemPrompt,
    IOptions<AiOptions> options,
    ILogger<GeminiAnswerModel> log) : IAnswerModel
{
    /// <summary>
    /// The response *is* the DTO — no parsing prose, no regex. A cheap model makes this do real
    /// work: it is what stops flash-lite answering in paragraphs. `route` is a plain string with
    /// "" for none rather than a nullable union, because the empty string round-trips through
    /// every structured-output implementation and reaches Validate() as "not an allowed route"
    /// without a special case.
    /// </summary>
    private const string SchemaJson = """
    {
      "type": "object",
      "properties": {
        "answer": {
          "type": "string",
          "description": "At most three sentences, addressed to the student."
        },
        "route": {
          "type": "string",
          "description": "One of the listed screen paths, or an empty string when none answers the question."
        },
        "unknown": {
          "type": "boolean",
          "description": "True when the student's data does not contain the answer."
        }
      },
      "required": ["answer", "route", "unknown"],
      "propertyOrdering": ["answer", "route", "unknown"]
    }
    """;

    private static readonly JsonNode AnswerSchema = JsonNode.Parse(SchemaJson)!;

    public async Task<ModelAnswer?> AnswerAsync(string question, ContextPack pack, CancellationToken ct)
    {
        var settings = options.Value;

        try
        {
            var response = await client.Models.GenerateContentAsync(
                model: settings.Model,
                contents:
                    $"<student-data>\n{JsonSerializer.Serialize(pack, JsonSerializerOptions.Web)}\n</student-data>\n\n" +
                    $"<question>\n{question}\n</question>",
                config: new GenerateContentConfig
                {
                    SystemInstruction = new Content { Parts = [new Part { Text = systemPrompt.Text }] },
                    // No ThinkingConfig, deliberately: thinking is off by default on the Lite
                    // models, and that default is most of why this is cheap. Measured on a real
                    // call to gemini-3.5-flash-lite, a helper question bills 602 prompt + 85
                    // candidate = 687 total tokens — the totals add up exactly, so nothing is
                    // being spent on thoughts. If that ever stops being true the debug line below
                    // is where it shows up first.
                    MaxOutputTokens = settings.MaxTokens,
                    Temperature = 0.2,
                    ResponseMimeType = "application/json",
                    ResponseJsonSchema = AnswerSchema,
                },
                cancellationToken: ct);

            // Without this the first question about the bill has no answer.
            if (response.UsageMetadata is { } usage)
            {
                log.LogDebug(
                    "Helper: {PromptTokens} prompt + {CandidateTokens} candidate = {TotalTokens} tokens",
                    usage.PromptTokenCount, usage.CandidatesTokenCount, usage.TotalTokenCount);
            }

            // Anything but a clean finish — a safety block, a token cut-off, an empty candidate —
            // is not an error here: we have a deterministic answer to fall back on.
            var candidate = response.Candidates?.FirstOrDefault();
            if (candidate?.FinishReason?.Value != FinishReason.Stop.Value)
            {
                log.LogInformation(
                    "Helper: model did not finish cleanly ({Reason})", candidate?.FinishReason?.Value ?? "no candidate");
                return null;
            }

            return ParseAnswer(TextOf(candidate));
        }
        catch (Exception ex)
        {
            // Deliberately broad on the way out: the SDK's exception types are not documented, and
            // guessing at a `when` filter would mean an undocumented type escaping as a 500 on a
            // route whose entire promise is that it degrades. Logged, then swallowed.
            log.LogWarning(ex, "Helper: model call failed, falling back to intents");
            return null;
        }
    }

    /// <summary>Every non-thought part, joined — a Lite model with thinking off returns one.</summary>
    private static string? TextOf(Candidate candidate)
    {
        var parts = candidate.Content?.Parts;
        if (parts is null || parts.Count == 0)
        {
            return null;
        }

        return string.Concat(parts.Where(p => p.Thought != true).Select(p => p.Text));
    }

    /// <summary>
    /// Public so Suite G can assert on it directly: a schema is a request, not a guarantee, and
    /// unparseable text has to become a null rather than an exception.
    /// </summary>
    public static ModelAnswer? ParseAnswer(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ModelAnswer>(text, JsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
