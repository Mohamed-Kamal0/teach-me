using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TeachMe.Api.Data;

/// <summary>
/// SQLite's EF Core provider only translates equality on DateTimeOffset, not &lt;/&lt;=/&gt;/&gt;= —
/// and the whole timing-enforcement story (LessonQueries.VisibleTo) depends on those comparisons
/// running in the database. Storing everything as a UTC DateTime instead keeps the C# model on
/// DateTimeOffset (values are always UTC here) while making every comparison translatable.
/// </summary>
public class DateTimeOffsetToUtcDateTimeConverter() : ValueConverter<DateTimeOffset, DateTime>(
    v => v.UtcDateTime,
    v => new DateTimeOffset(DateTime.SpecifyKind(v, DateTimeKind.Utc)));

public class NullableDateTimeOffsetToUtcDateTimeConverter() : ValueConverter<DateTimeOffset?, DateTime?>(
    v => v.HasValue ? v.Value.UtcDateTime : null,
    v => v.HasValue ? new DateTimeOffset(DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : null);
