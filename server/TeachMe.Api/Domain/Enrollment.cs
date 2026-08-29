namespace TeachMe.Api.Domain;

public class Enrollment
{
    public Guid Id { get; set; }
    public Guid StudentUserId { get; set; }
    public Student Student { get; set; } = null!;
    public Guid TeacherUserId { get; set; }
    public Teacher Teacher { get; set; } = null!;

    public DateTimeOffset JoinedAtUtc { get; set; }
    public DateTimeOffset? LastViewedAtUtc { get; set; }
}
