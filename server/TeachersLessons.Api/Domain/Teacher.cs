namespace TeachersLessons.Api.Domain;

public class Teacher
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string JoinCode { get; set; } = string.Empty;

    /// <summary>
    /// What this teacher teaches, in their own words — "Mathematics", "Biology", "English
    /// Literature". Nullable, and that null is a real state rather than a placeholder: every
    /// teacher who registers is asked for it, but the rows that existed before the field did
    /// have never been asked, and an empty string would claim they answered.
    /// </summary>
    public string? Subject { get; set; }
    public TeacherStatus Status { get; set; } = TeacherStatus.Pending;
    public DateTimeOffset? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public User? DecidedByUser { get; set; }

    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
}
