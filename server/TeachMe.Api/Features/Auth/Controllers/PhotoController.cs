using Microsoft.AspNetCore.Authorization;
using Microsoft.Net.Http.Headers;
using TeachMe.Api.Features.Auth.Services;

namespace TeachMe.Api.Features.Auth.Controllers;

[ApiController]
[Authorize]
public class PhotoController(IPhotoService photos, ILogger<PhotoController> logger) : ControllerBase
{
    private const long MaxUploadBytes = 5_242_880;

    [HttpPut("api/me/photo")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<ActionResult<PhotoUpdatedResponse>> Put(IFormFile? file, CancellationToken ct)
    {
        // [RequestSizeLimit] is the real defence behind Kestrel; this explicit check makes the 413
        // deterministic across hosts (the multipart binder otherwise just drops the oversized part
        // and hands the action a null file).
        if (Request.ContentLength > MaxUploadBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge,
                new ProblemDetails { Title = "That photo is too large. Use one under 5 MB.", Status = StatusCodes.Status413PayloadTooLarge });
        }

        if (file is null || file.Length == 0)
        {
            throw new ValidationApiException("file", "Choose a photo to upload.");
        }

        await using var stream = file.OpenReadStream();
        return Ok(await photos.ReplaceAsync(file.ContentType, stream, ct));
    }

    [HttpDelete("api/me/photo")]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        await photos.RemoveAsync(ct);
        return NoContent();
    }

    [HttpGet("api/users/{userId:guid}/photo")]
    public Task<IActionResult> Get(Guid userId, CancellationToken ct) =>
        ServeAvatar(userId, "private, max-age=300", ct);

    /// <summary>
    /// The directory is read by people with no session, and the authenticated route above
    /// answers them 401. Rather than open that route to every user id, this one asks the
    /// question in the query: the authorisation is "is this an approved teacher", not a claim.
    /// </summary>
    [HttpGet("api/public/teachers/{userId:guid}/photo")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicTeacherPhoto(Guid userId, CancellationToken ct)
    {
        if (!await photos.IsApprovedTeacherAsync(userId, ct))
        {
            // "No photo" and "not a public teacher" answer identically — nothing here tells a
            // caller whether a given id is a person at all.
            return NotFound();
        }

        // A teacher's directory photo is fine in a shared cache; a student's is not, which is
        // the one thing that differs between the two callers.
        return await ServeAvatar(userId, "public, max-age=300", ct);
    }

    /// <summary>The caching contract — ETag, If-None-Match → 304, nosniff — written once.</summary>
    private async Task<IActionResult> ServeAvatar(Guid userId, string cacheControl, CancellationToken ct)
    {
        var avatar = await photos.FindAsync(userId, ct);
        if (avatar is null)
        {
            // The client reads 404 as "draw the initials tile" — a normal path, not a fault.
            logger.LogDebug("No photo for user {UserId}", userId);
            return NotFound();
        }

        Response.Headers[HeaderNames.CacheControl] = cacheControl;
        Response.Headers[HeaderNames.ETag] = avatar.Value.ETag;
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
        if (!string.IsNullOrEmpty(ifNoneMatch) && ifNoneMatch == avatar.Value.ETag)
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(avatar.Value.Bytes, "image/webp");
    }
}
