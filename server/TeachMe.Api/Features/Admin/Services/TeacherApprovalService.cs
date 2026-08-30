namespace TeachMe.Api.Features.Admin.Services;

public interface ITeacherApprovalService
{
    Task<CursorPage<TeacherSummaryDto>> ListAsync(string? status, string? cursor, int? limit, string? q, CancellationToken ct);
    Task ApproveAsync(Guid teacherUserId, CancellationToken ct);
    Task RejectAsync(Guid teacherUserId, CancellationToken ct);
}

public class TeacherApprovalService(AppDbContext db, ICurrentUser currentUser, TimeProvider clock) : ITeacherApprovalService
{
    /// <summary>
    /// The queue an administrator works through, alphabetical, a slice at a time. Deciding on a
    /// teacher takes them out of the Pending list, which is exactly why this is keyset and not
    /// offset: approving the tenth row must not push the eleventh past a boundary unseen.
    ///
    /// <paramref name="q"/> searches the three fields the table shows and a decision is made on:
    /// the name, the subject, and the email address. It applies within the standing being
    /// looked at rather than across all three, because the tabs are the queue and searching is
    /// how a long queue is worked, not a way out of it.
    /// </summary>
    public async Task<CursorPage<TeacherSummaryDto>> ListAsync(string? status, string? cursor, int? limit, string? q, CancellationToken ct)
    {
        var take = Cursor.NormalizeLimit(limit);
        var key = Cursor.Read(cursor, fields: 2);

        var query = db.Teachers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TeacherStatus>(status, true, out var parsed))
        {
            query = query.Where(t => t.Status == parsed);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(t =>
                EF.Functions.Like(t.User.FullName, $"%{term}%") ||
                EF.Functions.Like(t.User.Email, $"%{term}%") ||
                (t.Subject != null && EF.Functions.Like(t.Subject, $"%{term}%")));
        }

        int? total = key is null ? await query.CountAsync(ct) : null;

        if (key is { } k)
        {
            var afterName = k.Text(0);
            var afterId = k.Uuid(1);

            query = query.Where(t =>
                string.Compare(t.User.FullName, afterName) > 0
                || (t.User.FullName == afterName && t.UserId.CompareTo(afterId) > 0));
        }

        var rows = await query
            .OrderBy(t => t.User.FullName)
            .ThenBy(t => t.UserId)
            .Take(take + 1)
            .Select(t => new TeacherSummaryDto(
                // The subject and the phone are here so the decision is not made on a name
                // alone: what somebody says they teach, and a way to reach them and ask, is most
                // of what an administrator has to go on.
                t.UserId, t.User.FullName, t.Subject, t.User.Email, t.Phone, t.Status.ToString(), t.User.CreatedAtUtc, t.DecidedAtUtc,
                db.Avatars.Where(a => a.UserId == t.UserId).Select(a => a.ETag).FirstOrDefault()))
            .ToListAsync(ct);

        var hasMore = rows.Count > take;
        var items = hasMore ? rows[..take] : rows;

        return new CursorPage<TeacherSummaryDto>
        {
            Items = items,
            NextCursor = hasMore && items.Count > 0
                ? Cursor.Encode(items[^1].FullName, items[^1].UserId.ToString())
                : null,
            Total = total
        };
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
