namespace TeachMe.Api.Features.Auth;

public record RegisterTeacherRequest(string FullName, string Email, string Password, string Subject, string Phone);
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
/// A teacher restating the two things they told us about themselves at registration — what they
/// teach, and how to reach them. It is a `PUT` under `/api/me` rather than anything under
/// `/api/teacher/*` for two reasons: the account being changed is the one holding the cookie, so
/// there is no id in the body to tamper with; and everything under `/api/teacher/*` is fenced
/// behind the approved policy, while a teacher who is still waiting must be able to correct a
/// typo in the very fields an administrator reads before deciding on them.
///
/// Both fields travel together because they are edited together on one card behind one Save.
/// Sending only one of them would leave the other looking cleared rather than untouched.
/// </summary>
public record UpdateTeacherProfileRequest(string Subject, string Phone);

public record LoginResponse(string Role, string? TeacherStatus);

/// <summary>
/// Who is signed in. <c>DisplayName</c> is the name a student chose for themselves on their
/// profile — null for everyone else, and null for a student who has not chosen one. It rides on
/// identity rather than sitting only on /api/student/profile because the app bar, the drawer and
/// the account menu all name the signed-in person, and reading that name from anywhere but the
/// session is how the bar ends up still showing the old one after a save.
/// </summary>
public record MeResponse(Guid UserId, string Email, string FullName, string Role, string? TeacherStatus, DateTimeOffset? TeacherDecidedAtUtc, string? PhotoETag, string? Subject, string? Phone, string? DisplayName);

public record PhotoUpdatedResponse(string ETag, DateTimeOffset UpdatedAtUtc);
