using System.Text.Json.Serialization;

namespace TeachersLessons.Api.Features.Helper;

/// <summary>
/// The whole of what the model is ever told about a student — assembled only from values that
/// student's own endpoints would already return to them (see StudentContextPackBuilder).
///
/// Three things are deliberately absent, and adding any of them back is a security change, not a
/// tidy-up:
///   * every URL — the model answers *where*, never *here is the link*, so a successful prompt
///     injection has nothing to exfiltrate;
///   * every future moment — booleans only, because a guessed date is worse than no date;
///   * every id but the teacher's, which the deep route needs.
/// </summary>
public record ContextPack(
    DateTimeOffset NowUtc,
    ContextStudent Student,
    List<ContextCourse> Courses,
    ContextMarks Marks);

public record ContextStudent(string Name, int CoursesJoined, int NewSinceLastVisit);

public record ContextCourse(
    Guid TeacherUserId,
    string Teacher,
    DateTimeOffset JoinedAtUtc,
    int LessonsOpenToMe,
    List<ContextLesson> Lessons);

/// <summary>
/// One lesson the student can already see. A lesson their teacher has not opened is not here at
/// all — it is absent from LessonQueries.VisibleTo, so the model cannot leak a title it was never
/// shown. An unopened quiz or answer sheet arrives as <c>false</c>, never as a date.
/// </summary>
public record ContextLesson(
    string Title,
    int Order,
    bool HasRecording,
    bool HasHandout,
    bool QuizOpen,
    bool AnswersOpen,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? MyScore,
    int OutOf,
    int PassMark,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Passed);

public record ContextMarks(
    int Graded,
    int Passed,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTimeOffset? LastRecordedAtUtc);
