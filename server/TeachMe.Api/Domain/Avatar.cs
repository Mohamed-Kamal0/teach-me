namespace TeachMe.Api.Domain;

public class Avatar
{
    public Guid UserId { get; set; }          // PK and FK to User, 1:0..1
    public User User { get; set; } = null!;

    public byte[] Bytes { get; set; } = [];   // always WebP, always 256x256, produced by us
    public string ContentType { get; set; } = "image/webp";
    public int ByteSize { get; set; }
    public string ETag { get; set; } = string.Empty;   // "\"<32 hex>\"" — new value on every write
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
