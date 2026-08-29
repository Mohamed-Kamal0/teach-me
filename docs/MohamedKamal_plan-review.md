# Plan review — Mohamed Kamal · Teach Me

**Reviewed:** 2026-08-25
**Judged on:** general engineering practice — is the vision clear, is the scope honest against the
time, is the schema sound, is the API contract complete, is the security thinking right, can it be
tested, and can you defend it line by line. Not against a house style you were not given.

This is a strong design document — stronger than most first plans written by people with jobs. The
endpoint table is finished, the validation messages are written, and §6 solves the hardest problem in
the project the only way it can actually be solved. Nearly everything below is about **scope,
sequencing and ownership**, not about whether your design is correct. You have one real build day.
Most of these notes are about handing it back to you.

## Blocking — fix before you write code

1. **Cut the refresh-token subsystem down to a plain signed token or a plain cookie ticket.** Drop
   rotation, token families, reuse detection, the antiforgery filter, the single-flight interceptor,
   the cleanup `BackgroundService`, and `GET`/`DELETE /api/auth/sessions`. The design is genuinely
   good — better than the `localStorage` JWT most people ship — and that is exactly the trap. Nothing
   in the requirements asks for it, it is roughly a day, it sits at phases 2 and 2b **ahead of every
   lesson, mark and enrolment**, and every line of it lands on the main request path where you have
   to explain it under questioning. Move the whole design to an appendix headed "what I would build
   next" — that is a real answer to a question you will actually be asked, and it costs you nothing.
2. **Change what you prove end to end first.** Right now it is `Users` plus the entire auth stack,
   which is the heaviest possible walking skeleton. Prove the thinnest slice instead — one form, one
   POST, one EF write, one read back after a refresh — on a table with no dependencies. Auth-first
   hides your real integration risk (CORS, the dev proxy, https, cookie flags) behind a day of work,
   and you find it at the worst possible moment. Put `[Authorize]` on afterwards; it is one attribute
   once the pipe is proven.
3. **Turn the phase list into a schedule.** Nine phases headed "Days 16–19" is an ordering, not a
   plan. Give each phase a wall-clock slot against the day you actually have, and mark the point in
   the day where, if you are not past phase N, the cut list fires. A plan that cannot tell you you
   are behind is not doing its job.
4. **Rewrite the cut list so the first line frees real hours.** "Class progress charts" were never in
   scope, so cutting them frees nothing. Order by hours saved against damage to the demo, and be
   honest that the last two or three lines will hurt — that is what a cut list is.
5. **Name the automated tests for your four server-side rules** — the pending-teacher refusal, the
   timing rule, the ownership rule, and the mark constraints. Your §10 is excellent and it is entirely
   manual, which means it gets run once, late, by a tired person. These four are the rules that fail
   _silently_ and that you cannot click your way to confidence in — and they are the ones most likely
   to have been written by something other than you.

## Worth changing — do it today if you can

1. **Bound your list endpoints.** No route in the table says anything about page size, ordering or a
   cap. Fine at demo scale, wrong as a habit, and free to state now: a default order and a sane limit
   on every list.
2. **Say where the secrets live.** The seeded administrator credential and the ticket-signing key are
   both in your design and neither has a home. User-secrets or environment variables, never
   `appsettings.json` in the repository — and say what a clean clone has to set.
3. **Plan the demo data.** One command that drops, migrates and seeds a known set of teachers,
   lessons, marks and moments. A broken database at 9am on demo day should be a thirty-second fix,
   not an improvisation.
4. **Add the minimum observability:** one structured log line per request with the status code, and a
   health endpoint. Debugging a 403 you did not expect, on the afternoon of day 18, without logs,
   costs more than the twenty minutes this takes.
5. **Write down the status-code convention once, in one place.** 409 for a state conflict (already
   decided, already enrolled, marks exist) is the more correct choice and you should keep it — but it
   needs to be a stated rule applied uniformly, not a per-route decision, or it reads as drift.
6. **A README that runs from a clean clone**, in the order a stranger would need: restore, migrate,
   seed, run API, run client.
7. **Mark the lines you have actually read.** This document is long, confident, and does not sound
   like a first plan. That is fine — but every line on the path a request takes through your main
   feature is a line you may be asked to explain, and the ones you skim are always the ones picked.

## Suggestions — take them or leave them, say which

1. **Keep these, and be ready to give the reason in one sentence each.** They are the best decisions
   in the document: the `VisibleTo` **projection** (withholding by not selecting, so an unopened link
   is absent from the response rather than hidden by the browser — this is the right pattern, not just
   a working one); `int` scores rather than `decimal` on SQLite; `TimeProvider` injected so the
   timing behaviour is demonstrable and testable; `ProblemDetails` with a field-keyed `errors`
   dictionary so the UI renders any validation failure generically; the 403-versus-404 convention;
   and the shared loading/error/empty panel with an error interceptor behind it.
2. **Keep the enum plus `DecidedAtUtc`** for teacher standing. It makes the impossible state
   unrepresentable, which a pair of nullable dates does not — that is the stronger schema.
3. **A single identity table with 1:1 role profiles is the right call** and worth defending out loud.
   The one thing it does not solve is the administrator whose credentials live in configuration and
   who owns no row — so keep the uniqueness check in the service anyway, and know why.
4. **`Guid` or `int` are both defensible.** If you keep UUIDv7, be able to give the enumeration
   argument in one sentence; if that sentence does not feel like yours, use `int`. The value is in
   the reasoning, not in the more impressive choice.
5. **Give each phase a one-line definition of done** — the sentence that tells you it is finished
   rather than nearly finished.

A refusal is a fine answer to anything in the last section. Write it down as a decision, with the
reason, and it counts in your favour.
