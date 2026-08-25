using Microsoft.EntityFrameworkCore;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Mark> Marks => Set<Mark>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToUtcDateTimeConverter>();
        configurationBuilder.Properties<DateTimeOffset?>().HaveConversion<NullableDateTimeOffsetToUtcDateTimeConverter>();
    }
}
