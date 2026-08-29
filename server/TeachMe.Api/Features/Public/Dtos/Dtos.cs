namespace TeachMe.Api.Features.Public;

public record HomeResponse(int ApprovedTeacherCount, int LessonCount, string HowToJoin);

/// <summary>
/// What an approved teacher advertises about their own course. Deliberately not
/// <c>TeacherSummaryDto</c>: that one carries an email, and the admin screen may grow more
/// fields later — a separate record is what stops one of them landing on an anonymous page.
/// Every number here is an aggregate over the teacher's own course; none can be traced to
/// one student.
///
/// The phone number is the one field here that is not an aggregate. It is on the card on purpose:
/// somebody deciding whether to take a course needs a way to ask about it before they have an
/// account to ask from, and the teacher gave the number for exactly that. It is contact detail a
/// teacher publishes about themselves, never anything about a student.
/// </summary>
public record PublicTeacherDto(
    Guid UserId,
    string FullName,
    string? Subject,           // what they teach, in their own words; null for a row that predates the field
    string? Phone,             // how to reach them about the course; null for a row that predates the field
    string? PhotoETag,
    DateTimeOffset MemberSinceUtc,
    int OpenLessonCount,        // released — OpensAtUtc <= now
    int PublishedLessonCount,   // every lesson the teacher has created
    int StudentCount,
    int MarkCount,
    int PassedMarkCount);

public record HealthResponse(string Status, string Db);
