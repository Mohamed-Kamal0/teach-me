using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data.Configurations;

public class MarkConfiguration : IEntityTypeConfiguration<Mark>
{
    public void Configure(EntityTypeBuilder<Mark> builder)
    {
        builder.ToTable("Marks");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.RecordedAtUtc).IsRequired();

        builder.HasIndex(m => new { m.LessonId, m.StudentUserId }).IsUnique();
    }
}
