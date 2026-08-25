using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// ---- Services -------------------------------------------------------------

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    });

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    // Validation runs explicitly through FluentValidation in each action, not the [ApiController] default.
    options.SuppressModelStateInvalidFilter = true;
});

builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("AppDb")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:AppDb.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IPasswordHasher<TeachersLessons.Api.Domain.User>, PasswordHasher<TeachersLessons.Api.Domain.User>>();

builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddSingleton<TeachersLessons.Api.Features.Helper.IHelperIntentProvider, TeachersLessons.Api.Features.Helper.HelperIntentProvider>();

// Always in every environment that actually terminates TLS; SameAsRequest only so `dotnet run`
// over plain http in local dev doesn't refuse to set the cookie at all.
var cookieSecurePolicy = (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"))
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "tls_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = cookieSecurePolicy;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.Path = "/";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;

        // 401/403 instead of the browser-login redirects AddCookie assumes by default.
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddScoped<IAuthorizationHandler, ApprovedTeacherHandler>();
builder.Services.AddScoped<IAuthorizationHandler, EnrolledInCourseHandler>();

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(PolicyNames.Admin, p => p.RequireRole(nameof(UserRole.Admin)))
    .AddPolicy(PolicyNames.ApprovedTeacher, p => p.RequireRole(nameof(UserRole.Teacher)).AddRequirements(new ApprovedTeacherRequirement()))
    .AddPolicy(PolicyNames.Student, p => p.RequireRole(nameof(UserRole.Student)))
    .AddPolicy(PolicyNames.EnrolledInCourse, p => p.RequireRole(nameof(UserRole.Student)).AddRequirements(new EnrolledInCourseRequirement()));

builder.Services.AddAntiforgery(options =>
{
    // The header Angular's HttpClient echoes the XSRF-TOKEN cookie into.
    options.HeaderName = "X-XSRF-TOKEN";
    // Antiforgery's own cookie carries the *cookie* token and stays httpOnly — it is not the
    // same value as the request token, so it is never the one Angular reads back. See
    // AntiforgeryMiddleware, which publishes the request token as the separate XSRF-TOKEN cookie.
    options.Cookie.Name = "tls_antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = cookieSecurePolicy;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

// Fly.io (and most hosts) terminate TLS at the edge and forward to the container over plain
// HTTP, so without this, Request.Scheme is always "http": UseHttpsRedirection loops every
// request through a redirect, and the auth cookie's CookieSecurePolicy.Always silently refuses
// to set the cookie at all. KnownNetworks/KnownProxies are cleared because the edge proxy's IP
// isn't a fixed, known address.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:4200";
builder.Services.AddCors(options =>
{
    options.AddPolicy("client", policy => policy
        .WithOrigins(allowedOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

// ---- `dotnet run -- seed --demo` ------------------------------------------

if (args.Length > 0 && string.Equals(args[0], "seed", StringComparison.OrdinalIgnoreCase))
{
    if (args.Contains("--demo"))
    {
        if (app.Environment.IsProduction())
        {
            await Console.Error.WriteLineAsync("Refusing to seed demo data when ASPNETCORE_ENVIRONMENT=Production.");
            Environment.Exit(1);
        }

        var adminEmail = builder.Configuration["Seed:AdminEmail"]
            ?? throw new InvalidOperationException("Missing Seed:AdminEmail. Set it with `dotnet user-secrets set`.");
        var adminPassword = builder.Configuration["Seed:AdminPassword"]
            ?? throw new InvalidOperationException("Missing Seed:AdminPassword. Set it with `dotnet user-secrets set`.");

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        await DemoSeeder.RunAsync(db, adminEmail, adminPassword, clock);
        Console.WriteLine("Demo data seeded: one administrator, four teachers, eight lessons, two students.");
    }

    return;
}

// ---- Fail fast on missing secrets, and seed the administrator -------------

if (!app.Environment.IsEnvironment("Testing"))
{
    var adminEmail = builder.Configuration["Seed:AdminEmail"];
    var adminPassword = builder.Configuration["Seed:AdminPassword"];
    if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
    {
        throw new InvalidOperationException(
            "Missing required secrets Seed:AdminEmail / Seed:AdminPassword. " +
            "Run: dotnet user-secrets set \"Seed:AdminEmail\" \"admin@example.test\" --project server/TeachersLessons.Api " +
            "(and the same for Seed:AdminPassword). See README.md.");
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();

    // Free hosting gives no persistent disk, so the SQLite file is empty on every cold start.
    // Seed:Demo=true rebuilds the known demo dataset each boot, which keeps the public demo
    // populated. It is destructive by design (DemoSeeder calls EnsureDeletedAsync) — never set
    // it on a deployment whose data is meant to survive.
    if (builder.Configuration.GetValue<bool>("Seed:Demo"))
    {
        await DemoSeeder.RunAsync(db, adminEmail, adminPassword, clock);
        app.Logger.LogWarning("Seed:Demo is set — the database was dropped and re-seeded with demo data.");
    }
    else
    {
        await db.Database.MigrateAsync();
        await DbSeeder.SeedAdminAsync(db, adminEmail, adminPassword, clock);
    }
}

// ---- Pipeline ---------------------------------------------------------------

app.UseForwardedHeaders();
app.UseSerilogRequestLogging();
app.UseMiddleware<ApiExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("client");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AntiforgeryMiddleware>();

app.MapControllers();

app.Run();

public partial class Program;
