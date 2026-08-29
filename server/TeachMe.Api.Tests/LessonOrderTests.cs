using System.Net;
using System.Net.Http.Json;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Suite J — the order of a course, and the walk down it.
///
/// OrderIndex carries a unique index per teacher, so a swap is the one write in the app that
/// cannot be done in a single statement. It is also the one write the lessons screen makes while
/// holding only part of the list, which is why the endpoint takes a lesson and a direction rather
/// than an ordering: the screen cannot state an ordering it has not scrolled to.
/// </summary>
public class LessonOrderTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public LessonOrderTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Moving_a_lesson_down_swaps_it_with_the_one_below()
    {
        var teacher = await ApprovedTeacherAsync("order.down.j1@test.local");
        var first = await CreateLessonAsync(teacher, "First", 1);
        var second = await CreateLessonAsync(teacher, "Second", 2);
        var third = await CreateLessonAsync(teacher, "Third", 3);

        var response = await teacher.PutAsJsonAsync($"/api/teacher/lessons/{first}/move", new { up = false });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([second, first, third], await OrderAsync(teacher));
    }

    [Fact]
    public async Task Moving_a_lesson_up_swaps_it_with_the_one_above()
    {
        var teacher = await ApprovedTeacherAsync("order.up.j2@test.local");
        var first = await CreateLessonAsync(teacher, "First", 1);
        var second = await CreateLessonAsync(teacher, "Second", 2);

        var response = await teacher.PutAsJsonAsync($"/api/teacher/lessons/{second}/move", new { up = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([second, first], await OrderAsync(teacher));
    }

    /// <summary>
    /// The arrow at the top of the list is drawn disabled, but a keyboard, a stale tab, or a
    /// second window can press it anyway. Nothing to swap with is nothing to do — not an error to
    /// put in front of a teacher who did not do anything wrong.
    /// </summary>
    [Fact]
    public async Task Moving_the_first_lesson_up_changes_nothing_and_is_not_an_error()
    {
        var teacher = await ApprovedTeacherAsync("order.edge.j3@test.local");
        var first = await CreateLessonAsync(teacher, "First", 1);
        var second = await CreateLessonAsync(teacher, "Second", 2);

        var response = await teacher.PutAsJsonAsync($"/api/teacher/lessons/{first}/move", new { up = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([first, second], await OrderAsync(teacher));
    }

    /// <summary>The swap parks one row on a negative index to get past the unique constraint. If
    /// that ever leaked, a second swap of the same pair would collide — so the pair is swapped
    /// back, which is the case that would fail.</summary>
    [Fact]
    public async Task A_pair_can_be_swapped_back_and_forth()
    {
        var teacher = await ApprovedTeacherAsync("order.twice.j4@test.local");
        var first = await CreateLessonAsync(teacher, "First", 1);
        var second = await CreateLessonAsync(teacher, "Second", 2);

        await teacher.PutAsJsonAsync($"/api/teacher/lessons/{first}/move", new { up = false });
        var back = await teacher.PutAsJsonAsync($"/api/teacher/lessons/{first}/move", new { up = true });

        Assert.Equal(HttpStatusCode.NoContent, back.StatusCode);
        Assert.Equal([first, second], await OrderAsync(teacher));
    }

    [Fact]
    public async Task A_teacher_cannot_reorder_another_teachers_course()
    {
        var mine = await ApprovedTeacherAsync("order.mine.j5@test.local");
        var theirs = await ApprovedTeacherAsync("order.theirs.j5@test.local");
        await CreateLessonAsync(theirs, "Theirs first", 1);
        var theirSecond = await CreateLessonAsync(theirs, "Theirs second", 2);

        var response = await mine.PutAsJsonAsync($"/api/teacher/lessons/{theirSecond}/move", new { up = true });

        // 404 rather than 403: a lesson the caller does not own is a lesson that does not exist.
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// The cursor down a course is its OrderIndex. Walking it one lesson at a time has to arrive
    /// at the same sequence as asking for the lot — including after a swap has moved two of them.
    /// </summary>
    [Fact]
    public async Task Walking_a_course_by_cursor_matches_the_whole_list()
    {
        var teacher = await ApprovedTeacherAsync("order.walk.j6@test.local");
        var first = await CreateLessonAsync(teacher, "First", 1);
        var second = await CreateLessonAsync(teacher, "Second", 2);
        await CreateLessonAsync(teacher, "Third", 3);
        await CreateLessonAsync(teacher, "Fourth", 4);

        await teacher.PutAsJsonAsync($"/api/teacher/lessons/{first}/move", new { up = false });

        var whole = await OrderAsync(teacher);
        Assert.Equal(second, whole[0]);

        var walked = new List<Guid>();
        string? cursor = null;
        do
        {
            var url = cursor is null
                ? "/api/teacher/lessons?limit=1"
                : $"/api/teacher/lessons?limit=1&cursor={Uri.EscapeDataString(cursor)}";
            var slice = await teacher.GetFromJsonAsync<PagedLessons>(url, JsonDefaults.Options);

            walked.AddRange(slice!.Items.Select(l => l.Id));
            cursor = slice.NextCursor;
        }
        while (cursor is not null);

        Assert.Equal(whole, walked);
    }

    private async Task<HttpClient> ApprovedTeacherAsync(string email)
    {
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, email);
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var pending = await admin.GetFromJsonAsync<PagedTeachers>("/api/admin/teachers?status=Pending&limit=200", JsonDefaults.Options);
        var teacherUserId = pending!.Items.First(t => t.Email == email).UserId;
        await admin.PostAsync($"/api/admin/teachers/{teacherUserId}/approve", null);

        return teacher;
    }

    private static async Task<List<Guid>> OrderAsync(HttpClient teacher)
    {
        var page = await teacher.GetFromJsonAsync<PagedLessons>("/api/teacher/lessons?limit=100", JsonDefaults.Options);
        return page!.Items.Select(l => l.Id).ToList();
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

    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record PagedLessons(List<LessonRow> Items, string? NextCursor);
    private record LessonRow(Guid Id);
}
