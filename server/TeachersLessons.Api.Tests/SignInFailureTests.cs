using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>
/// Suite J — what a refused sign-in says, and what it is careful not to say. The message is the
/// same for an unknown address and a wrong password, and it is named after the pair rather than
/// after either half: a key in the errors dictionary is a field name, and the client puts the
/// message under the box of that name. Naming `email` would both accuse a field the server has
/// no opinion about and leave that box holding an error after only the password was corrected.
/// </summary>
public class SignInFailureTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public SignInFailureTests(ApiFactory factory) => _factory = factory;

    private async Task<Dictionary<string, string[]>> ErrorsFrom(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(JsonDefaults.Options);
        return JsonSerializer.Deserialize<Dictionary<string, string[]>>(
            body.GetProperty("errors").GetRawText(), JsonDefaults.Options)!;
    }

    [Fact]
    public async Task A_wrong_password_is_refused_without_naming_either_box()
    {
        const string email = "signin.j1@test.local";
        await TestAuth.RegisterAndSignInStudentAsync(_factory, email);

        var anon = _factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "WrongPassword1" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var errors = await ErrorsFrom(response);
        Assert.Equal(["Email or password is incorrect."], errors["credentials"]);
        // Neither name matches a control on the sign-in form, which is what keeps the message
        // over the form and off a field that would then block the next attempt.
        Assert.False(errors.ContainsKey("email"));
        Assert.False(errors.ContainsKey("password"));
    }

    [Fact]
    public async Task An_unknown_address_is_refused_in_exactly_the_same_words()
    {
        var anon = _factory.CreateClient();
        var response = await anon.PostAsJsonAsync(
            "/api/auth/login", new { email = "nobody.j2@test.local", password = "Password1" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var errors = await ErrorsFrom(response);
        // Same key, same sentence: nothing here tells a caller whether an address is registered.
        Assert.Equal(["Email or password is incorrect."], errors["credentials"]);
    }

    [Fact]
    public async Task A_shape_error_still_lands_on_the_field_it_is_about()
    {
        var anon = _factory.CreateClient();
        var response = await anon.PostAsJsonAsync("/api/auth/login", new { email = "not-an-address", password = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var errors = await ErrorsFrom(response);
        Assert.True(errors.ContainsKey("email") || errors.ContainsKey("password"));
        Assert.False(errors.ContainsKey("credentials"));
    }
}
