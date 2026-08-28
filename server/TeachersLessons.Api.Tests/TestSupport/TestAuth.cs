using System.Net.Http.Json;

namespace TeachersLessons.Api.Tests.TestSupport;

/// <summary>
/// Mirrors the real client flow: log in (exempt from CSRF), then call /api/me — which, like every
/// request, runs through AntiforgeryMiddleware and re-issues XSRF-TOKEN now bound to the signed-in
/// principal. The pre-login token doesn't validate post-login; this is what makes it work.
/// </summary>
public static class TestAuth
{
    public static async Task<HttpClient> SignedInClientAsync(ApiFactory factory, string email, string password)
    {
        var client = factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        await EnsureSuccessAsync(login);

        var me = await client.GetAsync("/api/me");
        await EnsureSuccessAsync(me);

        var xsrf = ExtractCookieValue(me, "XSRF-TOKEN")
            ?? throw new InvalidOperationException("XSRF-TOKEN cookie was not issued.");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", xsrf);

        return client;
    }

    public static async Task<HttpClient> RegisterAndSignInTeacherAsync(ApiFactory factory, string email, string fullName = "Test Teacher", string password = "Password1", string subject = "General Studies")
    {
        var anon = factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/auth/register/teacher", new { fullName, email, password, subject });
        await EnsureSuccessAsync(response);
        return await SignedInClientAsync(factory, email, password);
    }

    public static async Task<HttpClient> RegisterAndSignInStudentAsync(ApiFactory factory, string email, string fullName = "Test Student", string password = "Password1")
    {
        var anon = factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/auth/register/student", new { fullName, email, password });
        await EnsureSuccessAsync(response);
        return await SignedInClientAsync(factory, email, password);
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"{(int)response.StatusCode} {response.StatusCode}: {body}");
        }
    }

    public static async Task<HttpClient> SignedInAdminAsync(ApiFactory factory) =>
        await SignedInClientAsync(factory, ApiFactory.AdminEmail, ApiFactory.AdminPassword);

    private static string? ExtractCookieValue(HttpResponseMessage response, string cookieName)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            return null;
        }

        foreach (var cookie in cookies)
        {
            var prefix = cookieName + "=";
            if (cookie.StartsWith(prefix, StringComparison.Ordinal))
            {
                var end = cookie.IndexOf(';');
                var value = end >= 0 ? cookie[prefix.Length..end] : cookie[prefix.Length..];
                return Uri.UnescapeDataString(value);
            }
        }

        return null;
    }
}
