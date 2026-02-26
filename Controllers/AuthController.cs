using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;

    public AuthController(SignInManager<ApplicationUser> signInManager)
    {
        _signInManager = signInManager;
    }

    // GET /api/auth/cookie-logout?returnUrl=http://localhost:4200/
    [HttpGet("cookie-logout")]
    [AllowAnonymous]
    public async Task<IActionResult> CookieLogout([FromQuery] string? returnUrl = null)
    {
        await _signInManager.SignOutAsync();
        await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);

        if (string.IsNullOrWhiteSpace(returnUrl))
            returnUrl = "http://localhost:4200/";

        return Redirect(returnUrl);
    }
}