using System.Net;
using System.Net.Http.Json;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>Suite D — a teacher or student reaches only their own data; everyone else gets a
/// refusal that never leaks whether the thing they asked for exists.</summary>
public class OwnershipIsolationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public OwnershipIsolationTests(ApiFactory factory) => _factory = factory;

    private async Task<Guid> ApproveAsync(HttpClient admin, string email)
    {
        var response = await admin.GetAsync("/api/admin/teachers?status=Pending&pageSize=200");
        var pending = await response.Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
        // Registration normalises email to lowercase — match the same way here.
        var userId = pending!.Items.First(t => string.Equals(t.Email, email, StringComparison.OrdinalIgnoreCase)).UserId;
        await admin.PostAsync($"/api/admin/teachers/{userId}/approve", null);
        return userId;
    }

    [Fact]
    public async Task Teacher_B_cannot_read_edit_or_delete_teacher_As_lesson()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var teacherA = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoA.d1@test.local");
        await ApproveAsync(admin, "isoA.d1@test.local");
        var teacherB = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoB.d1@test.local");
        await ApproveAsync(admin, "isoB.d1@test.local");

        var lessonResponse = await teacherA.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title = "Teacher A's lesson",
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        var lesson = await lessonResponse.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options);

        var read = await teacherB.GetAsync($"/api/teacher/lessons/{lesson!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);

        var edit = await teacherB.PutAsJsonAsync($"/api/teacher/lessons/{lesson.Id}", new
        {
            title = "Hijacked",
            orderIndex = 1,
            recordingUrl = "https://example.com/r2",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        Assert.Equal(HttpStatusCode.NotFound, edit.StatusCode);

        var delete = await teacherB.DeleteAsync($"/api/teacher/lessons/{lesson.Id}");
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    [Fact]
    public async Task Student_cannot_read_a_course_they_never_joined_and_the_body_is_not_an_empty_list()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoC.d2@test.local");
        var teacherUserId = await ApproveAsync(admin, "isoC.d2@test.local");

        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, "isoStudent.d2@test.local");

        var response = await student.GetAsync($"/api/student/courses/{teacherUserId}/lessons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"items\":[]", body);
    }

    [Fact]
    public async Task Student_sees_only_their_own_marks()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoD.d3@test.local");
        await ApproveAsync(admin, "isoD.d3@test.local");

        var lessonResponse = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title = "Shared lesson",
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        var lesson = await lessonResponse.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options);

        var studentsResponse = await teacher.GetAsync("/api/teacher/students");
        var joinCode = (await studentsResponse.Content.ReadFromJsonAsync<JoinCodeEnvelope>(JsonDefaults.Options))!.JoinCode;

        var student1 = await TestAuth.RegisterAndSignInStudentAsync(_factory, "isoStudent1.d3@test.local");
        await student1.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });
        var student1Id = (await (await student1.GetAsync("/api/me")).Content.ReadFromJsonAsync<MeRow>(JsonDefaults.Options))!.UserId;

        var student2 = await TestAuth.RegisterAndSignInStudentAsync(_factory, "isoStudent2.d3@test.local");
        await student2.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });

        await teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lesson!.Id, studentUserId = student1Id, score = 12 });

        var student1Marks = await student1.GetAsync("/api/student/marks");
        var student1Body = await student1Marks.Content.ReadAsStringAsync();
        Assert.Contains("\"score\":12", student1Body);

        var student2Marks = await student2.GetAsync("/api/student/marks");
        var student2Body = await student2Marks.Content.ReadAsStringAsync();
        Assert.Equal("[]", student2Body);
    }

    [Fact]
    public async Task Mark_for_a_non_enrolled_student_is_404()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoE.d4@test.local");
        await ApproveAsync(admin, "isoE.d4@test.local");

        var lessonResponse = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title = "Lesson",
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        var lesson = await lessonResponse.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options);

        // A student who exists, but never joined this teacher.
        var stranger = await TestAuth.RegisterAndSignInStudentAsync(_factory, "isoStranger.d4@test.local");
        var strangerId = (await (await stranger.GetAsync("/api/me")).Content.ReadFromJsonAsync<MeRow>(JsonDefaults.Options))!.UserId;

        var response = await teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lesson!.Id, studentUserId = strangerId, score = 5 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Student_profile_is_404_for_a_student_who_never_joined()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "isoF.d5@test.local");
        await ApproveAsync(admin, "isoF.d5@test.local");

        var stranger = await TestAuth.RegisterAndSignInStudentAsync(_factory, "isoStranger.d5@test.local");
        var strangerId = (await (await stranger.GetAsync("/api/me")).Content.ReadFromJsonAsync<MeRow>(JsonDefaults.Options))!.UserId;

        var response = await teacher.GetAsync($"/api/teacher/students/{strangerId}");

        // Not 403 — a teacher must not be able to probe whether a given id is a student at all.
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Student_profile_marks_are_scoped_to_the_calling_teacher()
    {
        var (teacherA, teacherB, studentId) = await TwoTeachersOneStudentAsync("d6");

        var fromA = await teacherA.GetFromJsonAsync<ProfileRow>($"/api/teacher/students/{studentId}", JsonDefaults.Options);
        var fromB = await teacherB.GetFromJsonAsync<ProfileRow>($"/api/teacher/students/{studentId}", JsonDefaults.Options);

        Assert.Equal(["A only"], fromA!.Marks.Select(m => m.LessonTitle));
        Assert.Equal(["B one", "B two"], fromB!.Marks.Select(m => m.LessonTitle).Order());
    }

    [Fact]
    public async Task Student_profile_total_lessons_is_the_calling_teachers_count()
    {
        var (teacherA, teacherB, studentId) = await TwoTeachersOneStudentAsync("d7");

        var fromA = await teacherA.GetFromJsonAsync<ProfileRow>($"/api/teacher/students/{studentId}", JsonDefaults.Options);
        var fromB = await teacherB.GetFromJsonAsync<ProfileRow>($"/api/teacher/students/{studentId}", JsonDefaults.Options);

        // The denominator counts the caller's own lessons, so it cannot leak the other course's size.
        Assert.Equal(1, fromA!.TotalLessons);
        Assert.Equal(1, fromA.LessonsMarked);
        Assert.Equal(2, fromB!.TotalLessons);
        Assert.Equal(2, fromB.LessonsMarked);
    }

    /// <summary>Teacher A with one lesson, teacher B with two, and one student marked on all three.</summary>
    private async Task<(HttpClient TeacherA, HttpClient TeacherB, Guid StudentId)> TwoTeachersOneStudentAsync(string tag)
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var teacherA = await TestAuth.RegisterAndSignInTeacherAsync(_factory, $"isoProfA.{tag}@test.local");
        await ApproveAsync(admin, $"isoProfA.{tag}@test.local");
        var teacherB = await TestAuth.RegisterAndSignInTeacherAsync(_factory, $"isoProfB.{tag}@test.local");
        await ApproveAsync(admin, $"isoProfB.{tag}@test.local");

        var lessonA = await CreateLessonAsync(teacherA, "A only", 1);
        var lessonB1 = await CreateLessonAsync(teacherB, "B one", 1);
        var lessonB2 = await CreateLessonAsync(teacherB, "B two", 2);

        var codeA = (await teacherA.GetFromJsonAsync<JoinCodeEnvelope>("/api/teacher/students", JsonDefaults.Options))!.JoinCode;
        var codeB = (await teacherB.GetFromJsonAsync<JoinCodeEnvelope>("/api/teacher/students", JsonDefaults.Options))!.JoinCode;

        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, $"isoProfStudent.{tag}@test.local");
        await student.PostAsJsonAsync("/api/student/enrollments", new { code = codeA });
        await student.PostAsJsonAsync("/api/student/enrollments", new { code = codeB });
        var studentId = (await student.GetFromJsonAsync<MeRow>("/api/me", JsonDefaults.Options))!.UserId;

        await teacherA.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lessonA, studentUserId = studentId, score = 15 });
        await teacherB.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lessonB1, studentUserId = studentId, score = 15 });
        await teacherB.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lessonB2, studentUserId = studentId, score = 5 });

        return (teacherA, teacherB, studentId);
    }

    private static async Task<Guid> CreateLessonAsync(HttpClient teacher, string title, int orderIndex)
    {
        var response = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title,
            orderIndex,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options))!.Id;
    }

    private record ProfileRow(Guid UserId, int TotalLessons, int LessonsMarked, List<MarkRow> Marks);
    private record MarkRow(string LessonTitle);
    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record JoinCodeEnvelope(string JoinCode);
    private record LessonRow(Guid Id);
    private record MeRow(Guid UserId);
}
