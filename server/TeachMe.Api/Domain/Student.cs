namespace TeachMe.Api.Domain;

public class Student
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string? DisplayName { get; set; }
    public string? Phone { get; set; }
    public string? Bio { get; set; }

    /// <summary>
    /// A calendar date, not an instant: a birthday does not move when the reader does, so it is
    /// stored as <see cref="DateOnly"/> and never passed through the UTC converters that every
    /// <c>DateTimeOffset</c> in this model goes through.
    /// </summary>
    public DateOnly? DateOfBirth { get; set; }

    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<Mark> Marks { get; set; } = new List<Mark>();
}
