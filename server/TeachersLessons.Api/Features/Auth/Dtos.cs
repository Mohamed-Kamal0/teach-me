namespace TeachersLessons.Api.Features.Auth;

public record RegisterTeacherRequest(string FullName, string Email, string Password);
public record RegisterStudentRequest(string FullName, string Email, string Password);
public record LoginRequest(string Email, string Password);

public record LoginResponse(string Role, string? TeacherStatus);

public record MeResponse(Guid UserId, string Email, string FullName, string Role, string? TeacherStatus, DateTimeOffset? TeacherDecidedAtUtc, string? PhotoETag);

public record PhotoUpdatedResponse(string ETag, DateTimeOffset UpdatedAtUtc);
