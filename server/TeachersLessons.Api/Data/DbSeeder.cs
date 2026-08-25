using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data;

/// <summary>Seeds the one thing every environment needs: the administrator row.</summary>
public static class DbSeeder
{
    public static async Task SeedAdminAsync(AppDbContext db, string adminEmail, string adminPassword, TimeProvider clock)
    {
        var email = adminEmail.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
        {
            return;
        }

        var admin = new User
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            FullName = "Administrator",
            Role = UserRole.Admin,
            CreatedAtUtc = clock.GetUtcNow()
        };
        admin.PasswordHash = new PasswordHasher<User>().HashPassword(admin, adminPassword);

        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }
}
