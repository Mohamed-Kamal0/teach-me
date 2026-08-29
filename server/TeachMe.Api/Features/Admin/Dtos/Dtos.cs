namespace TeachMe.Api.Features.Admin;

public record TeacherSummaryDto(
    Guid UserId,
    string FullName,
    string? Subject,
    string Email,
    string? Phone,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? DecidedAtUtc,
    string? PhotoETag);
