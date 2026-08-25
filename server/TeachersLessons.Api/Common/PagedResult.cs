namespace TeachersLessons.Api.Common;

public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
}

public static class PagingExtensions
{
    public const int MaxPageSize = 100;

    public static (int page, int pageSize) Normalize(int? page, int? pageSize)
    {
        var p = page is null or < 1 ? 1 : page.Value;
        var ps = pageSize is null or < 1 ? 20 : Math.Min(pageSize.Value, MaxPageSize);
        return (p, ps);
    }
}
