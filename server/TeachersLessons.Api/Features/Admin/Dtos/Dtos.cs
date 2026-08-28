namespace TeachersLessons.Api.Features.Admin;

public record TeacherSummaryDto(
    Guid UserId,
    string FullName,
    string? Subject,
    string Email,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? DecidedAtUtc,
    string? PhotoETag);
