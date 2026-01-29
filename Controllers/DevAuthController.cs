using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class DevAuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;

    public DevAuthController(SignInManager<ApplicationUser> signInManager, UserManager<ApplicationUser> userManager)
    {
        _signInManager = signInManager;
        _userManager = userManager;
    }

    // GET /dev/login?email=hr@local
    [HttpGet("~/dev/login")]
    public async Task<IActionResult> DevLogin([FromQuery] string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null) return NotFound("No such dev user. Run IdentitySeeder.");

        await _signInManager.SignInAsync(user, isPersistent: false);

        return Ok($"Signed in as {email} (cookie issued).");
    }

    [HttpPost("~/dev/logout")]
    public async Task<IActionResult> DevLogout()
    {
        await _signInManager.SignOutAsync();
        return Ok("Signed out.");
    }
}