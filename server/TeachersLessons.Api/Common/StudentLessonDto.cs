namespace TeachersLessons.Api.Common;

/// <summary>
/// The shape a student is ever shown. QuizUrl/AnswersUrl are omitted from the JSON entirely
/// (not null-and-hidden) whenever their moment has not passed — see LessonQueries.VisibleTo.
/// </summary>
public class StudentLessonDto
{
    public Guid Id { get; set; }
    public Guid TeacherUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string RecordingUrl { get; set; } = string.Empty;
    public string? HandoutUrl { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? QuizUrl { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? AnswersUrl { get; set; }

    public int DurationMinutes { get; set; }
    public int QuizMaxScore { get; set; }
    public int PassMark { get; set; }
    public DateTimeOffset? OpensAtUtc { get; set; }
    public DateTimeOffset? QuizOpensAtUtc { get; set; }
    public DateTimeOffset? AnswersOpenAtUtc { get; set; }
}
