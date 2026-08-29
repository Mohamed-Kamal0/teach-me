using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachMe.Api.Domain;

namespace TeachMe.Api.Data.Configurations;

public class TeacherConfiguration : IEntityTypeConfiguration<Teacher>
{
    public void Configure(EntityTypeBuilder<Teacher> builder)
    {
        builder.ToTable("Teachers");
        builder.HasKey(t => t.UserId);

        builder.Property(t => t.JoinCode).HasMaxLength(8).IsRequired();
        builder.HasIndex(t => t.JoinCode).IsUnique();

        builder.Property(t => t.Subject).HasMaxLength(60);
        // The same 30 a student's phone gets, so the one validator message covers both.
        builder.Property(t => t.Phone).HasMaxLength(30);

        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.DecidedAtUtc);

        builder.HasOne(t => t.DecidedByUser)
            .WithMany()
            .HasForeignKey(t => t.DecidedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(t => t.Lessons)
            .WithOne(l => l.Teacher)
            .HasForeignKey(l => l.TeacherUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(t => t.Enrollments)
            .WithOne(e => e.Teacher)
            .HasForeignKey(e => e.TeacherUserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
