using FluentValidation;

namespace TeachMe.Api.Features.Teacher.Services;

public interface ILessonService
{
    Task<PagedResult<LessonDto>> ListAsync(int? page, int? pageSize, CancellationToken ct);
    Task<LessonDto> GetAsync(Guid id, CancellationToken ct);
    Task<LessonDto> CreateAsync(LessonRequest request, CancellationToken ct);
    Task<LessonDto> UpdateAsync(Guid id, LessonRequest request, CancellationToken ct);
    Task ReorderAsync(ReorderRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public class LessonService(
    AppDbContext db,
    IValidator<LessonRequest> validator,
    ICurrentUser currentUser,
    TimeProvider clock) : ILessonService
{
    public async Task<PagedResult<LessonDto>> ListAsync(int? page, int? pageSize, CancellationToken ct)
    {
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);
        var teacherId = currentUser.UserId;

        var query = db.Lessons.Where(l => l.TeacherUserId == teacherId).OrderBy(l => l.OrderIndex);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((p - 1) * ps).Take(ps).ToListAsync(ct);

        return new PagedResult<LessonDto>
        {
            Items = items.Select(l => ToDto(l, clock.GetUtcNow())).ToList(),
            Page = p,
            PageSize = ps,
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

    public async Task ReorderAsync(ReorderRequest request, CancellationToken ct)
    {
        var teacherId = currentUser.UserId;
        var current = await db.Lessons.Where(l => l.TeacherUserId == teacherId).ToListAsync(ct);
        var currentIds = current.Select(l => l.Id).ToHashSet();
        var requestedIds = request.LessonIds;

        if (requestedIds.Count != requestedIds.Distinct().Count()
            || requestedIds.Count != currentIds.Count
            || !requestedIds.All(currentIds.Contains))
        {
            throw new ValidationApiException("lessonIds", "That list doesn't match your lessons — reload and try again.");
        }

        var byId = current.ToDictionary(l => l.Id);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Phase 1: move everything into a scratch range that cannot collide with any positive value.
        for (var i = 0; i < requestedIds.Count; i++)
        {
            byId[requestedIds[i]].OrderIndex = -(i + 1);
        }
        await db.SaveChangesAsync(ct);

        // Phase 2: flip the whole block positive, in the requested order.
        for (var i = 0; i < requestedIds.Count; i++)
        {
            byId[requestedIds[i]].OrderIndex = i + 1;
        }
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
