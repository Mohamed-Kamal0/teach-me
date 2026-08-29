namespace TeachMe.Api.Tests.TestSupport;

/// <summary>A shiftable clock for tests — the Req 16 "move the date to now" demo, made assertable.</summary>
public class ManualTimeProvider : TimeProvider
{
    private DateTimeOffset _now = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public void SetUtcNow(DateTimeOffset now) => _now = now;

    public void Advance(TimeSpan by) => _now += by;
}
