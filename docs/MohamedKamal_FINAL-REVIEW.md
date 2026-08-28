# Final review — Mohamed Kamal · Teachers, Lessons and Students

**Reviewed:** 2026-08-25 · **Supersedes** `MohamedKamal_plan-review.md` and `MohamedKamal_planV2-review.md`
**Judged on:** general engineering practice — vision, scope against the time, schema, API contract,
security, testability, and whether you can defend it line by line.
**Status:** revised once. All five round-1 blocking items taken. **Five items open.**

---

## 1 · Verdict

The strongest design document of the six, and the revision made it a plan as well as a design. The
endpoint table is finished, every validation rule carries the sentence a human reads, and §6 solves
the hardest requirement in the project the only way it can actually be solved. The remaining work is
small and specific.

## 2 · What is strong — keep it, and be able to defend each in one sentence

These are your Q&A preparation. If a judge points anywhere, this is the list you want them pointing at.

- **The `VisibleTo` projection (§6).** Withholding by *not selecting*, so an unopened quiz link is
  absent from the JSON rather than hidden by the browser. This is the right pattern, not merely a
  working one — and it is the only version a raw response can prove.
- **`int` scores rather than `decimal` on SQLite (§3).** EF maps `decimal` to `TEXT` there, with
  unreliable comparison and ordering, and this model compares scores constantly.
- **`TimeProvider` injected (§1).** The timing behaviour becomes demonstrable in seconds and testable
  at all. Designing for the demo at schema time is unusual and correct.
- **The status-code table (§4).** Five codes, one meaning each, with *"403 never returns an empty
  list"* stated as a rule rather than repeated per route. Lead with this if asked about API design.
- **`ProblemDetails` with a field-keyed `errors` dictionary.** Validation lands beside the right
  field on every form without per-form code.
- **The enum plus `DecidedAtUtc`.** It makes the impossible state unrepresentable, which a pair of
  nullable dates does not.
- **Appendix A.** Cutting the refresh-token design was right; keeping it written down, with *"half of
  this is worse than none of it"* as the reason it goes in whole or not at all, turns a scope cut
  into a prepared answer to a question that does get asked.
- **The staggered seed data (§11).** One lesson open, one opening in an hour, one quiz tomorrow, one
  answers already released — the timing requirement demonstrable without touching the database by hand.

**One correction from me.** I grouped antiforgery with the refresh-token subsystem in round 1. Your
refusal was right: it is ~15 lines and it is the price of choosing cookies at all. Your correction
about the administrator being a seeded `Users` row, and therefore inside the unique index, was also
right. Both points are withdrawn.

## 3 · What changed since round 1

| Round 1 | Now |
|---|---|
| Refresh-token subsystem on the critical path | Cut to one sliding cookie ticket; the design is Appendix A |
| First slice was `Users` plus the whole auth stack | Day 16, 09:00–10:30: one form → one POST → one EF write → **still there after F5** |
| A phase list, not a schedule | §9 — wall-clock slots, a done-when per phase, a gate per day |
| A cut list that froze nothing | Ordered by **hours freed**, with a Costs column and two lines marked *this one hurts* |
| No tests named | Four suites, and suite C asserts on **raw JSON** because a missing key and a null key deserialise identically |
| Lists, secrets, logging, seed, README | §4 and §11, with fail-fast startup and `seed --demo` refusing to run in Production |

## 4 · Open issues — the complete list

**M** fix before writing code · **D** decide and write it down · **V** verify before demo day

- [ ] **M1 · Lesson reordering is impossible as designed.** Unique index on
      (`TeacherUserId`, `OrderIndex`), rule **L3** refuses a position another lesson holds, and there
      is no reorder or swap endpoint. Inserting a lesson between 2 and 3 means renumbering everything
      below it, and **every intermediate state violates the constraint** — so each individual `PUT`
      fails. Either add one reorder endpoint that rewrites the block in a single transaction, or drop
      the unique index and treat `OrderIndex` as a sort hint. You will hit this within ten minutes of
      using your own lesson screen.
- [ ] **M2 · There is no freeze, and features land on Day 19 morning.** §9 puts the helper, the state
      panels and the theme pass at 09:00–13:00 on demo day. Building features on the morning you
      present is how demos break, and your gates cannot catch it because they only fire at the end of
      a day already spent. Move the last feature to Day 18; Day 19 morning is rehearsal, README and
      reserve.
- [ ] **M3 · Name the test database, once.** §1 says "EF in-memory SQLite"; §10 says "a fresh SQLite
      file per class". A third option — EF Core's InMemory provider — silently ignores unique indexes,
      and suite B's duplicate-mark `409` would pass against it whether or not the constraint exists,
      which is the exact opposite of what that test is for. Say `Microsoft.Data.Sqlite`, in one place.
- [ ] **D1 · Your gates cut from the wrong end.** The Day 16 gate says "cut items 1–2" — pagination UI
      and the progress visual. If you missed that gate you are behind on *auth*, and neither cut buys
      back an hour of it. Give each gate the two or three lines that free time on the work that
      actually overran.
- [ ] **D2 · Reword the logout check.** "Logout → next API call answers 401" proves the browser
      stopped sending the cookie, not that the ticket was refused — Appendix A already says a cookie
      ticket cannot be recalled. Say what it proves, or shorten the ticket. A check whose name claims
      more than it demonstrates is worse than no check.
- [ ] **V1 · Two theme colours fail your own accessibility claim.** §8 states "all text meets WCAG AA
      on `surface`". Against `#FAF8F4`, `tertiary` amber `#C9852A` is ≈**2.9:1** and `warning` amber
      `#B4741A` is ≈**3.7:1**; AA needs 4.5:1 for body text. The other five tokens pass (`muted` slate
      at 4.6:1, just). Darken both ambers or keep them off text. This is checkable in a browser in ten
      seconds, which is exactly why the claim needs to be true.

**Worth knowing, no action needed:** Day 18 puts both the timing projection and the ownership sweep
after lunch — the two requirements that cannot be faked and the two most likely to expose a design
problem. If either goes wrong at 16:00 there is no room left. Consider moving suite D forward.

Also check that Day 16 really is nine hours of build time. §9 schedules the walking skeleton, the
full schema, both registrations, cookie auth, antiforgery, guards, the public home page and admin
approval on it. If part of that day is scope approval and writing this document, the whole column
shifts onto Day 17 and the schedule has no slack anywhere.

## 5 · Sign-off

Finished when section 4 is empty and these five are true. They are the same five for everybody.

1. **One thing is proven end to end before anything is stacked on it** — one form, one POST, one EF
   write, still there after a refresh. Not auth first. *(You have this — Day 16, 09:00–10:30.)*
2. **Every endpoint row has a success code, every failure code, and who may call it.** *(You have this.)*
3. **Every rule carries the sentence a human reads**, and every server-enforced rule is written as a
   server rule rather than something the form prevents. *(You have this — §5.)*
4. **The cut list is ordered by hours freed**, its first line frees real time, and there is a named
   moment when it fires. *(Ordered — the trigger is D1.)*
5. **The rules that cannot be clicked have automated tests.** *(Four suites — M3 is the last gap.)*
