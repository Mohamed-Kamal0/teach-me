namespace TeachersLessons.Api.Domain;

public class Student
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string? DisplayName { get; set; }
    public string? Phone { get; set; }
    public string? Bio { get; set; }

    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<Mark> Marks { get; set; } = new List<Mark>();
}
