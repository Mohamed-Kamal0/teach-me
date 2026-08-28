namespace TeachersLessons.Api.Features.Auth;

public record RegisterTeacherRequest(string FullName, string Email, string Password);
public record RegisterStudentRequest(string FullName, string Email, string Password);
public record LoginRequest(string Email, string Password);

/// <summary>
/// A password reset for someone who is signed in. The current password is the proof of identity
/// this app has instead of an emailed link — nothing here leaves the server, so the account is
/// reset by the person already holding the session, never by a stranger holding an address.
/// The confirmation field is client-side only and the server never receives it.
/// </summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record LoginResponse(string Role, string? TeacherStatus);

public record MeResponse(Guid UserId, string Email, string FullName, string Role, string? TeacherStatus, DateTimeOffset? TeacherDecidedAtUtc, string? PhotoETag);

public record PhotoUpdatedResponse(string ETag, DateTimeOffset UpdatedAtUtc);
