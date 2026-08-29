namespace TeachMe.Api.Features.Teacher;

public record LessonRequest(
    string Title,
    int OrderIndex,
    string RecordingUrl,
    string? HandoutUrl,
    string? QuizUrl,
    string? AnswersUrl,
    int DurationMinutes,
    int QuizMaxScore,
    int PassMark,
    DateTimeOffset? OpensAtUtc,
    DateTimeOffset? QuizOpensAtUtc,
    DateTimeOffset? AnswersOpenAtUtc);

public record LessonDto(
    Guid Id,
    string Title,
    int OrderIndex,
    string RecordingUrl,
    string? HandoutUrl,
    string? QuizUrl,
    string? AnswersUrl,
    int DurationMinutes,
    int QuizMaxScore,
    int PassMark,
    DateTimeOffset? OpensAtUtc,
    DateTimeOffset? QuizOpensAtUtc,
    DateTimeOffset? AnswersOpenAtUtc,
    bool LessonOpen,
    bool QuizOpen,
    bool AnswersOpen);

public record ReorderRequest(List<Guid> LessonIds);
