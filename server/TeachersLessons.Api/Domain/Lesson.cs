namespace TeachersLessons.Api.Domain;

public class Lesson
{
    public Guid Id { get; set; }
    public Guid TeacherUserId { get; set; }
    public Teacher Teacher { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string RecordingUrl { get; set; } = string.Empty;
    public string? HandoutUrl { get; set; }
    public string? QuizUrl { get; set; }
    public string? AnswersUrl { get; set; }
    public int DurationMinutes { get; set; }
    public int QuizMaxScore { get; set; }
    public int PassMark { get; set; }
    public DateTimeOffset? OpensAtUtc { get; set; }
    public DateTimeOffset? QuizOpensAtUtc { get; set; }
    public DateTimeOffset? AnswersOpenAtUtc { get; set; }

    public ICollection<Mark> Marks { get; set; } = new List<Mark>();
}
