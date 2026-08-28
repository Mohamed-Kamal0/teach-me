using System.Collections.Concurrent;
using Microsoft.Extensions.Options;

namespace TeachersLessons.Api.Features.Helper.Services;

public interface IHelperRateLimiter
{
    /// <summary>False means "over the limit" — the caller answers from the phrase list, never 429.</summary>
    bool TryTake(Guid studentUserId);
}

/// <summary>
/// A sliding window per student, held in memory. In-memory is correct here and will stay correct:
/// README.md states the API is a single instance by necessity, because a Fly volume attaches to
/// one machine and SQLite cannot be shared. A distributed counter would be infrastructure for a
/// topology this app cannot have — if that ever changes, this is one of the things that changes
/// with it.
///
/// At flash-lite prices this is an abuse guard, not a cost guard: a student would have to ask
/// about forty-five thousand questions to spend a dollar. It is here so one bored student with a
/// loop cannot make the app noisy, and so the free tier's per-minute quota is never what fails.
/// </summary>
public class HelperRateLimiter(IOptions<AiOptions> options, TimeProvider clock) : IHelperRateLimiter
{
    private readonly ConcurrentDictionary<Guid, List<DateTimeOffset>> _hits = new();
    private int _callsSinceSweep;

    public bool TryTake(Guid studentUserId)
    {
        var limits = options.Value;
        var now = clock.GetUtcNow();
        var oneMinuteAgo = now - TimeSpan.FromMinutes(1);
        var oneDayAgo = now - TimeSpan.FromDays(1);

        SweepOccasionally(oneDayAgo);

        var hits = _hits.GetOrAdd(studentUserId, _ => []);
        lock (hits)
        {
            hits.RemoveAll(at => at < oneDayAgo);

            if (hits.Count >= limits.RateLimitPerDay ||
                hits.Count(at => at >= oneMinuteAgo) >= limits.RateLimitPerMinute)
            {
                return false;
            }

            hits.Add(now);
            return true;
        }
    }

    /// <summary>
    /// Students who asked once and left would otherwise sit in the dictionary until restart. Every
    /// few hundred questions, drop the ones whose window has emptied.
    /// </summary>
    private void SweepOccasionally(DateTimeOffset oneDayAgo)
    {
        if (Interlocked.Increment(ref _callsSinceSweep) % 256 != 0)
        {
            return;
        }

        foreach (var (studentUserId, hits) in _hits)
        {
            lock (hits)
            {
                hits.RemoveAll(at => at < oneDayAgo);
                if (hits.Count == 0)
                {
                    _hits.TryRemove(studentUserId, out _);
                }
            }
        }
    }
}
