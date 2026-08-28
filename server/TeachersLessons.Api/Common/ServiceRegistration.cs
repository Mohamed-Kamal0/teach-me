using TeachersLessons.Api.Features.Admin.Services;
using TeachersLessons.Api.Features.Auth.Services;
using TeachersLessons.Api.Features.Helper.Services;
using TeachersLessons.Api.Features.Public.Services;
using TeachersLessons.Api.Features.Student.Services;
using TeachersLessons.Api.Features.Teacher.Services;

namespace TeachersLessons.Api.Common;

/// <summary>
/// Every feature service in one place. Controllers own routing, model binding and the HTTP
/// response; everything a request actually *does* lives behind one of these interfaces, which
/// is what keeps the controllers small enough to read at a glance.
/// </summary>
public static class ServiceRegistration
{
    public static IServiceCollection AddFeatureServices(this IServiceCollection services)
    {
        // Auth
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IPhotoService, PhotoService>();

        // Teacher
        services.AddScoped<ILessonService, LessonService>();
        services.AddScoped<IMarkService, MarkService>();
        services.AddScoped<ITeacherStudentService, TeacherStudentService>();
        services.AddScoped<IProgressService, ProgressService>();

        // Student
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<IStudentProfileService, StudentProfileService>();
        services.AddScoped<IStudentMarkService, StudentMarkService>();
        services.AddScoped<IWhatsNewService, WhatsNewService>();

        // Admin
        services.AddScoped<ITeacherApprovalService, TeacherApprovalService>();

        // Public
        services.AddScoped<IPublicDirectoryService, PublicDirectoryService>();
        services.AddScoped<IHealthService, HealthService>();

        // Helper — the intents are read from disk once, so the provider is a singleton.
        services.AddSingleton<IHelperIntentProvider, HelperIntentProvider>();
        services.AddScoped<IHelperService, HelperService>();

        return services;
    }
}
