namespace TeachersLessons.Api.Common;

public class ValidationApiException(IDictionary<string, string[]> errors) : Exception
{
    public IDictionary<string, string[]> Errors { get; } = errors;

    public ValidationApiException(string field, string message)
        : this(new Dictionary<string, string[]> { [field] = [message] })
    {
    }
}

public class NotFoundApiException() : Exception("Not found.");

public class ConflictApiException(string message) : Exception(message);
