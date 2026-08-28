using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>Suite E — the profile-photo endpoint: re-encode on write, cached authenticated read,
/// 404-as-"draw initials", and the CSRF / size guards that only a real pipeline proves.</summary>
public class AvatarEndpointTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AvatarEndpointTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Put_a_png_then_get_it_back_as_webp()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "avatar.e1@test.local");
        var meId = await MeId(client);

        var put = await client.PutAsync("/api/me/photo", PngUpload(400, 400));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var body = await put.Content.ReadFromJsonAsync<PhotoUpdatedRow>(JsonDefaults.Options);
        Assert.False(string.IsNullOrWhiteSpace(body!.ETag));

        var get = await client.GetAsync($"/api/users/{meId}/photo");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("image/webp", get.Content.Headers.ContentType!.MediaType);
        Assert.Equal(body.ETag, get.Headers.ETag!.ToString());
        Assert.Contains("nosniff", get.Headers.GetValues("X-Content-Type-Options"));
    }

    [Fact]
    public async Task Get_with_a_matching_if_none_match_is_304()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "avatar.e2@test.local");
        var meId = await MeId(client);

        var put = await client.PutAsync("/api/me/photo", PngUpload(300, 300));
        var etag = (await put.Content.ReadFromJsonAsync<PhotoUpdatedRow>(JsonDefaults.Options))!.ETag;

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/users/{meId}/photo");
        request.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Parse(etag));
        var get = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, get.StatusCode);
    }

    [Fact]
    public async Task Delete_removes_the_photo_and_then_get_is_404()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "avatar.e3@test.local");
        var meId = await MeId(client);

        await client.PutAsync("/api/me/photo", PngUpload(256, 256));

        var delete = await client.DeleteAsync("/api/me/photo");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var get = await client.GetAsync($"/api/users/{meId}/photo");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);

        // Idempotent — a second delete is still 204.
        var deleteAgain = await client.DeleteAsync("/api/me/photo");
        Assert.Equal(HttpStatusCode.NoContent, deleteAgain.StatusCode);
    }

    [Fact]
    public async Task Get_while_unauthenticated_is_401()
    {
        var anon = _factory.CreateClient();

        var get = await anon.GetAsync($"/api/users/{Guid.NewGuid()}/photo");

        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
    }

    [Fact]
    public async Task Put_without_an_xsrf_token_is_400()
    {
        // A signed-in client that never picked up the X-XSRF-TOKEN header.
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register/student",
            new { fullName = "No Token", email = "avatar.e5@test.local", password = "Password1" });
        register.EnsureSuccessStatusCode();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new { email = "avatar.e5@test.local", password = "Password1" });
        login.EnsureSuccessStatusCode();

        var put = await client.PutAsync("/api/me/photo", PngUpload(200, 200));

        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
    }

    [Fact]
    public async Task Put_a_body_over_5mb_is_413()
    {
        var client = await TestAuth.RegisterAndSignInStudentAsync(_factory, "avatar.e6@test.local");

        var content = new MultipartFormDataContent();
        var big = new ByteArrayContent(new byte[6 * 1024 * 1024]);
        big.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(big, "file", "big.png");

        var put = await client.PutAsync("/api/me/photo", content);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, put.StatusCode);
    }

    private static async Task<Guid> MeId(HttpClient client)
    {
        var me = await client.GetFromJsonAsync<MeRow>("/api/me", JsonDefaults.Options);
        return me!.UserId;
    }

    private static MultipartFormDataContent PngUpload(int width, int height)
    {
        using var image = new Image<Rgba32>(width, height, new Rgba32(90, 140, 210));
        var buffer = new MemoryStream();
        image.SaveAsPng(buffer);

        var part = new ByteArrayContent(buffer.ToArray());
        part.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        var form = new MultipartFormDataContent();
        form.Add(part, "file", "photo.png");
        return form;
    }

    private record PhotoUpdatedRow(string ETag, DateTimeOffset UpdatedAtUtc);
    private record MeRow(Guid UserId);
}
