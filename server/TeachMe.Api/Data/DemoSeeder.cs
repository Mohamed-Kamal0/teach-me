using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TeachMe.Api.Common;
using TeachMe.Api.Domain;

namespace TeachMe.Api.Data;

/// <summary>What a demo reseed produced, so the caller can report it rather than guess at it.</summary>
public readonly record struct DemoSeedSummary(int Teachers, int Students, int Lessons, int Enrollments, int Marks);

/// <summary>
/// `dotnet run -- seed --demo` — drop, migrate, and seed one known, staggered dataset,
/// so a broken database on demo day is a thirty-second fix, not an improvisation. The named
/// accounts below are the scripted walkthrough; a generated cohort of sixty-odd teachers, a
/// hundred and fifty students, and the lessons and marks between them sits behind those, so
/// every screen is seen at a size it will really be — and so every list is long enough that
/// its cursor scroll (`Common/CursorPage.cs`) is exercised rather than merely present.
/// </summary>
public static class DemoSeeder
{
    public static async Task<DemoSeedSummary> RunAsync(AppDbContext db, string adminEmail, string adminPassword, TimeProvider clock)
    {
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();

        var now = clock.GetUtcNow();
        var hasher = new PasswordHasher<User>();

        // `passwordHash` is for the generated cohort, which all shares one hash. PBKDF2 is
        // deliberately slow, and hashing the same "Demo1234" two hundred times over — only to
        // overwrite each result a line later — put seconds on every reseed for nothing.
        User MakeUser(string email, string fullName, UserRole role, string? passwordHash = null)
        {
            var u = new User
            {
                Id = Guid.CreateVersion7(),
                Email = email,
                FullName = fullName,
                Role = role,
                CreatedAtUtc = now
            };
            u.PasswordHash = passwordHash ?? hasher.HashPassword(u, "Demo1234");
            return u;
        }

        var admin = new User
        {
            Id = Guid.CreateVersion7(),
            Email = adminEmail.Trim().ToLowerInvariant(),
            FullName = "Administrator",
            Role = UserRole.Admin,
            CreatedAtUtc = now
        };
        admin.PasswordHash = hasher.HashPassword(admin, adminPassword);
        db.Users.Add(admin);

        var approvedTeacherUser = MakeUser("teacher.approved@demo.test", "Amina Farouk", UserRole.Teacher);
        var pendingTeacherUser = MakeUser("teacher.pending@demo.test", "Karim Aziz", UserRole.Teacher);
        var rejectedTeacherUser = MakeUser("teacher.rejected@demo.test", "Salma Nabil", UserRole.Teacher);
        var secondApprovedTeacherUser = MakeUser("teacher.second@demo.test", "Youssef Adel", UserRole.Teacher);
        db.Users.AddRange(approvedTeacherUser, pendingTeacherUser, rejectedTeacherUser, secondApprovedTeacherUser);

        var approvedTeacher = new Teacher
        {
            UserId = approvedTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Subject = "Mathematics",
            Phone = "+20 100 555 0101",
            Status = TeacherStatus.Approved,
            DecidedAtUtc = now.AddDays(-2),
            DecidedByUserId = admin.Id
        };
        var pendingTeacher = new Teacher
        {
            UserId = pendingTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Subject = "Chemistry",
            Phone = "+20 100 555 0102",
            Status = TeacherStatus.Pending
        };
        var rejectedTeacher = new Teacher
        {
            UserId = rejectedTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Subject = "History",
            Phone = "+20 100 555 0103",
            Status = TeacherStatus.Rejected,
            DecidedAtUtc = now.AddDays(-1),
            DecidedByUserId = admin.Id
        };
        var secondApprovedTeacher = new Teacher
        {
            UserId = secondApprovedTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Subject = "Biology",
            Phone = "+20 100 555 0104",
            Status = TeacherStatus.Approved,
            DecidedAtUtc = now.AddDays(-3),
            DecidedByUserId = admin.Id
        };
        db.Teachers.AddRange(approvedTeacher, pendingTeacher, rejectedTeacher, secondApprovedTeacher);

        // Real embeddable links so the demo's "the recording plays inside the page" actually plays.
        string[] recordings =
        [
            "https://www.youtube.com/watch?v=NybHckSEQBI",
            "https://www.youtube.com/watch?v=aircAruvnKk",
            "https://www.youtube.com/watch?v=WUvTyaaNkzM",
            "https://www.youtube.com/watch?v=kYB8IZa5AuE"
        ];

        Lesson MakeLesson(Guid teacherId, int order, string title, DateTimeOffset? opens,
            DateTimeOffset? quizOpens, DateTimeOffset? answersOpen, bool withQuiz, bool withAnswers) => new()
        {
            Id = Guid.CreateVersion7(),
            TeacherUserId = teacherId,
            Title = title,
            OrderIndex = order,
            RecordingUrl = recordings[(order - 1) % recordings.Length],
            HandoutUrl = "https://example.com/handout/" + Guid.NewGuid(),
            QuizUrl = withQuiz ? "https://example.com/quiz/" + Guid.NewGuid() : null,
            AnswersUrl = withAnswers ? "https://example.com/answers/" + Guid.NewGuid() : null,
            DurationMinutes = 45,
            QuizMaxScore = 20,
            PassMark = 10,
            OpensAtUtc = opens,
            QuizOpensAtUtc = withQuiz ? quizOpens : null,
            AnswersOpenAtUtc = withAnswers ? answersOpen : null
        };

        var lessons = new List<Lesson>
        {
            // Teacher 1 — four lessons, deliberately staggered moments.
            MakeLesson(approvedTeacher.UserId, 1, "Introduction to Algebra",
                now.AddDays(-5), now.AddDays(-5).AddHours(1), now.AddDays(-4), true, true),
            MakeLesson(approvedTeacher.UserId, 2, "Linear Equations",
                now.AddDays(-1), now.AddHours(1), now.AddDays(1), true, true),
            MakeLesson(approvedTeacher.UserId, 3, "Quadratic Equations",
                now.AddHours(-1), now.AddDays(1), now.AddDays(2), true, true),
            MakeLesson(approvedTeacher.UserId, 4, "Graphing Functions",
                now.AddDays(3), null, null, false, false),

            // Teacher 2 (second approved) — four more lessons.
            MakeLesson(secondApprovedTeacher.UserId, 1, "Cell Biology Basics",
                now.AddDays(-3), now.AddDays(-3).AddHours(1), now.AddDays(-3).AddHours(2), true, true),
            MakeLesson(secondApprovedTeacher.UserId, 2, "Photosynthesis",
                now.AddHours(-2), now.AddHours(-1), now.AddHours(1), true, true),
            MakeLesson(secondApprovedTeacher.UserId, 3, "Genetics 101",
                now.AddDays(-1), null, null, false, false),
            MakeLesson(secondApprovedTeacher.UserId, 4, "Ecosystems",
                now.AddDays(2), null, null, false, false)
        };
        db.Lessons.AddRange(lessons);

        var student1 = MakeUser("student.one@demo.test", "Nourhan Sami", UserRole.Student);
        var student2 = MakeUser("student.two@demo.test", "Omar Tarek", UserRole.Student);
        db.Users.AddRange(student1, student2);

        var studentProfile1 = new Student
        {
            UserId = student1.Id,
            DisplayName = "Nourhan",
            Phone = "+20 100 555 0142",
            DateOfBirth = new DateOnly(2004, 3, 18),
            Bio = "Second-year student, revising for finals."
        };
        var studentProfile2 = new Student { UserId = student2.Id };
        db.Students.AddRange(studentProfile1, studentProfile2);

        var enrollment1 = new Enrollment
        {
            Id = Guid.CreateVersion7(),
            StudentUserId = student1.Id,
            TeacherUserId = approvedTeacher.UserId,
            JoinedAtUtc = now.AddDays(-4),
            LastViewedAtUtc = now.AddDays(-2)
        };
        var enrollment2 = new Enrollment
        {
            Id = Guid.CreateVersion7(),
            StudentUserId = student1.Id,
            TeacherUserId = secondApprovedTeacher.UserId,
            JoinedAtUtc = now.AddDays(-2),
            LastViewedAtUtc = null
        };
        var enrollment3 = new Enrollment
        {
            Id = Guid.CreateVersion7(),
            StudentUserId = student2.Id,
            TeacherUserId = approvedTeacher.UserId,
            JoinedAtUtc = now.AddDays(-1),
            LastViewedAtUtc = now.AddDays(-1)
        };
        db.Enrollments.AddRange(enrollment1, enrollment2, enrollment3);

        var marks = new List<Mark>
        {
            new()
            {
                Id = Guid.CreateVersion7(), LessonId = lessons[0].Id, StudentUserId = student1.Id,
                Score = 16, RecordedAtUtc = now.AddDays(-3)
            },
            new()
            {
                Id = Guid.CreateVersion7(), LessonId = lessons[1].Id, StudentUserId = student1.Id,
                Score = 7, RecordedAtUtc = now.AddHours(-12)
            },
            new()
            {
                Id = Guid.CreateVersion7(), LessonId = lessons[0].Id, StudentUserId = student2.Id,
                Score = 12, RecordedAtUtc = now.AddDays(-2)
            }
        };
        db.Marks.AddRange(marks);

        // ---- Bulk cohort ---------------------------------------------------------------
        // Everything above is the scripted part of the demo: those rows are walked through by
        // name and asserted on by the smoke tests, so they stay exactly as they are.
        // Everything below is volume — tens of teachers, students, lessons and marks — so the
        // approvals queue, the class lists and the progress tables are seen at a realistic
        // size instead of looking like an empty shell.
        var rng = new Random(20260830);   // fixed seed: two reseeds give the same demo database

        // One hash reused across the generated accounts. PBKDF2 is deliberately slow, and
        // hashing the same "Demo1234" sixty times over would add seconds to every reseed.
        var sharedHash = hasher.HashPassword(admin, "Demo1234");

        // NextName draws at random and retries on a collision, so the pool has to be much larger
        // than the cohort or the last few names cost hundreds of throws each. Forty by thirty-two
        // is 1,280 pairs for the ~210 people below — a collision is rare and never a stall.
        string[] firstNames =
        [
            "Amir", "Hana", "Mostafa", "Layla", "Tamer", "Dina", "Ziad", "Farida", "Hassan", "Mariam",
            "Sherif", "Yasmin", "Adham", "Rana", "Kareem", "Nada", "Bassem", "Sara", "Marwan", "Habiba",
            "Omar", "Malak", "Seif", "Nourhan", "Ahmed", "Aya", "Khaled", "Menna", "Mahmoud", "Salma",
            "Youssef", "Jana", "Ali", "Rowan", "Ibrahim", "Tia", "Mazen", "Lina", "Hesham", "Zeina"
        ];
        string[] lastNames =
        [
            "Ibrahim", "Mahmoud", "Shaker", "Fathy", "Zaki", "Hegazy", "Roshdy", "Mansour",
            "Selim", "Gaber", "Kamel", "Sabry", "Riad", "Hafez", "Bakr", "Lotfy",
            "Nassar", "Sharaf", "Attia", "Ramzy", "Sultan", "Fahmy", "Wahba", "Ezzat",
            "Anwar", "Rashad", "Tawfik", "Sadek", "Helmy", "Naguib", "Baz", "Qassem"
        ];
        string[] subjects =
        [
            "Mathematics", "Physics", "Chemistry", "Biology",
            "History", "Geography", "English Literature", "Computer Science"
        ];
        // Twelve titles a subject, because a course now runs to twelve lessons and the title is
        // picked by position: a shorter list would wrap and put "Number Sense" in the course twice.
        var syllabus = new Dictionary<string, string[]>
        {
            ["Mathematics"] = ["Number Sense", "Working with Fractions", "Ratio and Proportion", "Intro to Geometry", "Trigonometry Basics", "Probability", "Algebraic Expressions", "Solving Equations", "Straight-Line Graphs", "Area and Volume", "Sequences", "Statistics and Averages"],
            ["Physics"] = ["Motion and Speed", "Forces at Work", "Energy and Power", "Waves and Sound", "Light and Optics", "Electric Circuits", "Magnetism", "Pressure and Density", "Heat Transfer", "Momentum", "Radioactivity", "The Solar System"],
            ["Chemistry"] = ["States of Matter", "The Periodic Table", "Chemical Bonding", "Acids and Bases", "Reaction Rates", "Organic Chemistry", "Atomic Structure", "Mixtures and Separation", "Moles and Masses", "Electrolysis", "Energy in Reactions", "Chemistry of the Air"],
            ["Biology"] = ["The Human Cell", "Digestion", "Respiration", "Heredity", "Evolution", "Human Body Systems", "Photosynthesis", "Enzymes", "The Nervous System", "Disease and Immunity", "Ecosystems", "Biotechnology"],
            ["History"] = ["Ancient Egypt", "The Classical World", "The Middle Ages", "Age of Revolutions", "The World Wars", "The Modern Era", "Trade and Empire", "The Industrial Age", "Nationalism", "The Cold War", "Decolonisation", "Reading a Source"],
            ["Geography"] = ["Reading a Map", "Rivers and Deltas", "Climate Zones", "Population and Cities", "Natural Resources", "Fieldwork Methods", "Plate Tectonics", "Coasts and Erosion", "Weather Systems", "Farming and Food", "Development", "Sustainability"],
            ["English Literature"] = ["Close Reading", "Poetry and Form", "Shakespeare in Context", "The Modern Novel", "Writing an Essay", "Drama on the Page", "Narrative Voice", "Imagery and Metaphor", "The Short Story", "Character and Motive", "Comparing Texts", "Editing Your Own Work"],
            ["Computer Science"] = ["How Computers Think", "Variables and Loops", "Working with Data", "Algorithms", "Databases", "The Web", "Functions", "Lists and Dictionaries", "Files and Input", "Sorting and Searching", "Testing and Debugging", "Networks and Security"]
        };
        string[] bios =
        [
            "Revising for the end-of-term exams.",
            "Repeating the year and determined to pass this time.",
            "Studying in the evenings around work.",
            "Strongest in the sciences, weakest in essays.",
            "Joined mid-term after moving schools."
        ];

        var usedNames = new HashSet<string>();
        string NextName()
        {
            while (true)
            {
                var name = $"{firstNames[rng.Next(firstNames.Length)]} {lastNames[rng.Next(lastNames.Length)]}";
                if (usedNames.Add(name))
                {
                    return name;
                }
            }
        }

        var usedCodes = new HashSet<string>(db.Teachers.Local.Select(t => t.JoinCode));
        string NextJoinCode()
        {
            string code;
            do
            {
                code = JoinCodeGenerator.Generate();
            } while (!usedCodes.Add(code));
            return code;
        }

        // Sixty more teachers: thirty-six teaching, fourteen still waiting on a decision, ten
        // turned away. Every list they land on is then longer than one slice — the directory runs
        // to thirty-eight courses and the approvals queue to fifteen — so the scroll is something
        // the demo actually does rather than a mechanism you have to be told is there.
        var bulkTeachers = new List<Teacher>();
        var bulkLessons = new List<Lesson>();
        for (var i = 1; i <= 60; i++)
        {
            var status = i <= 36 ? TeacherStatus.Approved
                : i <= 50 ? TeacherStatus.Pending
                : TeacherStatus.Rejected;

            var user = MakeUser($"teacher{i:00}@demo.test", NextName(), UserRole.Teacher, sharedHash);
            user.CreatedAtUtc = now.AddDays(-rng.Next(20, 120));
            db.Users.Add(user);

            var subject = subjects[(i - 1) % subjects.Length];
            var teacher = new Teacher
            {
                UserId = user.Id,
                JoinCode = NextJoinCode(),
                Subject = subject,
                Phone = $"+20 100 555 {1000 + i}",
                Status = status,
                DecidedAtUtc = status == TeacherStatus.Pending ? null : now.AddDays(-rng.Next(1, 20)),
                DecidedByUserId = status == TeacherStatus.Pending ? null : admin.Id
            };
            db.Teachers.Add(teacher);
            bulkTeachers.Add(teacher);

            if (status != TeacherStatus.Approved)
            {
                continue;
            }

            var titles = syllabus[subject];
            // Six to twelve: a short course still fits one slice, a full one does not, so both
            // shapes are on screen somewhere in the demo.
            var lessonCount = 6 + rng.Next(0, 7);
            for (var order = 1; order <= lessonCount; order++)
            {
                // Each course is walked from its own start into next week, so at any moment most
                // of it is open, one lesson is opening about now, and the last two are still
                // shut. The window is measured from the *length* of the course rather than from
                // a fixed fortnight: at four lessons those were the same thing, but a twelve
                // lesson course pinned to a fortnight would have three quarters of it in the
                // future, and every progress bar in the demo would read "2 of 12".
                var opensAt = now.AddDays((-4 * (lessonCount - 2)) + (order * 4) + rng.Next(-1, 2))
                    .AddHours(rng.Next(0, 9));
                var withQuiz = order % 4 != 0;
                var withAnswers = withQuiz && order % 3 != 0;
                var quizOpensAt = opensAt.AddHours(rng.Next(1, 49));

                bulkLessons.Add(new Lesson
                {
                    Id = Guid.CreateVersion7(),
                    TeacherUserId = teacher.UserId,
                    Title = titles[(order - 1) % titles.Length],
                    OrderIndex = order,
                    RecordingUrl = recordings[(order - 1) % recordings.Length],
                    HandoutUrl = "https://example.com/handout/" + Guid.NewGuid(),
                    QuizUrl = withQuiz ? "https://example.com/quiz/" + Guid.NewGuid() : null,
                    AnswersUrl = withAnswers ? "https://example.com/answers/" + Guid.NewGuid() : null,
                    DurationMinutes = 30 + (rng.Next(0, 5) * 15),
                    QuizMaxScore = 20,
                    PassMark = 10,
                    OpensAtUtc = opensAt,
                    QuizOpensAtUtc = withQuiz ? quizOpensAt : null,
                    AnswersOpenAtUtc = withAnswers ? quizOpensAt.AddDays(rng.Next(1, 4)) : null
                });
            }
        }
        db.Lessons.AddRange(bulkLessons);

        var approvedPool = new List<Teacher> { approvedTeacher, secondApprovedTeacher };
        approvedPool.AddRange(bulkTeachers.Where(t => t.Status == TeacherStatus.Approved));

        var lessonsByTeacher = lessons.Concat(bulkLessons)
            .GroupBy(l => l.TeacherUserId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // A hundred and fifty more students, each on one to three courses and most with marks
        // behind them, so a class list is a roll and a progress table has a spread to read. With
        // three in five put on one of the two teachers the demo signs in as, those two rosters
        // run to roughly forty-five each — long enough that scrolling one is the point.
        var bulkEnrollments = new List<Enrollment>();
        var bulkMarks = new List<Mark>();
        for (var i = 1; i <= 150; i++)
        {
            var name = NextName();
            var user = MakeUser($"student{i:00}@demo.test", name, UserRole.Student, sharedHash);
            user.CreatedAtUtc = now.AddDays(-rng.Next(5, 90));
            db.Users.Add(user);

            db.Students.Add(new Student
            {
                UserId = user.Id,
                DisplayName = name.Split(' ')[0],
                Phone = $"+20 111 555 {2000 + i}",
                DateOfBirth = new DateOnly(2002 + rng.Next(0, 6), rng.Next(1, 13), rng.Next(1, 29)),
                // Every third profile is left bare: a half-filled profile is the normal case.
                Bio = i % 3 == 0 ? null : bios[rng.Next(bios.Length)]
            });

            // Three students in five are put on one of the two teachers the demo actually signs
            // in as, so that class list and progress table are full rather than a handful of
            // rows scattered thinly across fourteen courses.
            var courseCount = 1 + rng.Next(0, 3);
            var courses = approvedPool.OrderBy(_ => rng.Next()).Take(courseCount).ToList();
            if (rng.Next(5) < 3)
            {
                var headline = rng.Next(2) == 0 ? approvedTeacher : secondApprovedTeacher;
                if (!courses.Contains(headline))
                {
                    courses[rng.Next(courses.Count)] = headline;
                }
            }

            foreach (var teacher in courses)
            {
                var joinedAt = now.AddDays(-rng.Next(1, 40));
                bulkEnrollments.Add(new Enrollment
                {
                    Id = Guid.CreateVersion7(),
                    StudentUserId = user.Id,
                    TeacherUserId = teacher.UserId,
                    JoinedAtUtc = joinedAt,
                    LastViewedAtUtc = rng.Next(4) == 0
                        ? null
                        : joinedAt.AddDays(rng.NextDouble() * (now - joinedAt).TotalDays)
                });

                if (!lessonsByTeacher.TryGetValue(teacher.UserId, out var courseLessons))
                {
                    continue;
                }

                foreach (var lesson in courseLessons)
                {
                    // A mark only exists once the quiz was open and the student was on the
                    // course to sit it, and a quarter of the time nobody sat it at all.
                    if (lesson.QuizOpensAtUtc is not { } quizOpensAt)
                    {
                        continue;
                    }

                    var from = quizOpensAt > joinedAt ? quizOpensAt : joinedAt;
                    if (from > now || rng.Next(100) < 25)
                    {
                        continue;
                    }

                    bulkMarks.Add(new Mark
                    {
                        Id = Guid.CreateVersion7(),
                        LessonId = lesson.Id,
                        StudentUserId = user.Id,
                        // Centred just above the pass mark, with a real tail of failures.
                        Score = Math.Clamp(lesson.PassMark + rng.Next(-7, 11), 0, lesson.QuizMaxScore),
                        RecordedAtUtc = from.AddHours(rng.NextDouble() * (now - from).TotalHours)
                    });
                }
            }
        }
        db.Enrollments.AddRange(bulkEnrollments);
        db.Marks.AddRange(bulkMarks);

        await db.SaveChangesAsync();

        return new DemoSeedSummary(
            db.Teachers.Local.Count,
            db.Students.Local.Count,
            db.Lessons.Local.Count,
            db.Enrollments.Local.Count,
            db.Marks.Local.Count);
    }
}
