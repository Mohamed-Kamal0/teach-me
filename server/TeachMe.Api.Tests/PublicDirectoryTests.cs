using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using TeachMe.Api.Tests.TestSupport;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Suite F — the public teacher directory. It is the first read path in the app that answers
/// someone with no session, so most of what is asserted here is about what it does *not* say.
/// </summary>
public class PublicDirectoryTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public PublicDirectoryTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Directory_is_reachable_without_a_session()
    {
        var anon = _factory.CreateClient();

        var response = await anon.GetAsync("/api/public/teachers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Directory_lists_only_approved_teachers()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.approved.f2@test.local", "Approved Amina");
        await ApproveAsync(admin, "dir.approved.f2@test.local");

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.pending.f2@test.local", "Pending Peter");

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.rejected.f2@test.local", "Rejected Rania");
        await RejectAsync(admin, "dir.rejected.f2@test.local");

        var anon = _factory.CreateClient();
        var page = await anon.GetFromJsonAsync<PagedTeachers>("/api/public/teachers?limit=100", JsonDefaults.Options);
        var names = page!.Items.Select(t => t.FullName).ToList();

        Assert.Contains("Approved Amina", names);
        Assert.DoesNotContain("Pending Peter", names);
        Assert.DoesNotContain("Rejected Rania", names);
    }

    [Fact]
    public async Task Directory_never_carries_an_email_or_a_join_code()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.leak.f3@test.local", "Leak Check");
        await ApproveAsync(admin, "dir.leak.f3@test.local");

        // The teacher's own screen is where the join code lives; the directory must not repeat it.
        var students = await teacher.GetFromJsonAsync<JoinCodeEnvelope>("/api/teacher/students", JsonDefaults.Options);

        var anon = _factory.CreateClient();
        var body = await anon.GetStringAsync("/api/public/teachers?limit=100");

        Assert.Contains("Leak Check", body);
        Assert.DoesNotContain("dir.leak.f3@test.local", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(students!.JoinCode, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("joinCode", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Open_lesson_count_follows_the_clock()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.clock.f4@test.local", "Clock Watcher");
        var teacherId = await ApproveAsync(admin, "dir.clock.f4@test.local");

        var opensAt = _factory.Clock.GetUtcNow().AddDays(1);
        await CreateLessonAsync(teacher, "Scheduled lesson", opensAt);

        var anon = _factory.CreateClient();

        var before = await FindAsync(anon, teacherId);
        Assert.Equal(0, before.OpenLessonCount);
        // The lesson exists either way — only its opening is in the future.
        Assert.Equal(1, before.PublishedLessonCount);

        _factory.Clock.Advance(TimeSpan.FromDays(2));

        var after = await FindAsync(anon, teacherId);
        Assert.Equal(1, after.OpenLessonCount);
    }

    [Fact]
    public async Task Statistics_are_scoped_to_each_teacher()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var teacherA = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.scopeA.f5@test.local", "Scope A");
        var teacherAId = await ApproveAsync(admin, "dir.scopeA.f5@test.local");
        var teacherB = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.scopeB.f5@test.local", "Scope B");
        var teacherBId = await ApproveAsync(admin, "dir.scopeB.f5@test.local");

        var openedAt = _factory.Clock.GetUtcNow().AddHours(-1);
        var lessonA = await CreateLessonAsync(teacherA, "Lesson from A", openedAt);
        var lessonB = await CreateLessonAsync(teacherB, "Lesson from B", openedAt);

        var codeA = (await teacherA.GetFromJsonAsync<JoinCodeEnvelope>("/api/teacher/students", JsonDefaults.Options))!.JoinCode;
        var codeB = (await teacherB.GetFromJsonAsync<JoinCodeEnvelope>("/api/teacher/students", JsonDefaults.Options))!.JoinCode;

        // One student on both courses: their marks must land on one teacher's card each.
        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, "dir.shared.f5@test.local");
        await student.PostAsJsonAsync("/api/student/enrollments", new { code = codeA });
        await student.PostAsJsonAsync("/api/student/enrollments", new { code = codeB });
        var studentId = (await student.GetFromJsonAsync<MeRow>("/api/me", JsonDefaults.Options))!.UserId;

        // Passed with A (pass mark 10), failed with B.
        await teacherA.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lessonA, studentUserId = studentId, score = 18 });
        await teacherB.PostAsJsonAsync("/api/teacher/marks", new { lessonId = lessonB, studentUserId = studentId, score = 3 });

        var anon = _factory.CreateClient();
        var cardA = await FindAsync(anon, teacherAId);
        var cardB = await FindAsync(anon, teacherBId);

        Assert.Equal(1, cardA.StudentCount);
        Assert.Equal(1, cardA.MarkCount);
        Assert.Equal(1, cardA.PassedMarkCount);

        Assert.Equal(1, cardB.StudentCount);
        Assert.Equal(1, cardB.MarkCount);
        Assert.Equal(0, cardB.PassedMarkCount);
    }

    [Fact]
    public async Task Search_matches_a_name_or_a_subject()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.byName.f8@test.local", "Hypatia Alexandria", subject: "Astronomy");
        await ApproveAsync(admin, "dir.byName.f8@test.local");

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.bySubject.f8@test.local", "Rosalind Franklin", subject: "Molecular Astronomy");
        await ApproveAsync(admin, "dir.bySubject.f8@test.local");

        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.neither.f8@test.local", "Ada Lovelace", subject: "Computing");
        await ApproveAsync(admin, "dir.neither.f8@test.local");

        var anon = _factory.CreateClient();

        // A name the subject does not contain.
        var byName = await SearchAsync(anon, "Hypatia");
        Assert.Equal(["Hypatia Alexandria"], byName);

        // A subject neither name contains — and it must find *both* teachers who teach it,
        // which is the whole point of the second field.
        var bySubject = await SearchAsync(anon, "Astronomy");
        Assert.Contains("Hypatia Alexandria", bySubject);
        Assert.Contains("Rosalind Franklin", bySubject);
        Assert.DoesNotContain("Ada Lovelace", bySubject);

        // A substring inside the subject, not a prefix of it.
        Assert.Contains("Rosalind Franklin", await SearchAsync(anon, "Molecul"));

        Assert.Empty(await SearchAsync(anon, "Underwater Basket Weaving"));
    }

    [Fact]
    public async Task Search_never_reaches_a_teacher_who_is_not_approved()
    {
        // A pending teacher's subject is as unpublished as the rest of their row: searching for
        // it must not be the one query that confirms they registered.
        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.hidden.f9@test.local", "Waiting Wanda", subject: "Palaeography");

        var anon = _factory.CreateClient();

        Assert.Empty(await SearchAsync(anon, "Palaeography"));
    }

    [Fact]
    public async Task A_teacher_restates_their_subject_and_the_directory_follows()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.restate.f10@test.local", "Second Thoughts", subject: "Geograhpy");
        var teacherId = await ApproveAsync(admin, "dir.restate.f10@test.local");

        var fix = await teacher.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "Geography", phone = "+20 100 555 0199" });
        Assert.Equal(HttpStatusCode.NoContent, fix.StatusCode);

        var anon = _factory.CreateClient();
        Assert.Equal("Geography", (await FindAsync(anon, teacherId)).Subject);
        Assert.Empty(await SearchAsync(anon, "Geograhpy"));
        Assert.Contains("Second Thoughts", await SearchAsync(anon, "Geography"));
    }

    [Fact]
    public async Task A_teacher_restates_their_phone_and_reads_it_back_from_identity()
    {
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(
            _factory, "dir.phone.f13@test.local", "Ring Ring", subject: "Physics", phone: "+20 100 000 0001");

        Assert.Equal("+20 100 000 0001", (await teacher.GetFromJsonAsync<MeProfileRow>("/api/me", JsonDefaults.Options))!.Phone);

        var fix = await teacher.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "Physics", phone = "(202) 555-0143" });
        Assert.Equal(HttpStatusCode.NoContent, fix.StatusCode);

        var me = await teacher.GetFromJsonAsync<MeProfileRow>("/api/me", JsonDefaults.Options);
        Assert.Equal("(202) 555-0143", me!.Phone);
        Assert.Equal("Physics", me.Subject);
    }

    [Fact]
    public async Task A_course_card_carries_the_teachers_phone_number()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        await TestAuth.RegisterAndSignInTeacherAsync(
            _factory, "dir.phoneCard.f13@test.local", "Reachable Rana", phone: "+20 100 999 0007");
        var teacherId = await ApproveAsync(admin, "dir.phoneCard.f13@test.local");

        var anon = _factory.CreateClient();

        // Someone with no account can find the course and a way to ask about it.
        Assert.Equal("+20 100 999 0007", (await FindAsync(anon, teacherId)).Phone);
    }

    [Fact]
    public async Task A_phone_number_on_a_card_belongs_to_a_teacher_who_was_approved()
    {
        // A pending teacher's phone is as unpublished as the rest of their row: the card is a
        // published course, and they have not got one yet.
        await TestAuth.RegisterAndSignInTeacherAsync(
            _factory, "dir.phoneHidden.f13@test.local", "Waiting Wendy", phone: "+20 100 999 0008");

        var anon = _factory.CreateClient();
        var body = await anon.GetStringAsync("/api/public/teachers?limit=100");

        Assert.DoesNotContain("Waiting Wendy", body);
        Assert.DoesNotContain("999 0008", body);
    }

    [Fact]
    public async Task An_administrator_sees_a_phone_number_beside_the_teacher_awaiting_a_decision()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        await TestAuth.RegisterAndSignInTeacherAsync(
            _factory, "dir.phoneAdmin.f13@test.local", "Pending Percy", subject: "Latin", phone: "+20 111 222 3333");

        var page = await admin.GetFromJsonAsync<PagedAdminTeachers>("/api/admin/teachers?status=Pending&limit=100", JsonDefaults.Options);
        var row = page!.Items.Single(t => t.Email == "dir.phoneadmin.f13@test.local");

        Assert.Equal("+20 111 222 3333", row.Phone);
    }

    [Fact]
    public async Task A_blank_subject_is_refused_with_a_message_on_the_field()
    {
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.blank.f11@test.local", "Blank Slate");

        var response = await teacher.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "   ", phone = "+20 100 000 0000" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemRow>(JsonDefaults.Options);
        Assert.Equal("Enter the subject you teach.", problem!.Errors["subject"].Single());
    }

    [Fact]
    public async Task A_phone_number_that_is_blank_or_not_a_number_is_refused_on_its_own_field()
    {
        var teacher = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.badPhone.f13@test.local", "Butter Fingers");

        var blank = await teacher.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "Latin", phone = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);
        var blankProblem = await blank.Content.ReadFromJsonAsync<ProblemRow>(JsonDefaults.Options);
        Assert.Equal("Enter a phone number.", blankProblem!.Errors["phone"].Single());

        var letters = await teacher.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "Latin", phone = "call me" });
        Assert.Equal(HttpStatusCode.BadRequest, letters.StatusCode);
        var lettersProblem = await letters.Content.ReadFromJsonAsync<ProblemRow>(JsonDefaults.Options);
        Assert.Equal("Enter a phone number using digits, spaces, + - or ( ).", lettersProblem!.Errors["phone"].Single());
    }

    [Fact]
    public async Task Registration_refuses_a_teacher_who_gives_no_phone_number()
    {
        var anon = _factory.CreateClient();

        var response = await anon.PostAsJsonAsync("/api/auth/register/teacher", new
        {
            fullName = "No Number Nora",
            email = "dir.noPhone.f13@test.local",
            password = "Password1",
            subject = "Geology",
            phone = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemRow>(JsonDefaults.Options);
        Assert.Equal("Enter a phone number.", problem!.Errors["phone"].Single());
    }

    [Fact]
    public async Task Only_a_teacher_has_a_subject_to_state()
    {
        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, "dir.notTeacher.f12@test.local");

        var response = await student.PutAsJsonAsync("/api/me/teacher-profile", new { subject = "Mathematics", phone = "+20 100 000 0000" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_limit_past_the_cap_hands_back_at_most_a_hundred()
    {
        var anon = _factory.CreateClient();

        var page = await anon.GetFromJsonAsync<PagedTeachers>("/api/public/teachers?limit=5000", JsonDefaults.Options);

        Assert.True(page!.Items.Count <= 100, $"asked for 5000 and got {page.Items.Count}");
    }

    /// <summary>
    /// The property that matters about a scroll: walking it one row at a time reaches every
    /// teacher, and reaches each of them once. A cursor that repeated a row or skipped one would
    /// show up here as a count that disagrees with the single-request list.
    /// </summary>
    [Fact]
    public async Task Walking_the_directory_by_cursor_visits_every_teacher_exactly_once()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        foreach (var name in new[] { "Walk Aya", "Walk Basma", "Walk Carim" })
        {
            var email = $"dir.walk.{name.Split(' ')[1].ToLowerInvariant()}.f16@test.local";
            await TestAuth.RegisterAndSignInTeacherAsync(_factory, email, name);
            await ApproveAsync(admin, email);
        }

        var anon = _factory.CreateClient();
        var wholeList = await anon.GetFromJsonAsync<PagedTeachers>("/api/public/teachers?limit=100", JsonDefaults.Options);

        var walked = new List<Guid>();
        string? cursor = null;
        // A row at a time is the harshest version of the walk: every slice boundary is a cursor.
        do
        {
            var url = cursor is null
                ? "/api/public/teachers?limit=1"
                : $"/api/public/teachers?limit=1&cursor={Uri.EscapeDataString(cursor)}";
            var slice = await anon.GetFromJsonAsync<PagedTeachers>(url, JsonDefaults.Options);

            walked.AddRange(slice!.Items.Select(t => t.UserId));
            cursor = slice.NextCursor;
        }
        while (cursor is not null);

        Assert.Equal(wholeList!.Items.Select(t => t.UserId), walked);
        Assert.Equal(walked.Count, walked.Distinct().Count());
    }

    /// <summary>The total is the answer to "how many are there", not "how many are left", so it
    /// rides on the first slice and is absent from the rest rather than being recounted.</summary>
    [Fact]
    public async Task The_total_is_sent_once_at_the_head_of_the_walk()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);
        await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.total.f17@test.local", "Total Tarek");
        await ApproveAsync(admin, "dir.total.f17@test.local");

        var anon = _factory.CreateClient();
        var first = await anon.GetFromJsonAsync<PagedTeachers>("/api/public/teachers?limit=1", JsonDefaults.Options);

        Assert.NotNull(first!.Total);
        Assert.NotNull(first.NextCursor);

        var second = await anon.GetFromJsonAsync<PagedTeachers>(
            $"/api/public/teachers?limit=1&cursor={Uri.EscapeDataString(first.NextCursor!)}", JsonDefaults.Options);

        Assert.Null(second!.Total);
    }

    /// <summary>A cursor is opaque, and a hand-made one is a mistake worth naming — being quietly
    /// served the first slice again is how a caller ends up looping forever.</summary>
    [Theory]
    [InlineData("not-base64-%20at-all")]
    [InlineData("aGVsbG8")]
    public async Task A_cursor_we_never_issued_is_refused(string cursor)
    {
        var anon = _factory.CreateClient();

        var response = await anon.GetAsync($"/api/public/teachers?cursor={Uri.EscapeDataString(cursor)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Teacher_photo_is_public_only_for_approved_teachers()
    {
        var admin = await TestAuth.SignedInAdminAsync(_factory);

        var approved = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.photoOk.f7@test.local", "Photo Ok");
        var approvedId = await ApproveAsync(admin, "dir.photoOk.f7@test.local");
        await approved.PutAsync("/api/me/photo", PngUpload());

        var pending = await TestAuth.RegisterAndSignInTeacherAsync(_factory, "dir.photoPending.f7@test.local", "Photo Pending");
        var pendingId = (await pending.GetFromJsonAsync<MeRow>("/api/me", JsonDefaults.Options))!.UserId;
        await pending.PutAsync("/api/me/photo", PngUpload());

        var student = await TestAuth.RegisterAndSignInStudentAsync(_factory, "dir.photoStudent.f7@test.local");
        var studentId = (await student.GetFromJsonAsync<MeRow>("/api/me", JsonDefaults.Options))!.UserId;
        await student.PutAsync("/api/me/photo", PngUpload());

        var anon = _factory.CreateClient();

        var ok = await anon.GetAsync($"/api/public/teachers/{approvedId}/photo");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal("image/webp", ok.Content.Headers.ContentType!.MediaType);
        // A directory photo is fine in a shared cache; a student's is not.
        Assert.True(ok.Headers.CacheControl!.Public);

        // Approval is not a public record, so a pending teacher's photo is not a public photo.
        Assert.Equal(HttpStatusCode.NotFound, (await anon.GetAsync($"/api/public/teachers/{pendingId}/photo")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anon.GetAsync($"/api/public/teachers/{studentId}/photo")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anon.GetAsync($"/api/public/teachers/{Guid.NewGuid()}/photo")).StatusCode);
    }

    // ---- helpers ---------------------------------------------------------

    private static async Task<Guid> ApproveAsync(HttpClient admin, string email)
    {
        var userId = await PendingIdAsync(admin, email);
        await admin.PostAsync($"/api/admin/teachers/{userId}/approve", null);
        return userId;
    }

    private static async Task RejectAsync(HttpClient admin, string email)
    {
        var userId = await PendingIdAsync(admin, email);
        await admin.PostAsync($"/api/admin/teachers/{userId}/reject", null);
    }

    private static async Task<Guid> PendingIdAsync(HttpClient admin, string email)
    {
        var pending = await admin.GetFromJsonAsync<PagedTeacherRows>("/api/admin/teachers?status=Pending&limit=200", JsonDefaults.Options);
        // Registration normalises email to lowercase — match the same way here.
        return pending!.Items.First(t => string.Equals(t.Email, email, StringComparison.OrdinalIgnoreCase)).UserId;
    }

    private static async Task<Guid> CreateLessonAsync(HttpClient teacher, string title, DateTimeOffset? opensAtUtc)
    {
        var response = await teacher.PostAsJsonAsync("/api/teacher/lessons", new
        {
            title,
            orderIndex = 1,
            recordingUrl = "https://example.com/r",
            handoutUrl = (string?)null,
            quizUrl = (string?)null,
            answersUrl = (string?)null,
            durationMinutes = 30,
            quizMaxScore = 20,
            passMark = 10,
            opensAtUtc,
            quizOpensAtUtc = (DateTimeOffset?)null,
            answersOpenAtUtc = (DateTimeOffset?)null
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LessonRow>(JsonDefaults.Options))!.Id;
    }

    private static async Task<List<string>> SearchAsync(HttpClient anon, string term)
    {
        var page = await anon.GetFromJsonAsync<PagedTeachers>(
            $"/api/public/teachers?limit=100&q={Uri.EscapeDataString(term)}", JsonDefaults.Options);
        return page!.Items.Select(t => t.FullName).ToList();
    }

    private static async Task<PublicTeacherRow> FindAsync(HttpClient anon, Guid teacherId)
    {
        var page = await anon.GetFromJsonAsync<PagedTeachers>("/api/public/teachers?limit=100", JsonDefaults.Options);
        return page!.Items.Single(t => t.UserId == teacherId);
    }

    private static MultipartFormDataContent PngUpload()
    {
        using var image = new Image<Rgba32>(200, 200, new Rgba32(90, 140, 210));
        var buffer = new MemoryStream();
        image.SaveAsPng(buffer);

        var part = new ByteArrayContent(buffer.ToArray());
        part.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        var form = new MultipartFormDataContent();
        form.Add(part, "file", "photo.png");
        return form;
    }

    private record PagedTeachers(List<PublicTeacherRow> Items, string? NextCursor, int? Total);
    private record PublicTeacherRow(
        Guid UserId, string FullName, string? Subject, string? Phone, string? PhotoETag, DateTimeOffset MemberSinceUtc,
        int OpenLessonCount, int PublishedLessonCount, int StudentCount, int MarkCount, int PassedMarkCount);
    private record ProblemRow(Dictionary<string, List<string>> Errors);
    private record MeProfileRow(Guid UserId, string? Subject, string? Phone);
    private record PagedAdminTeachers(List<AdminTeacherRow> Items);
    private record AdminTeacherRow(Guid UserId, string FullName, string? Subject, string Email, string? Phone, string Status);
    private record PagedTeacherRows(List<TeacherRow> Items);
    private record TeacherRow(Guid UserId, string Email);
    private record JoinCodeEnvelope(string JoinCode);
    private record LessonRow(Guid Id);
    private record MeRow(Guid UserId);
}
