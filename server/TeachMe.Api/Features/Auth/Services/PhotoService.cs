using System.Security.Cryptography;

namespace TeachMe.Api.Features.Auth.Services;

/// <summary>The stored bytes and the tag that identifies them, ready for the controller to serve.</summary>
public readonly record struct StoredAvatar(byte[] Bytes, string ETag);

public interface IPhotoService
{
    Task<PhotoUpdatedResponse> ReplaceAsync(string? contentType, Stream content, CancellationToken ct);
    Task RemoveAsync(CancellationToken ct);
    Task<StoredAvatar?> FindAsync(Guid userId, CancellationToken ct);
    Task<bool> IsApprovedTeacherAsync(Guid userId, CancellationToken ct);
}

public class PhotoService(
    AppDbContext db,
    IAvatarImageProcessor processor,
    ICurrentUser currentUser,
    TimeProvider clock) : IPhotoService
{
    private static readonly HashSet<string> AcceptedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    public async Task<PhotoUpdatedResponse> ReplaceAsync(string? contentType, Stream content, CancellationToken ct)
    {
        if (contentType is null || !AcceptedContentTypes.Contains(contentType))
        {
            throw new ValidationApiException("file", "That file type isn't supported. Upload a JPEG, PNG or WebP.");
        }

        // ImageSharp needs a seekable stream for the header-only Identify pass.
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        var processed = processor.Process(buffer);

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

        return new PhotoUpdatedResponse(etag, now);
    }

    public async Task RemoveAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        var avatar = await db.Avatars.FirstOrDefaultAsync(a => a.UserId == userId, ct);
        if (avatar is not null)
        {
            db.Avatars.Remove(avatar);
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<StoredAvatar?> FindAsync(Guid userId, CancellationToken ct)
    {
        var avatar = await db.Avatars
            .Where(a => a.UserId == userId)
            .Select(a => new { a.Bytes, a.ETag })
            .FirstOrDefaultAsync(ct);

        return avatar is null ? null : new StoredAvatar(avatar.Bytes, avatar.ETag);
    }

    public Task<bool> IsApprovedTeacherAsync(Guid userId, CancellationToken ct) =>
        db.Teachers.AnyAsync(t => t.UserId == userId && t.Status == TeacherStatus.Approved, ct);

    private static string MakeETag(byte[] bytes)
    {
        var hash = MD5.HashData(bytes);
        return $"\"{Convert.ToHexStringLower(hash)}\"";
    }
}
