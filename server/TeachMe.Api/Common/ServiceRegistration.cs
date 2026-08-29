using TeachMe.Api.Features.Admin.Services;
using TeachMe.Api.Features.Auth.Services;
using TeachMe.Api.Features.Helper;
using TeachMe.Api.Features.Helper.Services;
using TeachMe.Api.Features.Public.Services;
using TeachMe.Api.Features.Student.Services;
using TeachMe.Api.Features.Teacher.Services;

namespace TeachMe.Api.Common;

/// <summary>
/// Every feature service in one place. Controllers own routing, model binding and the HTTP
/// response; everything a request actually *does* lives behind one of these interfaces, which
/// is what keeps the controllers small enough to read at a glance.
/// </summary>
public static class ServiceRegistration
{
    public static IServiceCollection AddFeatureServices(this IServiceCollection services, IConfiguration configuration)
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

        // Helper — the intents and the system prompt are read from disk once, so both providers
        // are singletons, as is the per-student rate limiter's window.
        services.AddSingleton<IHelperIntentProvider, HelperIntentProvider>();
        services.AddSingleton<IHelperSystemPrompt, HelperSystemPromptProvider>();
        services.AddSingleton<IHelperRateLimiter, HelperRateLimiter>();
        services.AddScoped<HelperService>();                 // the fallback, always registered
        services.AddScoped<IStudentContextPackBuilder, StudentContextPackBuilder>();

        services.Configure<AiOptions>(configuration.GetSection(AiOptions.SectionName));

        // Which implementation answers is decided once, here. With no key the graph does not even
        // contain the AI path, so `fly secrets unset Ai__ApiKey` is a complete rollback.
        var ai = configuration.GetSection(AiOptions.SectionName).Get<AiOptions>() ?? new AiOptions();
        if (ai.IsUsable)
        {
            services.AddSingleton(_ => new Google.GenAI.Client(apiKey: ai.ApiKey));
            services.AddScoped<IAnswerModel, GeminiAnswerModel>();
            services.AddScoped<IHelperService, AiHelperService>();   // wraps HelperService
        }
        else
        {
            services.AddScoped<IHelperService>(sp => sp.GetRequiredService<HelperService>());
        }

        return services;
    }
}
