# FINAL PROJECT · DAYS 16–19

## Teachers, Lessons and Students

**Mohamed Kamal — your brief.** Everything the client wants is on these six pages. How it is built is not on them, and that is on purpose.

---

### The Client

A platform where teachers teach and students learn, and **three different kinds of person** sign in to it.

An **administrator** lets teachers in. A **teacher registers**, waits to be let in — **or turned away** — then keeps their own lessons. Each carries a recording, and may carry a handout, a quiz and the answers to it. The teacher decides **when the lesson opens, when its quiz opens, and when its answers are released**: three separate moments, all theirs. They hold a **joining code**.

A **student registers on their own and belongs to nobody** — an account and a profile, no course. **Entering a teacher's code is a separate thing they do**, and it is what joins them — **and they can do it more than once**, so a student may be on several courses at a time. Inside each they see the lessons open to them now, **are told what is new** since they last looked _at that course_, and can ask a **helper** where to find things.

> **Four things this app is not:**
>
> 1. It does not host, upload or convert files — the recording and the handout are both _links_.
> 2. It has no quiz engine: no question banks, no options, no auto-marking.
> 3. There is no password reset, and no notification leaves the app — both need email. _(See the addendum: a reset that needs no email was built; the no-email half stands.)_
> 4. The helper is not an AI: it is a list of phrases you write, matched to screens.

> **The moment you demo:**
> Approve a teacher, add a lesson whose quiz opens tomorrow, then: **register a student who belongs to nobody** · **your API refuses them a course** · enter the teacher's code and it appears · **the recording plays and the quiz does not** · move the date to now and it does · **enter a second teacher's code and they are on two courses**, each with its own notices. Then ask for a course they never joined — **refused**.

---

### What You Must Decide

None of it is written down for you anywhere:

- Your **tables** and what one row of each is
- The **relationships**, and what happens on delete
- Which table you prove first
- An **endpoint table** with every _failure code_ **and which of the three people may call it**
- Your routes and screens
- Every validation rule and the message a human reads

---

### What Must Work (23 Core Requirements)

Twenty-three outcomes, each carrying the way it is allowed to **fail**. Both halves are graded. **Your cut list matters more here than the list does.**

1. **Teacher Registration:** A teacher registers themselves — name, email, password — and lands on a screen saying the account is waiting.
   - _Failure Rule:_ An email already in use **by anybody — teacher, student, or the administrator — 400**. A weak or mismatched password is caught before the server.

2. **Unified Authentication:** Everyone signs in through one screen — one email box, one password box, and **your server works out which of the three is asking**. The session survives a refresh; the token rides every call.
   - _Failure Rule:_ A wrong password says so without saying which half. Signed out, the API answers **401**. The three land in three different places.

3. **Admin Approval Flow:** The administrator **sees who is waiting** and **approves or refuses each — a decision that cannot be taken twice**. An unapproved teacher is refused everything but their own standing.
   - _Failure Rule:_ Nobody waiting says so, and those screens are unreachable by anyone else. The refusal comes from the **server**. A turned-away teacher is **told**. Deciding twice is refused.

4. **Student Self-Registration:** **A student registers on their own**, belonging to no teacher at all, and lands on their profile.
   - _Failure Rule:_ An email already in use **by anybody — 400**. Nothing on the next screen pretends there is a course.

5. **Joining a Course:** **A student joins a course by entering a teacher's code** — a separate act from registering, and **they may do it again for another teacher**.
   - _Failure Rule:_ An unknown code, or one whose teacher is not approved — refused. The same code twice says "you are already on this course".

6. **Student Profile:** **A student's own profile**: their details, **every course they are on** and when they joined, and the parts they may change.
   - _Failure Rule:_ What they may not change is not on the form — _and_ the server refuses it anyway. Somebody on no courses is told so, and pointed at the joining screen.

7. **Public Home Page:** **The home page, before anyone signs in** — what this is, how many teachers are on it, how to join.
   - _Behavior:_ It reads correctly against an empty database, and needs no token.

