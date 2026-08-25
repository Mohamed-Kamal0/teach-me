using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.ToTable("Students");
        builder.HasKey(s => s.UserId);

        builder.Property(s => s.DisplayName).HasMaxLength(120);
        builder.Property(s => s.Phone).HasMaxLength(30);
        builder.Property(s => s.Bio).HasMaxLength(500);

        builder.HasMany(s => s.Enrollments)
            .WithOne(e => e.Student)
            .HasForeignKey(e => e.StudentUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.Marks)
            .WithOne(m => m.Student)
            .HasForeignKey(m => m.StudentUserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
