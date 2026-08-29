namespace TeachMe.Api.Domain;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }

    public Teacher? Teacher { get; set; }
    public Student? Student { get; set; }
}