8. **Lesson CRUD:** The teacher adds, lists, edits and deletes a **lesson**: title, where it sits in the order, the recording link, **optionally a handout, a quiz and its answers**, the length, the quiz maximum and the pass mark.
   - _Failure Rule:_ An empty title, a maximum of zero or less, a pass mark above the maximum, or a place another lesson holds — **400**. Delete asks first, and is refused if marks exist.

9. **Lesson Release Moments:** **The teacher sets the three moments on a lesson** — when it opens, when its quiz opens, when the answers are released — and may leave any unset.
   - _Failure Rule:_ A quiz opening before its lesson does, or answers before the quiz — refused, saying _which pair_ is wrong. **And a moment set on something that is not there is refused too**: an opening time for a quiz this lesson does not have is a promise it cannot keep.

10. **Teacher Lesson List:** **The teacher's lesson list, in its real order**, each showing which of its three moments have passed.
    - _Behavior:_ A teacher with no lessons yet says so, rather than a blank panel.

11. **Teacher Student List:** **The teacher's student list** — everyone who joined with their code — and the code somewhere they can copy it.
    - _Behavior:_ No students yet says so, and says how somebody joins.

12. **Record Marks:** **Record a mark**: which student, which lesson, what they scored.
    - _Validation:_ The reason lands next to the field that caused it, submit stays disabled while invalid, and a student who is not theirs cannot be chosen.

13. **Student Grade Detail:** **The teacher opens one student** and sees every lesson they have been marked on, in order, passed or failed against that lesson's own pass mark — and can correct a mark there.
    - _Failure Rule:_ A student id that does not exist — **404**, and a "not found" screen rather than a crash.

14. **Class Progress Summary:** **The class summary**: every student, and how far through the course they have got, worked out from the marks themselves.
    - _Behavior:_ A teacher with no marks yet reads zero. It does not vanish and it does not spin forever.

15. **Student Course View:** **The courses a student is on, then one of them**: that teacher's lessons open to them _now_, in order, the recording **playing inside the page**, the handout where there is one, and their own mark on each.
    - _Behavior:_ A lesson with no link, or one that will not embed, shows a message and a plain link — never a dead grey box. A course whose teacher has opened nothing yet says so.

16. **Quiz & Answer Timing:** The student is handed **the quiz once its moment has passed, and the answers once theirs has** — neither one second before.
    - _Behavior:_ A quiz not open yet says when it opens, or says nothing at all. It never shows a dead control hinting at what is coming, and a lesson with no quiz says nothing about quizzes.

17. **What's New Indicator:** **The student is told what is new** since they last looked — per course and totalled — which lessons, quizzes and answers opened, _named_ and attributed to their teacher.
    - _Behavior:_ A first visit says welcome, not "12 new". Opening it twice says nothing is new. **Opening one course does not silence another.**

18. **Helper Feature:** **The helper, for students.** Ask in plain words — "where are my results" — and get a sentence back and a link to the right screen.
    - _Behavior:_ A question it does not know _says so_, and lists what it does know. Somebody on no courses is offered the joining screen, never a course.

19. **Backend Time Enforcement:** **Your server enforces every one of those moments.** Anything whose moment has not come is **not in the response at all** — not sent and hidden, not sent and disabled. The browser is not what withholds it.
    - _Verification:_ Read the raw answer in Postman. An unopened lesson is **refused**; an unopened quiz or answer sheet is simply **not there**. If it is in the response, this is not built — however the screen looks.

20. **Data Isolation:** **Your server keeps everyone inside their own data.** A teacher reaches only their own lessons, students and marks. A student reads only their own marks, and only the lessons of a teacher **they have actually joined** — the URL may say _which course_, but only the token says _who is asking_.
    - _Failure Rule:_ A course they never joined, another teacher's lesson, another student's marks — **refused**, not an empty list. Same for a mark posted for somebody who is not _your_ student.

