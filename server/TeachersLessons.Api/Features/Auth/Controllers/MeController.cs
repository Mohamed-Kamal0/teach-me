using Microsoft.AspNetCore.Authorization;
using TeachersLessons.Api.Features.Auth.Services;

namespace TeachersLessons.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public class MeController(IAccountService account) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MeResponse>> Get(CancellationToken ct) =>
        Ok(await account.GetMeAsync(ct));

    /// <summary>
    /// Resets the signed-in person's password. `PUT` rather than `POST`: a password is a single
    /// value being replaced with another, and sending the same request twice leaves the account
    /// in the same state the first one left it in.
    ///
    /// Nothing comes back. The new password is not echoed, the session is not disturbed, and the
    /// only thing the caller needs to know is that it worked — which 204 already says. It rides
    /// the same cookie + XSRF-TOKEN pipeline as every other write, so a cross-site form cannot
    /// reach it even from a browser that still holds the session.
    /// </summary>
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await account.ChangePasswordAsync(request, ct);
        return NoContent();
    }
}
