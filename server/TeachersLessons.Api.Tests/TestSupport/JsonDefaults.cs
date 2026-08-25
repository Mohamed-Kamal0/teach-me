using System.Text.Json;

namespace TeachersLessons.Api.Tests.TestSupport;

public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
