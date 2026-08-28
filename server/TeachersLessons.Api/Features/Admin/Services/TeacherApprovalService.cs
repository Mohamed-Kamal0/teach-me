namespace TeachersLessons.Api.Features.Admin.Services;

public interface ITeacherApprovalService
{
    Task<PagedResult<TeacherSummaryDto>> ListAsync(string? status, int? page, int? pageSize, CancellationToken ct);
    Task ApproveAsync(Guid teacherUserId, CancellationToken ct);
    Task RejectAsync(Guid teacherUserId, CancellationToken ct);
}

public class TeacherApprovalService(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ITeacherApprovalService
{
    public async Task<PagedResult<TeacherSummaryDto>> ListAsync(string? status, int? page, int? pageSize, CancellationToken ct)
    {
        var (p, ps) = PagingExtensions.Normalize(page, pageSize);

        var query = db.Teachers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TeacherStatus>(status, true, out var parsed))
        {
            query = query.Where(t => t.Status == parsed);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(t => t.User.FullName)
            .Skip((p - 1) * ps)
            .Take(ps)
            .Select(t => new TeacherSummaryDto(
                // The subject is here so the decision is not made on a name alone: what somebody
                // says they teach is most of what an administrator has to go on.
                t.UserId, t.User.FullName, t.Subject, t.User.Email, t.Status.ToString(), t.User.CreatedAtUtc, t.DecidedAtUtc,
                db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        return new PagedResult<TeacherSummaryDto> { Items = items, Page = p, PageSize = ps, Total = total };
    }

    public Task ApproveAsync(Guid teacherUserId, CancellationToken ct) =>
        Decide(teacherUserId, TeacherStatus.Approved, ct);

    public Task RejectAsync(Guid teacherUserId, CancellationToken ct) =>
        Decide(teacherUserId, TeacherStatus.Rejected, ct);

    private async Task Decide(Guid teacherUserId, TeacherStatus decision, CancellationToken ct)
    {
        var teacher = await db.Teachers.FirstOrDefaultAsync(t => t.UserId == teacherUserId, ct);
        if (teacher is null)
        {
            throw new NotFoundApiException();
        }

        if (teacher.Status != TeacherStatus.Pending)
        {
            var decidedOn = teacher.DecidedAtUtc?.ToString("d MMM yyyy") ?? "an earlier date";
            throw new ConflictApiException($"This teacher was already {teacher.Status.ToString().ToLowerInvariant()} on {decidedOn}.");
        }

        teacher.Status = decision;
        teacher.DecidedAtUtc = clock.GetUtcNow();
        teacher.DecidedByUserId = currentUser.UserId;
        await db.SaveChangesAsync(ct);
    }
}
