using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data.Configurations;

public class AvatarConfiguration : IEntityTypeConfiguration<Avatar>
{
    public void Configure(EntityTypeBuilder<Avatar> builder)
    {
        builder.ToTable("Avatars", t =>
            t.HasCheckConstraint("CK_Avatars_ByteSize", "\"ByteSize\" <= 200000"));
        builder.HasKey(a => a.UserId);

        builder.Property(a => a.Bytes).IsRequired();
        builder.Property(a => a.ContentType).HasMaxLength(40).IsRequired();
        builder.Property(a => a.ByteSize).IsRequired();
        builder.Property(a => a.ETag).HasMaxLength(40).IsRequired();
        builder.Property(a => a.UpdatedAtUtc).IsRequired();

        builder.HasOne(a => a.User)
            .WithOne()
            .HasForeignKey<Avatar>(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
