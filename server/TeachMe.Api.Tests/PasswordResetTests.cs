using System.Net;
using System.Net.Http.Json;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Suite H — resetting your own password. The endpoint takes no user id, so the tests that matter
/// are the ones proving it cannot be aimed anywhere else and cannot be reached by anyone who does
/// not already hold both the session and the current password.
/// </summary>
public class PasswordResetTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public PasswordResetTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Change_then_the_old_password_stops_working_and_the_new_one_starts()
    {
        const string email = "pw.f1@test.local";
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, email);

        var change = await Put(client, "Password1", "Password2");
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var anon = _factory.CreateClient();

        var withOld = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "Password1" });
        Assert.Equal(HttpStatusCode.BadRequest, withOld.StatusCode);

        var withNew = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "Password2" });
        Assert.Equal(HttpStatusCode.OK, withNew.StatusCode);
    }

    [Fact]
    public async Task A_wrong_current_password_is_refused_and_changes_nothing()
    {
        const string email = "pw.f2@test.local";
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, email);

        var change = await Put(client, "NotMyPassword9", "Password2");
        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);
        Assert.Contains("currentPassword", await change.Content.ReadAsStringAsync());

        // The account is untouched — the original password still signs in.
        var anon = _factory.CreateClient();
        var login = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "Password1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task A_new_password_that_breaks_the_policy_is_refused()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "pw.f3@test.local");

        // Too short, and no digit — the same rule registration enforces, enforced again here.
        var change = await Put(client, "Password1", "short");
        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);

        var body = await change.Content.ReadAsStringAsync();
        Assert.Contains("newPassword", body);
        Assert.Contains("at least 8 characters", body);
    }

    [Fact]
    public async Task Reusing_the_current_password_is_refused()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "pw.f4@test.local");

        var change = await Put(client, "Password1", "Password1");
        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);
        Assert.Contains("newPassword", await change.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Signed_out_it_is_401()
    {
        var anon = _factory.CreateClient();
        var change = await anon.PutAsJsonAsync("/api/me/password",
            new { currentPassword = "Password1", newPassword = "Password2" });

        Assert.Equal(HttpStatusCode.Unauthorized, change.StatusCode);
    }

    [Fact]
    public async Task A_session_without_the_csrf_header_is_refused()
    {
        const string email = "pw.f6@test.local";

        // A real client is a signed-in one that also echoes XSRF-TOKEN back as X-XSRF-TOKEN.
        // This one holds the session cookie and sends no header — which is exactly the shape a
        // cross-site form submission has, and the reason a password endpoint needs the check.
        var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register/student",
            new { fullName = "Test Student", email, password = "Password1" });
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "Password1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var change = await Put(client, "Password1", "Password2");

        Assert.Equal(HttpStatusCode.BadRequest, change.StatusCode);
        Assert.Contains("CSRF", await change.Content.ReadAsStringAsync());

        // And the password really is unchanged.
        var anon = _factory.CreateClient();
        var stillOld = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "Password1" });
        Assert.Equal(HttpStatusCode.OK, stillOld.StatusCode);
    }

    [Fact]
    public async Task One_person_changing_their_password_leaves_everyone_else_alone()
    {
        const string mine = "pw.f7.mine@test.local";
        const string theirs = "pw.f7.theirs@test.local";

        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, mine);
        var anon = _factory.CreateClient();
        await anon.PostAsJsonAsync("/api/auth/register/student",
            new { fullName = "Someone Else", email = theirs, password = "Password1" });

        var change = await Put(client, "Password1", "Password2");
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        // There is no user id in the request, so there is nothing to point at another account —
        // and this is the proof that nothing implicit does it either.
        var login = await anon.PostAsJsonAsync("/api/auth/login", new { email = theirs, password = "Password1" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task The_administrator_can_change_the_seeded_password_too()
    {
        var client = await TestAuth.SignedInAdminAsync(_factory);

        var change = await Put(client, ApiFactory.AdminPassword, "AdminPass2");
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        var anon = _factory.CreateClient();
        var login = await anon.PostAsJsonAsync("/api/auth/login",
            new { email = ApiFactory.AdminEmail, password = "AdminPass2" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        // Put it back: this class shares one database, and SignedInAdminAsync signs in with the
        // seeded password.
        var restore = await Put(client, "AdminPass2", ApiFactory.AdminPassword);
        Assert.Equal(HttpStatusCode.NoContent, restore.StatusCode);
    }

    private static Task<HttpResponseMessage> Put(HttpClient client, string current, string next) =>
        client.PutAsJsonAsync("/api/me/password", new { currentPassword = current, newPassword = next });
}
