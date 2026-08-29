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

/// <summary>
/// One step, not a whole ordering. The arrows in the lessons table only ever swap a lesson with
/// the one beside it, and asking for the entire list of ids back was a contract the screen could
/// no longer honour once it stopped holding the entire list — a teacher part-way down a scrolling
/// course knows the ten lessons in front of them, not all sixty.
/// </summary>
public record MoveLessonRequest(bool Up);
