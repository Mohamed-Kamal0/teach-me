namespace TeachersLessons.Api.Features.Teacher;

public record StudentSummaryDto(Guid UserId, string FullName, string Email, DateTimeOffset JoinedAtUtc, string? PhotoETag);

public record TeacherStudentsResponse(string JoinCode, PagedResult<StudentSummaryDto> Students);

public record LessonMarkDto(
    Guid LessonId, string LessonTitle, int OrderIndex, int QuizMaxScore, int PassMark,
    int Score, bool Passed, DateTimeOffset RecordedAtUtc, DateTimeOffset? UpdatedAtUtc, Guid MarkId);

/// <summary>
/// A student as their teacher sees them: who they are, then how they are doing. Read-only —
/// DisplayName, Phone and Bio belong to the student and are written from ProfileController.
/// </summary>
public record StudentProfileDto(
    Guid UserId,
    string FullName,
    string? DisplayName,
    string Email,
    string? Phone,
    string? Bio,
    string? PhotoETag,
    DateTimeOffset JoinedAtUtc,
    int TotalLessons,
    int LessonsMarked,
    int PassedCount,
    int FailedCount,
    List<LessonMarkDto> Marks);

public record RecordMarkRequest(Guid LessonId, Guid StudentUserId, int Score);
public record UpdateMarkRequest(int Score);
public record MarkDto(Guid Id, Guid LessonId, Guid StudentUserId, int Score, bool Passed, DateTimeOffset RecordedAtUtc, DateTimeOffset? UpdatedAtUtc);

public record ProgressDto(Guid StudentUserId, string FullName, string? PhotoETag, int LessonsMarked, int TotalLessons, int PassedCount, int FailedCount);
