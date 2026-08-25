namespace TeachersLessons.Api.Features.Admin;

public record TeacherSummaryDto(
    Guid UserId,
    string FullName,
    string Email,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? DecidedAtUtc);
