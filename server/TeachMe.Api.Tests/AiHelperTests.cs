using System.Net;
using System.Net.Http.Json;
using TeachMe.Api.Features.Helper.Services;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Suite G — the AI helper answers from the asking student's own data, and never from anyone
/// else's. The leak tests (G1–G3) assert on the serialized context pack itself rather than on the
/// answer, because a missing property and a null property deserialize identically and the
/// difference between them is the whole requirement. The rest assert the ladder: every failure
/// path lands on the phrase list, and none of them is a 5xx.
/// </summary>
public class AiHelperTests : IClassFixture<AiApiFactory>
{
    private readonly AiApiFactory _factory;

    public AiHelperTests(AiApiFactory factory) => _factory = factory;

    private record Setup(HttpClient Student, Guid TeacherUserId, Guid OpenLessonId, HttpClient Teacher, Guid StudentUserId);

    /// <summary>
    /// One teacher, two lessons — one open, one still in the future — and one enrolled student.
    /// Mirrors Suite C's arrangement so the two suites read side by side.
    /// </summary>
    private Task<Setup> ArrangeAsync(string suffix) => ArrangeAsync(_factory, suffix);

    private static async Task<Setup> ArrangeAsync(ApiFactory factory, string suffix)
    {
        var now = factory.Clock.GetUtcNow();
        var teacherEmail = $"aiteacher.{suffix}@test.local";
        var studentEmail = $"aistudent.{suffix}@test.local";

        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(factory, teacherEmail, "Amal Hassan");
        var admin = await TestAuth.SignedInAdminAsync(factory);
        var pending = await (await admin.GetAsync("/api/admin/teachers?status=Pending&limit=200"))
            .Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
        var teacherUserId = pending!.Items.First(t => t.Email == teacherEmail).UserId;
        await admin.PostAsync($"/api/admin/teachers/{teacherUserId}/approve", null);

        var openLesson = await CreateLessonAsync(teacher, "Vectors, part one", 1, now.AddHours(-1), now.AddDays(1), now.AddDays(2));
        await CreateLessonAsync(teacher, "Matrices, not open yet", 2, now.AddDays(3), null, null);

        var joinCode = (await (await teacher.GetAsync("/api/teacher/students"))
            .Content.ReadFromJsonAsync<TeacherStudents>(JsonDefaults.Options))!.JoinCode;

        var student = await TestAuth.RegisterAndSignInStudentAsync(factory, studentEmail, "Sara Nabil");
        var join = await student.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });
        Assert.Equal(HttpStatusCode.Created, join.StatusCode);

        var studentUserId = (await (await teacher.GetAsync("/api/teacher/students"))
            .Content.ReadFromJsonAsync<TeacherStudents>(JsonDefaults.Options))!
            .Students.Items.First(s => s.Email == studentEmail).UserId;

        return new Setup(student, teacherUserId, openLesson, teacher, studentUserId);
    }

    private static async Task<Guid> CreateLessonAsync(
        HttpClient teacher, string title, int order,
        DateTimeOffset? opensAt, DateTimeOffset? quizOpensAt, DateTimeOffset? answersOpenAt)
    {
        var response = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title,
            orderIndex = order,
            recordingUrl = $"https://example.com/recording-{order}",
            handoutUrl = $"https://example.com/handout-{order}",
            quizUrl = "https://example.com/quiz",
            answersUrl = "https://example.com/answers",
            durationMinutes = 30,
            quizMaxScore = 10,
            passMark = 5,
            opensAtUtc = opensAt,
            quizOpensAtUtc = quizOpensAt,
            answersOpenAtUtc = answersOpenAt
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options))!.Id;
    }

    private static async Task<HelperAnswer> AskAsync(HttpClient student, string question)
    {
        var response = await student.GetAsync($"/api/helper/ask?q={Uri.EscapeDataString(question)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HelperAnswer>(JsonDefaults.Options))!;
    }

    // ---- G1-G3: what the model is allowed to know ---------------------------

    [Fact]
    public async Task G1_the_pack_excludes_a_lesson_the_teacher_has_not_opened()
    {
        var s = await ArrangeAsync("g1");
        _factory.Model.Returns("Here you go.", "/student/courses");

        await AskAsync(s.Student, "what lessons do I have");

        var pack = _factory.Model.LastPackJson!;
        Assert.Contains("Vectors, part one", pack);
        Assert.DoesNotContain("Matrices, not open yet", pack);
    }

    [Fact]
    public async Task G2_an_unopened_quiz_is_a_false_flag_and_the_pack_carries_no_url()
    {
        var s = await ArrangeAsync("g2");
        _factory.Model.Returns("Here you go.", null);

        await AskAsync(s.Student, "is my quiz open");

        var pack = _factory.Model.LastPackJson!;
        Assert.Contains("\"quizOpen\":false", pack);
        Assert.Contains("\"answersOpen\":false", pack);
        // The model answers *where*, never *here is the link* — so a successful injection has
        // nothing to exfiltrate.
        Assert.DoesNotContain("http", pack);
    }

    [Fact]
    public async Task G3_one_students_pack_never_mentions_another()
    {
        var s = await ArrangeAsync("g3");

        // A second student on the same course, graded on the same lesson.
        var otherEmail = "aiother.g3@test.local";
        var other = await TestAuth.RegisterAndSignInStudentAsync(_factory, otherEmail, "Bassem Farouk");
        var joinCode = (await (await s.Teacher.GetAsync("/api/teacher/students"))
            .Content.ReadFromJsonAsync<TeacherStudents>(JsonDefaults.Options))!.JoinCode;
        await other.PostAsJsonAsync("/api/student/enrollments", new { code = joinCode });

        var otherUserId = (await (await s.Teacher.GetAsync("/api/teacher/students"))
            .Content.ReadFromJsonAsync<TeacherStudents>(JsonDefaults.Options))!
            .Students.Items.First(x => x.Email == otherEmail).UserId;

        await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.OpenLessonId, studentUserId = otherUserId, score = 9 });
        await s.Teacher.PostAsJsonAsync("/api/teacher/marks", new { lessonId = s.OpenLessonId, studentUserId = s.StudentUserId, score = 7 });

        _factory.Model.Returns("Here you go.", "/student/marks");
        await AskAsync(s.Student, "how did I do");

        var pack = _factory.Model.LastPackJson!;
        Assert.Contains("\"myScore\":7", pack);
        Assert.DoesNotContain("Bassem Farouk", pack);
        Assert.DoesNotContain(otherUserId.ToString(), pack);
        Assert.DoesNotContain("\"myScore\":9", pack);
    }

    // ---- G4-G6, G12: the degradation ladder ---------------------------------

    [Fact]
    public async Task G4_with_no_key_configured_the_response_is_the_phrase_lists_own()
    {
        var s = await ArrangeAsync("g4");

        // The same question, from the same arrangement, against an app with no Ai:ApiKey at all —
        // the production rollback.
        var plain = new NoAiApiFactory();
        await ((IAsyncLifetime)plain).InitializeAsync();
        try
        {
            var withoutAiSetup = await ArrangeAsync(plain, "g4plain");
            var withoutAi = await (await withoutAiSetup.Student.GetAsync("/api/helper/ask?q=where%20are%20my%20results"))
                .Content.ReadAsStringAsync();

            _factory.Model.Reset();   // the model cannot answer, so the same fallback runs
            var withAi = await (await s.Student.GetAsync("/api/helper/ask?q=where%20are%20my%20results"))
                .Content.ReadAsStringAsync();

            Assert.Equal(withoutAi, withAi);
        }
        finally
        {
            await ((IAsyncLifetime)plain).DisposeAsync();
        }
    }

    [Fact]
    public async Task G5_a_model_that_throws_is_a_200_with_the_phrase_list_answer()
    {
        var s = await ArrangeAsync("g5");
        _factory.Model.Reset((_, _, _) => throw new InvalidOperationException("the vendor fell over"));

        var response = await s.Student.GetAsync("/api/helper/ask?q=where%20are%20my%20results");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var answer = (await response.Content.ReadFromJsonAsync<HelperAnswer>(JsonDefaults.Options))!;
        Assert.Equal("Your marks for every lesson you've been graded on are here.", answer.Answer);
        Assert.Equal("/student/marks", answer.Route);
    }

    [Fact]
    public async Task G6_a_model_that_never_returns_times_out_into_the_phrase_list()
    {
        var s = await ArrangeAsync("g6");
        _factory.Model.Reset(async (_, _, ct) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30), ct);   // past Ai:TimeoutSeconds = 1
            return new ModelAnswer("Too late.", null, false);
        });

        var response = await s.Student.GetAsync("/api/helper/ask?q=where%20are%20my%20results");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var answer = (await response.Content.ReadFromJsonAsync<HelperAnswer>(JsonDefaults.Options))!;
        Assert.Equal("Your marks for every lesson you've been graded on are here.", answer.Answer);
    }

    [Fact]
    public async Task G12_unparseable_model_output_becomes_a_null_answer_not_an_exception()
    {
        // The parse boundary itself: a schema is a request, not a guarantee.
        Assert.Null(GeminiAnswerModel.ParseAnswer("{\"answer\": \"half a sen"));
        Assert.Null(GeminiAnswerModel.ParseAnswer("I'm afraid I can't do that."));
        Assert.Null(GeminiAnswerModel.ParseAnswer(""));

        // And what the helper does with that null.
        var s = await ArrangeAsync("g12");
        _factory.Model.Reset();

        var answer = await AskAsync(s.Student, "where are my results");
        Assert.Equal("Your marks for every lesson you've been graded on are here.", answer.Answer);
    }

    [Fact]
    public async Task G12b_a_model_that_says_it_does_not_know_falls_through_to_the_topic_list()
    {
        var s = await ArrangeAsync("g12b");
        _factory.Model.Returns("I don't have that.", null, unknown: true);

        var answer = await AskAsync(s.Student, "zzzqqq nothing matches this at all");

        Assert.True(answer.Unknown);
        Assert.NotNull(answer.KnownTopics);
        Assert.NotEmpty(answer.KnownTopics!);
    }

    // ---- G7-G9: the model suggests, the server decides -----------------------

    [Fact]
    public async Task G7_a_route_outside_the_allowlist_is_dropped_and_the_answer_survives()
    {
        var s = await ArrangeAsync("g7");
        _factory.Model.Returns("You can see everything from the approvals screen.", "/admin/approvals");

        var answer = await AskAsync(s.Student, "where do I approve teachers");

        Assert.Null(answer.Route);
        Assert.Equal("You can see everything from the approvals screen.", answer.Answer);
        Assert.False(answer.Unknown);
    }

    [Fact]
    public async Task G8_a_course_route_for_someone_elses_teacher_is_rejected()
    {
        var s = await ArrangeAsync("g8");

        // Shaped exactly like a valid deep route — only the guid is wrong, which is why the check
        // is against the pack and not a regex.
        _factory.Model.Returns("Open that course.", $"/student/courses/{Guid.NewGuid()}");
        Assert.Null((await AskAsync(s.Student, "open my course")).Route);

        // The student's own teacher, on the other hand, is allowed through.
        _factory.Model.Returns("Open that course.", $"/student/courses/{s.TeacherUserId}");
        Assert.Equal($"/student/courses/{s.TeacherUserId}", (await AskAsync(s.Student, "open my course")).Route);
    }

    [Fact]
    public async Task G9_a_student_on_no_courses_is_sent_to_join_whatever_the_model_suggested()
    {
        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, "ainocourse.g9@test.local");
        _factory.Model.Returns("Your marks are here.", "/student/marks");

        var answer = await AskAsync(student, "where are my results");

        Assert.Equal("/student/join", answer.Route);
        Assert.Contains("joining code", answer.Answer!);
    }

    // ---- G10, G11: the caps -------------------------------------------------

    [Fact]
    public async Task G10_an_over_long_question_is_a_400_and_never_reaches_the_model()
    {
        var s = await ArrangeAsync("g10");
        _factory.Model.Returns("Should never be asked.", null);

        var response = await s.Student.GetAsync($"/api/helper/ask?q={new string('a', 400)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _factory.Model.Invocations);
    }

    [Fact]
    public async Task G11_the_seventh_question_in_a_minute_answers_from_the_phrase_list()
    {
        var s = await ArrangeAsync("g11");
        _factory.Model.Returns("A grounded answer.", null);

        for (var i = 0; i < 6; i++)
        {
            Assert.Equal("A grounded answer.", (await AskAsync(s.Student, "where are my results")).Answer);
        }

        var invocationsBefore = _factory.Model.Invocations;
        var seventh = await AskAsync(s.Student, "where are my results");

        Assert.Equal("Your marks for every lesson you've been graded on are here.", seventh.Answer);
        Assert.Equal(invocationsBefore, _factory.Model.Invocations);
    }

    private record HelperAnswer(string? Answer, string? Route, bool Unknown, List<string>? KnownTopics);
    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record LessonRow(Guid Id);
    private record TeacherStudents(string JoinCode, PagedStudents Students);
    private record PagedStudents(List<StudentRow> Items);
    private record StudentRow(Guid UserId, string Email);
}
