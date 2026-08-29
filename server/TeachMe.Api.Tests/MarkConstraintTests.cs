using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>Suite B — the mark constraints that only a real unique index and a real check can prove.</summary>
public class MarkConstraintTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public MarkConstraintTests(ApiFactory factory) => _factory = factory;

    private record Setup(HttpClient Teacher, HttpClient Student, Guid StudentUserId, Guid LessonId, int QuizMaxScore);

    private async Task<Setup> ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync(string suffix, int quizMaxScore = 20, int passMark = 10)
    {
        var teacherEmail = $"markteacher.{suffix}@test.local";
        var studentEmail = $"markstudent.{suffix}@test.local";

        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, teacherEmail);
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var listResponse = await admin.GetAsync("/api/admin/teachers?status=Pending&pageSize=200");
        var pending = await listResponse.Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
        var teacherUserId = pending!.Items.First(t => t.Email == teacherEmail).UserId;
        await admin.PostAsync($"/api/admin/teachers/{teacherUserId}/approve", null);

        var studentsResponse = await teacher.GetAsync("/api/teacher/students");
        var studentsBody = await studentsResponse.Content.ReadFromJsonAsync<JoinCodeEnvelope>(JsonDefaults.Options);
        var joinCode = studentsBody!.JoinCode;

        var lessonRequest = new
        {
            title = "Mark test lesson",
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = "https://example.com/q",
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore,
            passMark,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        };
        var lessonResponse = await teacher.PostAsJsonAsync("/api/teacher/lessons", lessonRequest);
        Assert.Equal(HttpStatusCode.Created, lessonResponse.StatusCode);
        var lesson = await lessonResponse.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options);

        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, studentEmail);
        var meResponse = await student.GetAsync("/api/me");
        var me = await meResponse.Content.ReadFromJsonAsync<MeRow>(JsonDefaults.Options);

        var join = await student.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        return new Setup(teacher, student, me!.UserId, lesson!.Id, quizMaxScore);
    }

    [Fact]
    public async Task Second_mark_on_the_same_lesson_is_refused_with_409()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b1");

        var first = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = 5 });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = 6 });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Score_equal_to_max_is_accepted()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b2");

        var response = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = s.QuizMaxScore });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Score_above_max_is_refused_with_400()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b3");

        var response = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = s.QuizMaxScore + 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Negative_score_is_refused_with_400()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b4");

        var response = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_bound_follows_when_the_lessons_maximum_changes()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b5", quizMaxScore: 20);

        // A score of 15 is fine against a max of 20...
        var okBefore = await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.LessonId, studentUserId = s.StudentUserId, score = 15 });
        Assert.Equal(HttpStatusCode.Created, okBefore.StatusCode);

        var newMark = await okBefore.Content.ReadFromJsonAsync<MarkRow>(JsonDefaults.Options);

        // Shrink the lesson's maximum to 10 — the already-recorded 15 is now out of range for a NEW mark bound check.
        var editLesson = new
        {
            title = "Mark test lesson",
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = "https://example.com/q",
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 10,
            passMark = 5,
            opensAtUtc = (DateTimeOffset?)null,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        };
        var editResponse = await s.Teacher.PutAsJsonAsync($"/api/teacher/lessons/{s.LessonId}", editLesson);
        Assert.Equal(HttpStatusCode.OK, editResponse.StatusCode);

        // A correction attempting 15 against the new mark's own PUT should now be refused — the bound is read from the lesson.
        var correction = await s.Teacher.PutAsJsonAsync($"/api/teacher/marks/{newMark!.Id}", new { score = 15 });
        Assert.Equal(HttpStatusCode.BadRequest, correction.StatusCode);

        var body = await correction.Content.ReadAsStringAsync();
        Assert.Contains("10", body);
    }

    [Fact]
    public async Task Passed_sent_by_the_client_is_ignored_and_derived_from_score()
    {
        var s = await ArrangeApprovedTeacherWithEnrolledStudentAndLessonAsync("b6", quizMaxScore: 20, passMark: 10);

        // The wire DTO has no "passed" field at all, so a client trying to smuggle one in is simply
        // extra JSON the server never binds to anything — assert the raw request still produces a
        // server-derived "passed" that matches the score, not whatever the client claimed.
        var payload = JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["lessonId"] = s.LessonId,
            ["studentUserId"] = s.StudentUserId,
            ["score"] = 3, // below passMark of 10 — should derive to failed
            ["passed"] = true // client lies
        });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        var response = await s.Teacher.PostAsync("/api/teacher/marks", content);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var mark = await response.Content.ReadFromJsonAsync<MarkRow>(JsonDefaults.Options);
        Assert.False(mark!.Passed);
    }

    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record JoinCodeEnvelope(string JoinCode);
    private record LessonRow(Guid Id);
    private record MeRow(Guid UserId);
    private record MarkRow(Guid Id, bool Passed);
}
