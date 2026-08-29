using System.Buffers.Text;
using System.Text;

namespace TeachMe.Api.Common;

/// <summary>
/// One slice of a list, and the key that asks for the slice after it. Keyset paging rather than
/// an offset: these lists are read while they are being written to — a teacher approves someone,
/// a student joins — and OFFSET answers a moving list by skipping rows that moved, so a visitor
/// scrolling a directory would see a card twice and never see another one at all. The cursor
/// names the last row handed out, so the next request resumes from a row rather than a count.
/// </summary>
public sealed class CursorPage<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];

    /// <summary>Pass back as <c>?cursor=</c> for the next slice. Null when this was the last one.</summary>
    public string? NextCursor { get; init; }

    /// <summary>
    /// How many rows the whole list holds. Sent with the first slice only — counting is a scan,
    /// and a caller walking a list already has the number from the request that started the walk.
    /// </summary>
    public int? Total { get; init; }
}

/// <summary>
/// The cursor is the sort key of the last row on the previous slice, base64url'd so that it
/// reads as an opaque token and nobody is tempted to build one by hand. It is not a secret and
/// not signed: everything in it is a value the caller was just sent.
/// </summary>
public static class Cursor
{
    public const int MaxLimit = 100;
    public const int DefaultLimit = 20;

    /// <summary>Unit separator — a control character no name, subject or id can contain.</summary>
    private const char Separator = '\u001f';

    public static int NormalizeLimit(int? limit) =>
        limit is null or < 1 ? DefaultLimit : Math.Min(limit.Value, MaxLimit);

    public static string Encode(params string[] parts) =>
        Base64Url.EncodeToString(Encoding.UTF8.GetBytes(string.Join(Separator, parts)));

    /// <summary>
    /// Null for the first slice. A cursor that does not decode, or that carries the wrong number
    /// of fields for this list, is a bad request rather than a silent restart from the top — a
    /// caller quietly served page one when it asked for page four would never notice the loop.
    /// </summary>
    public static CursorKey? Read(string? cursor, int fields)
    {
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return null;
        }

        if (!Base64Url.IsValid(cursor))
        {
            throw Malformed();
        }

        var parts = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(cursor)).Split(Separator);
        if (parts.Length != fields)
        {
            throw Malformed();
        }

        return new CursorKey(parts);
    }

    internal static ValidationApiException Malformed() =>
        new("cursor", "That cursor isn't one we handed out — reload the list and start again.");
}

/// <summary>The decoded sort key. Every read is checked: a hand-edited cursor is a 400, not a cast
/// exception at the point the value reaches the query.</summary>
public readonly struct CursorKey(string[] parts)
{
    public string Text(int index) => parts[index];

    public int Int(int index) =>
        int.TryParse(parts[index], out var value) ? value : throw Cursor.Malformed();

    public Guid Uuid(int index) =>
        Guid.TryParse(parts[index], out var value) ? value : throw Cursor.Malformed();
}