21. **Access Control Enforcement:** **Your server refuses a student for a course they are not on** — whether they joined nothing at all, or simply not that teacher.
    - _Failure Rule:_ **Refused**, saying what to do. _Not_ an empty list — that tells somebody never entitled to ask that the course is empty — and not a crash on a missing row.

22. **Mark Constraints:** The server refuses a **second mark for the same student on the same lesson**, and a score **outside what that lesson is marked out of** — the bound coming from the lesson, not your code.
    - _Failure Rule:_ **400** on both, server-side. A correction edits the mark already there. Passed or failed is never sent up by the browser.

23. **UI State Management:** **The awkward cases**, everywhere data is loaded.
    - _Behavior:_ Every list has **loading**, **error** and **empty**. **Stop the API mid-demo** and the screen says so — on every screen, not the one you rehearsed.

---

### Access Control Matrix (Who Can Do What)

| WHO                        | WHAT THEY CAN DO                                                                                                                                                            |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrator**          | Lets teachers in, or refuses them. Owns nothing else — no lessons, no students, no marks.                                                                                   |
| **Teacher**, approved      | Everything inside their own teaching, and nothing belonging to another teacher.                                                                                             |
| **Teacher**, waiting       | Signs in, sees one sentence. Every other call answers **403**.                                                                                                              |
| **Teacher**, turned away   | Signs in, and is told they were refused _and when_. Every other call answers **403**.                                                                                       |
| **Student**, on 1+ courses | _Reads_ their teachers' open lessons, their own marks, what is new. _Writes exactly two things_: the course they join, and their own profile. Never a lesson, never a mark. |
| **Student**, on none yet   | Their profile, the joining screen, the helper. Every course call answers **403**.                                                                                           |

**Three kinds of person and no fourth.** Two register themselves; the third never did. Signed out, only the home page and the two registration forms answer — everything else is a **401**. **One email belongs to one person** across all three, the administrator's own address included, and no single table can promise that.

---

## Addendum — what was built beyond this brief

_Added 2026-08-28. Everything above is the client's brief as given, unchanged. Everything below was built **after** all twenty-three requirements were passing, and is recorded here so that the brief and the thing that exists do not quietly disagree._

**All twenty-three requirements still hold.** Nothing in this addendum replaced a requirement, relaxed a failure rule, or removed a screen. Each extension has its own plan file, and each is folded into [`plan.md`](plan.md) §12 rather than left to drift. End to end, every feature — original and added — is walked through in [`FEATURES.md`](FEATURES.md).

| Added                                   | Plan                         | What it is                                                                                                    |
| :-------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Profile photos**                      | [`media.md`](media.md)       | Anyone signed in may set one photo. Every upload is re-encoded to a 256×256 WebP and stored in the database.  |
| **A public teacher directory**          | [`discover.md`](discover.md) | `/teachers` — every approved teacher and their own course's numbers, readable with no session at all.          |
| **A student profile for the teacher**   | [`discover.md`](discover.md) | The teacher's student row opens a person, not a dead end: details, photo, and their marks in lesson order.     |
| **The helper became an AI**             | [`ai.md`](ai.md)             | It answers from the asking student's own courses, lessons and marks — with the phrase list still underneath.   |
| **Resetting your own password**         | [`plan.md` §12.4](plan.md)   | `PUT /api/me/password` — the current password is the proof of identity, so no mail has to leave the app.        |
| **A date of birth on the profile**      | [`plan.md` §3, §5](plan.md)  | A fourth editable field on the student's own row, picked off a calendar and stored as a `DateOnly`.            |
| **Finding a teacher by subject**        | [`plan.md` §12.5](plan.md)   | A teacher declares what they teach; `/teachers` is searched by name **or** subject, in one box, with no session. |

