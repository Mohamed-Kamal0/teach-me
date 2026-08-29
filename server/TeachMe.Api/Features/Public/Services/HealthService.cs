namespace TeachMe.Api.Features.Public.Services;

public interface IHealthService
{
    Task<bool> IsDatabaseReachableAsync(CancellationToken ct);
}

public class HealthService(AppDbContext db) : IHealthService
{
    public Task<bool> IsDatabaseReachableAsync(CancellationToken ct) => db.Database.CanConnectAsync(ct);
}
