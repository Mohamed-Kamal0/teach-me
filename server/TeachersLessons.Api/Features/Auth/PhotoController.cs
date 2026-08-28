using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Features.Auth;

[ApiController]
[Authorize]
public class PhotoController(
    AppDbContext db,
    IAvatarImageProcessor processor,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<PhotoController> logger) : ControllerBase
{
    private const long MaxUploadBytes = 5_242_880;

    private static readonly HashSet<string> AcceptedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

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

        if (!AcceptedContentTypes.Contains(file.ContentType))
        {
            throw new ValidationApiException("file", "That file type isn't supported. Upload a JPEG, PNG or WebP.");
        }

        AvatarImage processed;
        await using (var stream = file.OpenReadStream())
        {
            // ImageSharp needs a seekable stream for the header-only Identify pass.
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            processed = processor.Process(buffer);
        }

        var userId = currentUser.UserId;
        var now = clock.GetUtcNow();
        var etag = MakeETag(processed.Webp);

        var avatar = await db.Avatars.FirstOrDefaultAsync(a => a.UserId == userId, ct);
        if (avatar is null)
        {
            avatar = new Avatar { UserId = userId };
            db.Avatars.Add(avatar);
        }

        avatar.Bytes = processed.Webp;
        avatar.ContentType = "image/webp";
        avatar.ByteSize = processed.Webp.Length;
        avatar.ETag = etag;
        avatar.UpdatedAtUtc = now;

        await db.SaveChangesAsync(ct);

        return Ok(new PhotoUpdatedResponse(etag, now));
    }

    [HttpDelete("api/me/photo")]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var avatar = await db.Avatars.FirstOrDefaultAsync(a => a.UserId == userId, ct);
        if (avatar is not null)
        {
            db.Avatars.Remove(avatar);
            await db.SaveChangesAsync(ct);
        }

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
        var isPublicTeacher = await db.Teachers
            .AnyAsync(t => t.UserId == userId && t.Status == TeacherStatus.Approved, ct);

        if (!isPublicTeacher)
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
        var avatar = await db.Avatars
            .Where(a => a.UserId == userId)
            .Select(a => new { a.Bytes, a.ETag })
            .FirstOrDefaultAsync(ct);

        if (avatar is null)
        {
            // The client reads 404 as "draw the initials tile" — a normal path, not a fault.
            logger.LogDebug("No photo for user {UserId}", userId);
            return NotFound();
        }

        Response.Headers[HeaderNames.CacheControl] = cacheControl;
        Response.Headers[HeaderNames.ETag] = avatar.ETag;
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
        if (!string.IsNullOrEmpty(ifNoneMatch) && ifNoneMatch == avatar.ETag)
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(avatar.Bytes, "image/webp");
    }

    private static string MakeETag(byte[] bytes)
    {
        var hash = MD5.HashData(bytes);
        return $"\"{Convert.ToHexStringLower(hash)}\"";
    }
}
