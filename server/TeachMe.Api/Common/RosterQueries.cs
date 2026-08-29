using TeachMe.Api.Domain;

namespace TeachMe.Api.Common;

/// <summary>
/// A teacher's roster is read from two screens — the student list and the progress table — and
/// both have to walk it in the same order, or a cursor minted by one would land in the wrong
/// place on the other. The order lives here so there is only ever one of it.
/// </summary>
public static class RosterQueries
{
    /// <summary>Name, then id. The id is not for the reader — it is the tiebreak that makes two
    /// students called "Sara Ahmed" a stable pair of rows rather than a coin toss the next
    /// request may call differently.</summary>
    public const int CursorFields = 2;

    public static IQueryable<Enrollment> RosterPage(this IQueryable<Enrollment> enrollments, CursorKey? key)
    {
        if (key is { } k)
        {
            var afterName = k.Text(0);
            var afterId = k.Uuid(1);

            enrollments = enrollments.Where(e =>
                string.Compare(e.Student.User.FullName, afterName) > 0
                || (e.Student.User.FullName == afterName && e.StudentUserId.CompareTo(afterId) > 0));
        }

        return enrollments
            .OrderBy(e => e.Student.User.FullName)
            .ThenBy(e => e.StudentUserId);
    }

    public static string RosterCursor(string fullName, Guid studentUserId) =>
        Cursor.Encode(fullName, studentUserId.ToString());
}
