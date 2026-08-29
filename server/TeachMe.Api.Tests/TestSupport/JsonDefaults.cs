using System.Text.Json;

namespace TeachMe.Api.Tests.TestSupport;

public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
