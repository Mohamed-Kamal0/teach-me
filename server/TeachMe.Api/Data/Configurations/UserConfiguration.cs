using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachMe.Api.Domain;

namespace TeachMe.Api.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash).HasMaxLength(256).IsRequired();
        builder.Property(u => u.FullName).HasMaxLength(120).IsRequired();

        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(u => u.CreatedAtUtc).IsRequired();

        builder.HasOne(u => u.Teacher)
            .WithOne(t => t.User)
            .HasForeignKey<Teacher>(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(u => u.Student)
            .WithOne(s => s.User)
            .HasForeignKey<Student>(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
