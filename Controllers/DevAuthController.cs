using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class DevAuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAuditWriter _audit;

    public DevAuthController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        IAuditWriter audit)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _audit = audit;
    }

    // GET /dev/login?email=hr@local
    [HttpGet("~/dev/login")]
    public async Task<IActionResult> DevLogin([FromQuery] string email)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            await _audit.WriteAsync(
                eventType: AuditEventTypes.AuthLoginFailure,
                result: "fail",
                user: null,
                userEmail: email,
                dataJson: "{\"mode\":\"dev\",\"reason\":\"user_not_found\"}");

            return NotFound("No such dev user. Run IdentitySeeder.");
        }

        await _signInManager.SignInAsync(user, isPersistent: false);

        await _audit.WriteAsync(
            eventType: AuditEventTypes.AuthLoginSuccess,
            result: "success",
            user: User, // itt még a régi principal lehet üres; inkább userId/email explicit:
            userId: user.Id,
            userEmail: user.Email,
            dataJson: "{\"mode\":\"dev\"}");

        return Ok($"Signed in as {email} (cookie issued).");
    }

    [HttpPost("~/dev/logout")]
    public async Task<IActionResult> DevLogout()
    {
        // próbáljuk még logout elõtt kiolvasni
        var uid = User.FindFirst(OpenIddict.Abstractions.OpenIddictConstants.Claims.Subject)?.Value
                  ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var uemail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                     ?? User.Identity?.Name;

        await _signInManager.SignOutAsync();

        await _audit.WriteAsync(
            eventType: AuditEventTypes.AuthLogout,
            result: "success",
            user: null,
            userId: uid,
            userEmail: uemail,
            dataJson: "{\"mode\":\"dev\"}");

        return Ok("Signed out.");
    }
}