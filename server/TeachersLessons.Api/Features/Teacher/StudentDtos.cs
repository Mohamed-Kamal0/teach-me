namespace TeachersLessons.Api.Features.Teacher;

public record StudentSummaryDto(Guid UserId, string FullName, string Email, DateTimeOffset JoinedAtUtc);

public record TeacherStudentsResponse(string JoinCode, PagedResult<StudentSummaryDto> Students);

public record LessonMarkDto(
    Guid LessonId, string LessonTitle, int OrderIndex, int QuizMaxScore, int PassMark,
    int Score, bool Passed, DateTimeOffset RecordedAtUtc, DateTimeOffset? UpdatedAtUtc, Guid MarkId);

public record StudentGradeDetailDto(Guid UserId, string FullName, string Email, List<LessonMarkDto> Marks);

public record RecordMarkRequest(Guid LessonId, Guid StudentUserId, int Score);
public record UpdateMarkRequest(int Score);
public record MarkDto(Guid Id, Guid LessonId, Guid StudentUserId, int Score, bool Passed, DateTimeOffset RecordedAtUtc, DateTimeOffset? UpdatedAtUtc);

public record ProgressDto(Guid StudentUserId, string FullName, int LessonsMarked, int TotalLessons, int PassedCount, int FailedCount);
