using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TeachersLessons.Api.Common;
using TeachersLessons.Api.Domain;

namespace TeachersLessons.Api.Data;

/// <summary>
/// `dotnet run -- seed --demo` — drop, migrate, and seed one known, staggered dataset,
/// so a broken database on demo day is a thirty-second fix, not an improvisation.
/// </summary>
public static class DemoSeeder
{
    public static async Task RunAsync(AppDbContext db, string adminEmail, string adminPassword, TimeProvider clock)
    {
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();

        var now = clock.GetUtcNow();
        var hasher = new PasswordHasher<User>();

        User MakeUser(string email, string fullName, UserRole role)
        {
            var u = new User
            {
                Id = Guid.CreateVersion7(),
                Email = email,
                FullName = fullName,
                Role = role,
                CreatedAtUtc = now
            };
            u.PasswordHash = hasher.HashPassword(u, "Demo1234");
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
            Status = TeacherStatus.Approved,
            DecidedAtUtc = now.AddDays(-2),
            DecidedByUserId = admin.Id
        };
        var pendingTeacher = new Teacher
        {
            UserId = pendingTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Status = TeacherStatus.Pending
        };
        var rejectedTeacher = new Teacher
        {
            UserId = rejectedTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
            Status = TeacherStatus.Rejected,
            DecidedAtUtc = now.AddDays(-1),
            DecidedByUserId = admin.Id
        };
        var secondApprovedTeacher = new Teacher
        {
            UserId = secondApprovedTeacherUser.Id,
            JoinCode = JoinCodeGenerator.Generate(),
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

        await db.SaveChangesAsync();
    }
}