**On the last of those.** The directory's search box already existed and searched names — which answers *"is Amina Farouk on this platform"*, the question of somebody who already has the answer. The question a visitor actually arrives with is *"who teaches biology"*, and the platform had nowhere to store the word "biology": a teacher's subject was implicit in their lesson titles and nowhere else. So teachers now declare one at registration (and may restate it from their own profile, **including while still awaiting a decision** — it is the field that decision turns on), the administrator sees it on the approvals table, and `?q=` matches it alongside the name.

It adds one nullable column, `Teachers.Subject`, and **no new guarantee is asked for or given**. The subject filter is applied *inside* the approved set rather than beside it, so searching for a pending teacher's subject is not the one query that confirms they registered — a rule with a test of its own in suite F. Nothing else about what an anonymous row carries has moved.

The date of birth is the smallest of the six, and the only one that changes a requirement's own screen rather than adding a new one. Req 6 names *"the parts they may change"* without listing them, so a fourth editable field is inside the brief rather than beyond it — and the line that matters is untouched: what may **not** be changed is still absent from the form *and* from the request.

### The one line of this brief that no longer holds

> _"Four things this app is not"_, item 4: **The helper is not an AI: it is a list of phrases you write, matched to screens.**

That line was a **scope fence**, not an architecture requirement — it existed so Req 18 could not balloon into a chatbot project, and it did its job. The fence is now removed, on three conditions, all of which are met and tested:

1. **The phrase list is still wired in as the floor.** With no API key configured, the service graph does not even contain the AI path: the app behaves exactly as it did, byte for byte, and Req 18 passes on its own terms. Turning the feature off in production is one unset secret, no deploy.
2. **Req 19 is not weakened.** The model is never given a tool, a connection or a query. It is shown one JSON snapshot — _the context pack_ — assembled only from values the asking student's own endpoints already return, through the same `LessonQueries.VisibleTo` projection every other student-facing read uses. A lesson whose moment has not come is absent from the pack, so the model cannot leak a title it was never shown. The pack carries **no URL at all** and **no future date**.
3. **Req 18's failure rule still fires.** _"A question it does not know says so, and lists what it does know"_ — when the model says it does not know, the phrase list answers, unknown-topic list and all. And _"somebody on no courses is offered the joining screen, never a course"_ is applied to the model's answer by the same code that applies it to the phrase list's.

Two of the other three "is not" items are untouched and remain true: **the recording and the handout are still links, never uploads** (a profile photo is a photo of a person, not course material), and **there is still no quiz engine**.

The third — _"there is no password reset, and no notification leaves the app — both need email"_ — is now **half true, and the half that changed is the half that never needed email in the first place.** The brief bundled two things under one cause. Only one of them actually depends on mail:

| The two halves of item 3        | Still true? | Why                                                                                                                                      |
| :------------------------------ | :---------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| _No notification leaves the app_ | **Yes**     | Nothing is sent anywhere. There is no SMTP client, no queue and no outbound address in the solution.                                       |
| _No password reset_              | **No**      | A **signed-in** reset needs no message at all: the proof of identity is the current password, which the person types, and nothing is sent. |

What email actually buys is the **forgotten**-password case — proving identity to someone who cannot sign in. That still does not exist, and cannot without a mailbox. What was built is the case underneath it: **anybody signed in can reset their own password from their own profile page**, teacher, student and administrator alike. That matters most for the administrator, whose first password is seeded from `Seed:AdminPassword` and therefore also lives in a config file, a deploy script and somebody's shell history; `DbSeeder` only ever *inserts*, so a password changed in the app is the password from then on and the seeded one can stop being a live credential.

### The demo script, extended

The brief's own demo script runs unchanged. Two moments were added to the end of it, and both are things a visitor can see before they have an account:

- open `/teachers` **signed out** — the approved teachers are listed with their photos, the subject each teaches and their own course's numbers, and the raw response carries neither an email nor a joining code. Type a subject rather than a name into the search box: it finds every teacher who teaches it, and a teacher still awaiting approval is not among them;
- ask the helper _"how did I do on the last quiz"_ as a signed-in student — it answers from that student's actual marks, and the "Take me there" button only appears for a screen that student is genuinely entitled to.
