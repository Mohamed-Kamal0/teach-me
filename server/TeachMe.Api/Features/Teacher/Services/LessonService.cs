using FluentValidation;

namespace TeachMe.Api.Features.Teacher.Services;

public interface ILessonService
{
    Task<CursorPage<LessonDto>> ListAsync(string? cursor, int? limit, CancellationToken ct);
    Task<LessonDto> GetAsync(Guid id, CancellationToken ct);
    Task<LessonDto> CreateAsync(LessonRequest request, CancellationToken ct);
    Task<LessonDto> UpdateAsync(Guid id, LessonRequest request, CancellationToken ct);
    Task MoveAsync(Guid id, bool up, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public class LessonService(
    AppDbContext db,
    IValidator<LessonRequest> validator,
    ICurrentUser currentUser,
    TimeProvider clock) : ILessonService
{
    /// <summary>
    /// A course in teaching order, a slice at a time. OrderIndex is unique per teacher — the
    /// database enforces it, and MoveAsync swaps through a parked value precisely to keep it
    /// so — which is what lets a single number serve as the whole cursor.
    /// </summary>
    public async Task<CursorPage<LessonDto>> ListAsync(string? cursor, int? limit, CancellationToken ct)
    {
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, fields: 1);
        var teacherId = currentUser.UserId;

        var lessons = db.Lessons.Where(l => l.TeacherUserId == teacherId);

        int? total = key is null ? await lessons.CountAsync(ct) : null;

        if (key is { } k)
        {
            var afterOrder = k.Int(0);
            lessons = lessons.Where(l => l.OrderIndex > afterOrder);
        }

        // One row past the slice answers "is there more" without a second round trip.
        var rows = await lessons.OrderBy(l => l.OrderIndex).Take(take + 1).ToListAsync(ct);
        var hasMore = rows.Count > take;
        var items = hasMore ? rows[..take] : rows;

        var now = clock.GetUtcNow();
        return new CursorPage<LessonDto>
        {
            Items = items.Select(l => ToDto(l, now)).ToList(),
            NextCursor = hasMore && items.Count > 0 ? Cursor.Encode(items[^1].OrderIndex.ToString()) : null,
            Total = total
        };
    }

    public async Task<LessonDto> GetAsync(Guid id, CancellationToken ct) =>
        ToDto(await FindOwnLesson(id, ct), clock.GetUtcNow());

    public async Task<LessonDto> CreateAsync(LessonRequest request, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(request, ct);

        var teacherId = currentUser.UserId;
        await EnsurePositionFree(teacherId, request.OrderIndex, excludeLessonId: null, ct);

        var lesson = new Lesson
        {
            Id = Guid.CreateVersion7(),
            TeacherUserId = teacherId,
            Title = request.Title.Trim(),
            OrderIndex = request.OrderIndex,
            RecordingUrl = request.RecordingUrl.Trim(),
            HandoutUrl = Optional(request.HandoutUrl),
            QuizUrl = Optional(request.QuizUrl),
            AnswersUrl = Optional(request.AnswersUrl),
            DurationMinutes = request.DurationMinutes,
            QuizMaxScore = request.QuizMaxScore,
            PassMark = request.PassMark,
            OpensAtUtc = request.OpensAtUtc,
            QuizOpensAtUtc = request.QuizOpensAtUtc,
            AnswersOpenAtUtc = request.AnswersOpenAtUtc
        };

        db.Lessons.Add(lesson);
        await SaveOrThrowOnPositionConflict(ct);

        return ToDto(lesson, clock.GetUtcNow());
    }

    public async Task<LessonDto> UpdateAsync(Guid id, LessonRequest request, CancellationToken ct)
    {
        await validator.ValidateOrThrowAsync(request, ct);

        var lesson = await FindOwnLesson(id, ct);
        await EnsurePositionFree(lesson.TeacherUserId, request.OrderIndex, excludeLessonId: id, ct);

        lesson.Title = request.Title.Trim();
        lesson.OrderIndex = request.OrderIndex;
        lesson.RecordingUrl = request.RecordingUrl.Trim();
        lesson.HandoutUrl = Optional(request.HandoutUrl);
        lesson.QuizUrl = Optional(request.QuizUrl);
        lesson.AnswersUrl = Optional(request.AnswersUrl);
        lesson.DurationMinutes = request.DurationMinutes;
        lesson.QuizMaxScore = request.QuizMaxScore;
        lesson.PassMark = request.PassMark;
        lesson.OpensAtUtc = request.OpensAtUtc;
        lesson.QuizOpensAtUtc = request.QuizOpensAtUtc;
        lesson.AnswersOpenAtUtc = request.AnswersOpenAtUtc;

        await SaveOrThrowOnPositionConflict(ct);

        return ToDto(lesson, clock.GetUtcNow());
    }

    /// <summary>
    /// Swap a lesson with its neighbour. A lesson already at the end has no neighbour to swap
    /// with, and that is not an error — it is the arrow the teacher could see was disabled being
    /// pressed anyway, by a keyboard or by a second tab that had moved on.
    ///
    /// OrderIndex is unique per teacher, so the two rows cannot hold the same number even for the
    /// instant between two writes. One of them parks on the negative of its own position — a
    /// range nothing else uses — and the swap completes from there, inside a transaction so no
    /// reader ever sees the parked value.
    /// </summary>
    public async Task MoveAsync(Guid id, bool up, CancellationToken ct)
    {
        var lesson = await FindOwnLesson(id, ct);

        var siblings = db.Lessons.Where(l => l.TeacherUserId == lesson.TeacherUserId);
        var neighbour = up
            ? await siblings.Where(l => l.OrderIndex < lesson.OrderIndex)
                .OrderByDescending(l => l.OrderIndex).FirstOrDefaultAsync(ct)
            : await siblings.Where(l => l.OrderIndex > lesson.OrderIndex)
                .OrderBy(l => l.OrderIndex).FirstOrDefaultAsync(ct);

        if (neighbour is null)
        {
            return;
        }

        var mine = lesson.OrderIndex;
        var theirs = neighbour.OrderIndex;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        lesson.OrderIndex = -mine;
        await db.SaveChangesAsync(ct);

        neighbour.OrderIndex = mine;
        await db.SaveChangesAsync(ct);

        lesson.OrderIndex = theirs;
        await db.SaveChangesAsync(ct);

        await transaction.CommitAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var lesson = await FindOwnLesson(id, ct);

        var hasMarks = await db.Marks.AnyAsync(m => m.LessonId == id, ct);
        if (hasMarks)
        {
            throw new ConflictApiException("This lesson has marks recorded, so it can't be deleted.");
        }

        db.Lessons.Remove(lesson);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Lesson> FindOwnLesson(Guid id, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == id && l.TeacherUserId == teacherId, ct);
        if (lesson is null)
        {
            throw new NotFoundApiException();
        }
        return lesson;
    }

    private async Task EnsurePositionFree(Guid teacherId, int orderIndex, Guid? excludeLessonId, CancellationToken ct)
    {
        var taken = await db.Lessons.AnyAsync(l =>
            l.TeacherUserId == teacherId && l.OrderIndex == orderIndex && l.Id != (excludeLessonId ?? Guid.Empty), ct);

        if (taken)
        {
            throw new ValidationApiException("orderIndex", $"Lesson {orderIndex} already sits in that position — pick another.");
        }
    }

    private async Task SaveOrThrowOnPositionConflict(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ValidationApiException("orderIndex", "That position was just taken — pick another.");
        }
    }

    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static LessonDto ToDto(Lesson l, DateTimeOffset now) => new(
        l.Id, l.Title, l.OrderIndex, l.RecordingUrl, l.HandoutUrl, l.QuizUrl, l.AnswersUrl,
        l.DurationMinutes, l.QuizMaxScore, l.PassMark, l.OpensAtUtc, l.QuizOpensAtUtc, l.AnswersOpenAtUtc,
        LessonOpen: l.OpensAtUtc is not null && l.OpensAtUtc <= now,
        QuizOpen: l.QuizOpensAtUtc is not null && l.QuizOpensAtUtc <= now,
        AnswersOpen: l.AnswersOpenAtUtc is not null && l.AnswersOpenAtUtc <= now);
}
