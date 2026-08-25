using TeachersLessons.Api.Common;

namespace TeachersLessons.Api.Features.Student;

public record CourseMembershipDto(Guid TeacherUserId, string TeacherFullName, DateTimeOffset JoinedAtUtc, DateTimeOffset? LastViewedAtUtc);

public record ProfileDto(
    Guid UserId, string Email, string FullName,
    string? DisplayName, string? Phone, string? Bio,
    List<CourseMembershipDto> Courses);

public record ProfileUpdateRequest(
    string? DisplayName, string? Phone, string? Bio,
    string? Email = null, string? FullName = null, string? Role = null);

public record JoinCourseRequest(string Code);

public record CourseSummaryDto(Guid TeacherUserId, string TeacherFullName, DateTimeOffset JoinedAtUtc, int LessonCount);

public record StudentLessonWithMarkDto(StudentLessonDto Lesson, int? Score, bool? Passed);

public record WhatsNewLessonEntry(Guid LessonId, string LessonTitle, string Kind);

public record WhatsNewCourseDto(Guid TeacherUserId, string TeacherFullName, bool Welcome, List<WhatsNewLessonEntry> NewItems);

public record WhatsNewResponse(int TotalNew, List<WhatsNewCourseDto> Courses);

public record StudentMarkDto(Guid LessonId, string LessonTitle, Guid TeacherUserId, string TeacherFullName, int Score, int QuizMaxScore, int PassMark, bool Passed, DateTimeOffset RecordedAtUtc);
