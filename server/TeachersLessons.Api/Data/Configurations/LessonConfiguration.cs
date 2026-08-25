using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data.Configurations;

public class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> builder)
    {
        builder.ToTable("Lessons");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Title).HasMaxLength(200).IsRequired();
        builder.Property(l => l.RecordingUrl).HasMaxLength(2048).IsRequired();
        builder.Property(l => l.HandoutUrl).HasMaxLength(2048);
        builder.Property(l => l.QuizUrl).HasMaxLength(2048);
        builder.Property(l => l.AnswersUrl).HasMaxLength(2048);

        builder.HasIndex(l => new { l.TeacherUserId, l.OrderIndex }).IsUnique();

        builder.HasMany(l => l.Marks)
            .WithOne(m => m.Lesson)
            .HasForeignKey(m => m.LessonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
