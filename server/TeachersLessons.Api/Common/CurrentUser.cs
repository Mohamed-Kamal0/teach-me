using System.Security.Claims;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Common;

public interface ICurrentUser
{
    Guid UserId { get; }
    string Email { get; }
    UserRole Role { get; }
    bool IsAuthenticated { get; }
}

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal => accessor.HttpContext?.User
        ?? throw new InvalidOperationException("No HTTP context available.");

    public bool IsAuthenticated => Principal.Identity?.IsAuthenticated == true;

    public Guid UserId
    {
        get
        {
            var value = Principal.FindFirstValue(ClaimTypes.NameIdentifier);
            return value is null ? Guid.Empty : Guid.Parse(value);
        }
    }

    public string Email => Principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    public UserRole Role
    {
        get
        {
            var value = Principal.FindFirstValue(ClaimTypes.Role);
            return value is null ? default : Enum.Parse<UserRole>(value);
        }
    }
}
