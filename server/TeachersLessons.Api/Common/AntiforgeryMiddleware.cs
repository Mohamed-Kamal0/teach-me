using Microsoft.AspNetCore.Antiforgery;

namespace TeachersLessons.Api.Common;

/// <summary>
/// Double-submit CSRF protection: issues the XSRF-TOKEN cookie on every request, and validates
/// it against X-XSRF-TOKEN on every non-GET request except the handful that must work without one.
/// </summary>
public class AntiforgeryMiddleware(RequestDelegate next, ILogger<AntiforgeryMiddleware> logger)
{
    private static readonly string[] ExemptPathPrefixes =
    [
        "/api/auth/login",
        "/api/auth/register",
        "/api/public",
        "/api/health"
    ];

    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);

        // Angular's withXsrfConfiguration reads this cookie and echoes it back as X-XSRF-TOKEN —
        // it must carry the *request* token, not antiforgery's own (different) cookie token.
        context.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        });

        var isSafeMethod = HttpMethods.IsGet(context.Request.Method)
            || HttpMethods.IsHead(context.Request.Method)
            || HttpMethods.IsOptions(context.Request.Method);

        var path = context.Request.Path.Value ?? string.Empty;
        var isExempt = ExemptPathPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        if (!isSafeMethod && !isExempt)
        {
            try
            {
                await antiforgery.ValidateRequestAsync(context);
            }
            catch (AntiforgeryValidationException ex)
            {
                logger.LogWarning(ex, "Antiforgery validation failed");
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Type = "https://httpstatuses.io/400",
                    Title = "Missing or invalid CSRF token.",
                    Status = StatusCodes.Status400BadRequest
                });
                return;
            }
        }

        await next(context);
    }
}
