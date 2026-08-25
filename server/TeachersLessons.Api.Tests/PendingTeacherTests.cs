using System.Net;
using System.Net.Http.Json;
using TeachersLessons.Api.Tests.TestSupport;
using Xunit;

namespace TeachersLessons.Api.Tests;

/// <summary>Suite A — a teacher's every route is scoped by their approval status, read fresh per call.</summary>
public class PendingTeacherTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public PendingTeacherTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Pending_teacher_is_refused_every_teacher_route()
    {
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "pending.a@test.local");

        var response = await teacher.GetAsync("/api/teacher/lessons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Rejected_teacher_is_refused_every_teacher_route()
    {
        var email = "rejected.a@test.local";
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, email);
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var userId = await GetTeacherUserId(admin, email);
        var reject = await admin.PostAsync($"/api/admin/teachers/{userId}/reject", null);
        Assert.Equal(HttpStatusCode.NoContent, reject.StatusCode);

        var response = await teacher.GetAsync("/api/teacher/lessons");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Approved_teacher_is_let_through()
    {
        var email = "approved.a@test.local";
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, email);
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var userId = await GetTeacherUserId(admin, email);
        var approve = await admin.PostAsync($"/api/admin/teachers/{userId}/approve", null);
        Assert.Equal(HttpStatusCode.NoContent, approve.StatusCode);

        var response = await teacher.GetAsync("/api/teacher/lessons");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Approval_mid_session_takes_effect_on_the_next_call_without_re_login()
    {
        var email = "midsession.a@test.local";
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, email);
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var userId = await GetTeacherUserId(admin, email);

        var before = await teacher.GetAsync("/api/teacher/lessons");
        Assert.Equal(HttpStatusCode.Forbidden, before.StatusCode);

        var approve = await admin.PostAsync($"/api/admin/teachers/{userId}/approve", null);
        Assert.Equal(HttpStatusCode.NoContent, approve.StatusCode);

        // Same client, same cookie — no re-login. The policy handler reads Teachers.Status fresh.
        var after = await teacher.GetAsync("/api/teacher/lessons");
        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
    }

    private static async Task<Guid> GetTeacherUserId(HttpClient admin, string email)
    {
        var response = await admin.GetAsync("/api/admin/teachers?status=Pending&pageSize=100");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PagedTeachers>(JsonDefaults.Options);
        var match = body!.Items.First(t => t.Email == email);
        return match.UserId;
    }

    private record PagedTeachers(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
}
