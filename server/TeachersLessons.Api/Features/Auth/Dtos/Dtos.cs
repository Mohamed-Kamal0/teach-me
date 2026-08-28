namespace TeachersLessons.Api.Features.Auth;

public record RegisterTeacherRequest(string FullName, string Email, string Password, string Subject);
public record RegisterStudentRequest(string FullName, string Email, string Password);
public record LoginRequest(string Email, string Password);

/// <summary>
/// A password reset for someone who is signed in. The current password is the proof of identity
/// this app has instead of an emailed link — nothing here leaves the server, so the account is
/// reset by the person already holding the session, never by a stranger holding an address.
/// The confirmation field is client-side only and the server never receives it.
/// </summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>
/// A teacher restating what they teach. It is a `PUT` under `/api/me` rather than anything under
/// `/api/teacher/*` for two reasons: the account being changed is the one holding the cookie, so
/// there is no id in the body to tamper with; and everything under `/api/teacher/*` is fenced
/// behind the approved policy, while a teacher who is still waiting must be able to correct a
/// typo in the one field an administrator reads before deciding on them.
/// </summary>
public record UpdateSubjectRequest(string Subject);

public record LoginResponse(string Role, string? TeacherStatus);

public record MeResponse(Guid UserId, string Email, string FullName, string Role, string? TeacherStatus, DateTimeOffset? TeacherDecidedAtUtc, string? PhotoETag, string? Subject);

public record PhotoUpdatedResponse(string ETag, DateTimeOffset UpdatedAtUtc);
