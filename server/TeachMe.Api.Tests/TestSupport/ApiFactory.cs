using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeachMe.Api.Data;
using Xunit;

namespace TeachMe.Api.Tests.TestSupport;

/// <summary>
/// One Microsoft.Data.Sqlite shared-cache in-memory database per test class, with a dedicated
/// connection held open for the class's lifetime — the database vanishes when the last
/// connection to it closes, and this is that last connection. Never EF Core's InMemory provider:
/// it ignores unique indexes entirely, which is exactly what suites B and D need enforced.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@test.local";
    public const string AdminPassword = "AdminPass1";

    public ManualTimeProvider Clock { get; } = new();

    private readonly string _connectionString = $"Data Source=file:{Guid.NewGuid()}?mode=memory&cache=shared";
    private SqliteConnection? _keepAlive;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:AppDb"] = _connectionString
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connectionString));

            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    async Task IAsyncLifetime.InitializeAsync()
    {
        _keepAlive = new SqliteConnection(_connectionString);
        await _keepAlive.OpenAsync();

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        await DbSeeder.SeedAdminAsync(db, AdminEmail, AdminPassword, Clock);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        if (_keepAlive is not null)
        {
            await _keepAlive.DisposeAsync();
        }
        await base.DisposeAsync();
    }
}
