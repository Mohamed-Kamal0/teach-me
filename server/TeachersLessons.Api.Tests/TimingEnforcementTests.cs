using System.Net;
using System.Net.Http.Json;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>
/// Suite C — the server, not the browser, withholds anything whose moment has not passed.
/// Asserted on raw JSON: a missing key and a null key deserialise identically, and the
/// difference between them is the entire requirement.
/// </summary>
public class TimingEnforcementTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public TimingEnforcementTests(ApiFactory factory) => _factory = factory;

    private record Setup(HttpClient Student, Guid TeacherUserId, Guid OpenLessonId, string StudentEmail, string StudentPassword);

    private async Task<Setup> ArrangeAsync(string suffix)
    {
        var now = _factory.Clock.GetUtcNow();
        var teacherEmail = $"timingteacher.{suffix}@test.local";
        var studentEmail = $"timingstudent.{suffix}@test.local";

        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, teacherEmail);
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var pendingResponse = await admin.GetAsync("/api/admin/teachers?status=Pending&pageSize=200");
        var pending = await pendingResponse.Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
        var teacherUserId = pending!.Items.First(t => t.Email == teacherEmail).UserId;
        await admin.PostAsync($"/api/admin/teachers/{teacherUserId}/approve", null);

        // Lesson 1: open now, quiz opens tomorrow, answers open in two days.
        var lesson1 = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title = "Open lesson, quiz not yet",
            orderIndex = 1,
            recordingUrl = "https://example.com/r1",
            handoutUrl = (string?)null,
            quizUrl = "https://example.com/q1",
            answersUrl = "https://example.com/a1",
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = now.AddHours(-1),
            quizOpensAtUtc = now.AddDays(1),
            answersOpenAtUtc = now.AddDays(2)
        });
        Assert.Equal(HttpStatusCode.Created, lesson1.StatusCode);
        var openLesson = await lesson1.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options);

        // Lesson 2: not open yet at all (draft in the future).
        var lesson2 = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title = "Not open yet",
            orderIndex = 2,
            recordingUrl = "https://example.com/r2",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc = now.AddDays(3),
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        Assert.Equal(HttpStatusCode.Created, lesson2.StatusCode);

        var studentsResponse = await teacher.GetAsync("/api/teacher/students");
        var joinCode = (await studentsResponse.Content.ReadFromJsonAsync<JoinCodeEnvelope>(JsonDefaults.Options))!.JoinCode;

        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, studentEmail);
        var join = await student.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        return new Setup(student, teacherUserId, openLesson!.Id, studentEmail, "Password1");
    }

    [Fact]
    public async Task Unopened_quiz_has_no_quizUrl_key_in_the_raw_JSON()
    {
        var s = await ArrangeAsync("c1");

        var response = await s.Student.GetAsync($"/api/student/courses/{s.TeacherUserId}/lessons");
        var raw = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("quizUrl", raw);
        Assert.DoesNotContain("answersUrl", raw);
        // Sanity: the lesson itself IS in the payload — this isn't passing because the list is empty.
        Assert.Contains("Open lesson, quiz not yet", raw);
    }

    [Fact]
    public async Task Unopened_lesson_is_absent_from_the_list_and_404_by_id()
    {
        var s = await ArrangeAsync("c2");

        var list = await s.Student.GetAsync($"/api/student/courses/{s.TeacherUserId}/lessons");
        var listBody = await list.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Not open yet", listBody);

        var byIdResponse = await s.Student.GetAsync($"/api/student/courses/{s.TeacherUserId}/lessons/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, byIdResponse.StatusCode);
    }

    [Fact]
    public async Task Advancing_the_clock_reveals_the_quiz_and_the_not_yet_open_lesson()
    {
        var s = await ArrangeAsync("c3");
        _factory.Clock.Advance(TimeSpan.FromDays(4));
        try
        {
            // The auth cookie's 8-hour sliding window also reads this clock — a real student would
            // have signed back in over a four-day gap, so the test does the same.
            var refreshedStudent = await TestAuth.SignedInClientAsync(_factory, s.StudentEmail, s.StudentPassword);
            var response = await refreshedStudent.GetAsync($"/api/student/courses/{s.TeacherUserId}/lessons");
            var raw = await response.Content.ReadAsStringAsync();

            Assert.Contains("quizUrl", raw);
            Assert.Contains("answersUrl", raw);
            Assert.Contains("Not open yet", raw);
        }
        finally
        {
            _factory.Clock.Advance(TimeSpan.FromDays(-4));
        }
    }

    [Fact]
    public async Task Answers_open_independently_of_the_quiz()
    {
        var s = await ArrangeAsync("c4");

        // At t+1 day: quiz opens exactly now, answers (t+2 days) still don't.
        _factory.Clock.Advance(TimeSpan.FromDays(1));
        try
        {
            var refreshedStudent = await TestAuth.SignedInClientAsync(_factory, s.StudentEmail, s.StudentPassword);
            var response = await refreshedStudent.GetAsync($"/api/student/courses/{s.TeacherUserId}/lessons");
            var raw = await response.Content.ReadAsStringAsync();

            Assert.Contains("quizUrl", raw);
            Assert.DoesNotContain("answersUrl", raw);
        }
        finally
        {
            _factory.Clock.Advance(TimeSpan.FromDays(-1));
        }
    }

    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record JoinCodeEnvelope(string JoinCode);
    private record LessonRow(Guid Id);
}
