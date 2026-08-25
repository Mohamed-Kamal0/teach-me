using Microsoft.AspNetCore.Antiforgery;
using Microsoft.Extensions.Options;

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

    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery, IOptions<AntiforgeryOptions> options)
    {
        // GetAndStoreTokens throws outright when the cookie policy is Secure=Always and the
        // request arrived over plain HTTP — it will not quietly degrade. Behind a host that
        // terminates TLS at the edge, browser traffic always looks like https here because
        // UseForwardedHeaders reads X-Forwarded-Proto; the requests that reach this line over
        // plain http are the platform's own health probes, which need no CSRF token. Issuing
        // nothing for those is correct, and stops a probe from 500ing and failing the deploy.
        // Unsafe requests are unaffected: with no token issued they fail validation below and
        // get the usual 400.
        var secureCookieRequired = options.Value.Cookie.SecurePolicy == CookieSecurePolicy.Always;
        if (context.Request.IsHttps || !secureCookieRequired)
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
        }

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
