using Microsoft.EntityFrameworkCore;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Common;

/// <summary>
/// The single place that decides what a student may see of a lesson. Withholding happens by
/// not selecting the column — an unopened quiz is absent from the JSON, never sent-and-hidden.
/// </summary>
public static class LessonQueries
{
    public static IQueryable<StudentLessonDto> VisibleTo(this IQueryable<Lesson> lessons, Guid teacherUserId, DateTimeOffset now) =>
        lessons
            .Where(l => l.TeacherUserId == teacherUserId && l.OpensAtUtc != null && l.OpensAtUtc <= now)
            .Select(l => new StudentLessonDto
            {
                Id = l.Id,
                TeacherUserId = l.TeacherUserId,
                Title = l.Title,
                OrderIndex = l.OrderIndex,
                RecordingUrl = l.RecordingUrl,
                HandoutUrl = l.HandoutUrl,
                QuizUrl = (l.QuizOpensAtUtc != null && l.QuizOpensAtUtc <= now) ? l.QuizUrl : null,
                AnswersUrl = (l.AnswersOpenAtUtc != null && l.AnswersOpenAtUtc <= now) ? l.AnswersUrl : null,
                DurationMinutes = l.DurationMinutes,
                QuizMaxScore = l.QuizMaxScore,
                PassMark = l.PassMark,
                OpensAtUtc = l.OpensAtUtc,
                QuizOpensAtUtc = l.QuizOpensAtUtc,
                AnswersOpenAtUtc = l.AnswersOpenAtUtc
            })
            .OrderBy(l => l.OrderIndex);
}
