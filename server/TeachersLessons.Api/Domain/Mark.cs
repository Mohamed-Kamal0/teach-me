namespace TeachersLessons.Api.Domain;

public class Mark
{
    public Guid Id { get; set; }
    public Guid LessonId { get; set; }
    public Lesson Lesson { get; set; } = null!;
    public Guid StudentUserId { get; set; }
    public Student Student { get; set; } = null!;

    public int Score { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }
}
