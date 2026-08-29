using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TeachMe.Api.Data;
using TeachMe.Api.Domain;

namespace TeachMe.Api.Common;

public static class PolicyNames
{
    public const string Admin = "Admin";
    public const string ApprovedTeacher = "ApprovedTeacher";
    public const string Student = "Student";
    public const string EnrolledInCourse = "EnrolledInCourse";
}

public class ApprovedTeacherRequirement : IAuthorizationRequirement;

public class ApprovedTeacherHandler(AppDbContext db) : AuthorizationHandler<ApprovedTeacherRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ApprovedTeacherRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var role = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role != nameof(UserRole.Teacher))
        {
            return;
        }

        var userIdValue = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdValue is null || !Guid.TryParse(userIdValue, out var userId))
        {
            return;
        }

        // Read fresh from the database every call — approval must take effect on the next request, not the next sign-in.
        var status = await db.Teachers
            .Where(t => t.UserId == userId)
            .Select(t => t.Status)
            .FirstOrDefaultAsync();

        if (status == TeacherStatus.Approved)
        {
            context.Succeed(requirement);
        }
    }
}

public class EnrolledInCourseRequirement : IAuthorizationRequirement;

public class EnrolledInCourseHandler(AppDbContext db, IHttpContextAccessor accessor)
    : AuthorizationHandler<EnrolledInCourseRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, EnrolledInCourseRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var httpContext = accessor.HttpContext;
        var teacherIdValue = httpContext?.Request.RouteValues["teacherId"] as string;
        if (teacherIdValue is null || !Guid.TryParse(teacherIdValue, out var teacherId))
        {
            return;
        }

        var userIdValue = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdValue is null || !Guid.TryParse(userIdValue, out var studentUserId))
        {
            return;
        }

        var enrolled = await db.Enrollments.AnyAsync(e =>
            e.StudentUserId == studentUserId && e.TeacherUserId == teacherId);

        if (enrolled)
        {
            context.Succeed(requirement);
        }
    }
}
