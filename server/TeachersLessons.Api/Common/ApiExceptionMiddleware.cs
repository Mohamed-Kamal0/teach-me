using Microsoft.AspNetCore.Mvc;

namespace TeachersLessons.Api.Common;

public class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationApiException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "One or more fields need attention.", ex.Errors);
        }
        catch (NotFoundApiException)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Not found.", null);
        }
        catch (ConflictApiException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, ex.Message, null);
        }
        catch (BadHttpRequestException ex)
        {
            // Kestrel/TestServer raises this for a malformed request or one that breaches a body-size
            // limit (e.g. [RequestSizeLimit]). Surface its own status — 413 for an oversized upload —
            // rather than letting it fall through to a blanket 500.
            var status = ex.StatusCode is >= 400 and < 500 ? ex.StatusCode : StatusCodes.Status400BadRequest;
            var title = status == StatusCodes.Status413PayloadTooLarge
                ? "That upload is too large."
                : "The request could not be read.";
            await WriteProblem(context, status, title, null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            var detail = (env.IsDevelopment() || env.IsEnvironment("Testing")) ? ex.ToString() : null;
            await WriteProblem(context, StatusCodes.Status500InternalServerError, "Something went wrong.", null, detail);
        }
    }

    private static async Task WriteProblem(HttpContext context, int status, string title, IDictionary<string, string[]>? errors, string? detail = null)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Type = $"https://httpstatuses.io/{status}",
            Title = title,
            Status = status,
            Detail = detail
        };

        if (errors is not null)
        {
            problem.Extensions["errors"] = errors;
        }

        await context.Response.WriteAsJsonAsync(problem);
    }
}
