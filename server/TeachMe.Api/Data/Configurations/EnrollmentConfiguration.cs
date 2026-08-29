using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachMe.Api.Domain;

namespace TeachMe.Api.Data.Configurations;

public class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> builder)
    {
        builder.ToTable("Enrollments");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.JoinedAtUtc).IsRequired();

        builder.HasIndex(e => new { e.StudentUserId, e.TeacherUserId }).IsUnique();
    }
}
