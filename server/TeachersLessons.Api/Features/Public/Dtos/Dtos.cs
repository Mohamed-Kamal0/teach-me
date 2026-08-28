namespace TeachersLessons.Api.Features.Public;

public record HomeResponse(int ApprovedTeacherCount, int LessonCount, string HowToJoin);

/// <summary>
/// What an approved teacher advertises about their own course. Deliberately not
/// <c>TeacherSummaryDto</c>: that one carries an email, and the admin screen may grow more
/// fields later — a separate record is what stops one of them landing on an anonymous page.
/// Every number here is an aggregate over the teacher's own course; none can be traced to
/// one student.
/// </summary>
public record PublicTeacherDto(
    Guid UserId,
    string FullName,
    string? Subject,           // what they teach, in their own words; null for a row that predates the field
    string? PhotoETag,
    DateTimeOffset MemberSinceUtc,
    int OpenLessonCount,        // released — OpensAtUtc <= now
    int PublishedLessonCount,   // every lesson the teacher has created
    int StudentCount,
    int MarkCount,
    int PassedMarkCount);

public record HealthResponse(string Status, string Db);
