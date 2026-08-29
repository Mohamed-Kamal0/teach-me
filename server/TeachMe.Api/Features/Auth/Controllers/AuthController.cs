using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using TeachMe.Api.Features.Auth.Services;

namespace TeachMe.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("register/teacher")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterTeacher(RegisterTeacherRequest request, CancellationToken ct)
    {
        await auth.RegisterTeacherAsync(request, ct);
        return Created();
    }

    [HttpPost("register/student")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterStudent(RegisterStudentRequest request, CancellationToken ct)
    {
        await auth.RegisterStudentAsync(request, ct);
        return Created();
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var authenticated = await auth.AuthenticateAsync(request, ct);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, authenticated.Principal);
        return Ok(authenticated.Response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }
}
