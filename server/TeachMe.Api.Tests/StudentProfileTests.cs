using System.Net;
using System.Net.Http.Json;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Suite I — a student editing their own details. The page draws its card from whatever the PUT
/// answers with, so what matters here is that the answer is the stored row and not an echo of the
/// request: a value the server trimmed, blanked or refused has to be visible in that response.
/// </summary>
public class StudentProfileTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public StudentProfileTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Saved_details_come_back_in_the_response_and_on_the_next_read()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "profile.i1@test.local");

        var save = await client.PutAsJsonAsync("/api/student/profile", new
        {
            displayName = "  Nour  ",
            phone = "+20 100 555 0142",
            dateOfBirth = "2004-03-18",
            bio = "Revising for finals."
        });
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        var saved = await save.Content.ReadFromJsonAsync<ProfileRow>(JsonDefaults.Options);
        Assert.Equal("Nour", saved!.DisplayName);          // trimmed on the way in
        Assert.Equal("+20 100 555 0142", saved.Phone);
        Assert.Equal(new DateOnly(2004, 3, 18), saved.DateOfBirth);
        Assert.Equal("Revising for finals.", saved.Bio);

        // The same values a page refresh would find — the response was the row, not an echo.
        var reread = await client.GetFromJsonAsync<ProfileRow>("/api/student/profile", JsonDefaults.Options);
        Assert.Equal(saved.DisplayName, reread!.DisplayName);
        Assert.Equal(saved.Phone, reread.Phone);
        Assert.Equal(saved.DateOfBirth, reread.DateOfBirth);
        Assert.Equal(saved.Bio, reread.Bio);
    }

    [Fact]
    public async Task Clearing_a_field_removes_it_rather_than_leaving_the_old_value()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "profile.i2@test.local");

        await client.PutAsJsonAsync("/api/student/profile", new
        {
            displayName = "Omar",
            phone = "01005550142",
            dateOfBirth = "2003-11-02",
            bio = "Here for the physics."
        });

        var cleared = await client.PutAsJsonAsync("/api/student/profile", new
        {
            displayName = (string?)null,
            phone = "   ",
            dateOfBirth = (string?)null,
            bio = (string?)null
        });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);

        var profile = await cleared.Content.ReadFromJsonAsync<ProfileRow>(JsonDefaults.Options);
        Assert.Null(profile!.DisplayName);
        Assert.Null(profile.Phone);                        // whitespace counts as blank
        Assert.Null(profile.DateOfBirth);
        Assert.Null(profile.Bio);
    }

    [Fact]
    public async Task A_date_of_birth_in_the_future_is_refused_and_nothing_is_stored()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "profile.i3@test.local");

        var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)).ToString("yyyy-MM-dd");
        var save = await client.PutAsJsonAsync("/api/student/profile", new
        {
            displayName = "Salma",
            phone = (string?)null,
            dateOfBirth = tomorrow,
            bio = (string?)null
        });
        Assert.Equal(HttpStatusCode.BadRequest, save.StatusCode);

        // The whole request failed, so the display name in it was not written either.
        var profile = await client.GetFromJsonAsync<ProfileRow>("/api/student/profile", JsonDefaults.Options);
        Assert.Null(profile!.DateOfBirth);
        Assert.Null(profile.DisplayName);
    }

    private record ProfileRow(
        Guid UserId, string Email, string FullName,
        string? DisplayName, string? Phone, string? Bio, DateOnly? DateOfBirth,
        string? PhotoETag);
}
