namespace TeachersLessons.Api.Domain;

public class Teacher
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string JoinCode { get; set; } = string.Empty;
    public TeacherStatus Status { get; set; } = TeacherStatus.Pending;
    public DateTimeOffset? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public User? DecidedByUser { get; set; }

    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
}
