using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Services;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class DevAuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _environment;
    private readonly IAuditWriter _audit;

    public DevAuthController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        IWebHostEnvironment environment,
        IAuditWriter audit)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _environment = environment;
        _audit = audit;
    }

    // GET /dev/login?email=hr@local
    [HttpGet("~/dev/login")]
    [AllowAnonymous]
    public async Task<IActionResult> DevLogin([FromQuery] string email)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var user = await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            await _audit.WriteAsync(
                eventType: AuditEventTypes.AuthLoginFailure,
                result: "fail",
                user: null,
                httpContext: HttpContext,
                dataJson: "{\"mode\":\"dev\",\"reason\":\"user_not_found\",\"email\":\"" + email + "\"}");

            return NotFound("No such dev user. Run IdentitySeeder.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var isPrivileged = roles.Any(r =>
            string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r, Roles.HR, StringComparison.OrdinalIgnoreCase));
        if (isPrivileged)
        {
            await _audit.WriteAsync(
                eventType: "auth.dev.login.blocked_privileged",
                result: "fail",
                user: null,
                httpContext: HttpContext,
                dataJson: "{\"email\":\"" + email + "\"}");

            return BadRequest(new { error = "dev_login_blocked_for_privileged" });
        }

        await _signInManager.SignInAsync(user, isPersistent: false);
        var principal = await _signInManager.CreateUserPrincipalAsync(user);

        await _audit.WriteAsync(
            eventType: AuditEventTypes.AuthLoginSuccess,
            result: "success",
            user: principal,
            httpContext: HttpContext,
            dataJson: "{\"mode\":\"dev\"}");

        return Ok($"Signed in as {email} (cookie issued).");
    }

    [HttpPost("~/dev/logout")]
    [AllowAnonymous]
    public async Task<IActionResult> DevLogout()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        await _signInManager.SignOutAsync();

        await _audit.WriteAsync(
            eventType: AuditEventTypes.AuthLogout,
            result: "success",
            user: null,
            httpContext: HttpContext,
            dataJson: "{\"mode\":\"dev\"}");

        return Ok("Signed out.");
    }

    // POST /dev/reset-admin
    [HttpPost("~/dev/reset-admin")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetAdmin([FromBody] DevResetAdminRequest? request)
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        request ??= new DevResetAdminRequest();

        var email = string.IsNullOrWhiteSpace(request.Email) ? "admin@local" : request.Email.Trim();
        var userName = string.IsNullOrWhiteSpace(request.UserName) ? email : request.UserName.Trim();
        var password = string.IsNullOrWhiteSpace(request.Password) ? "Admin123!" : request.Password;

        var adminUsers = await _userManager.GetUsersInRoleAsync(Roles.Admin);
        var user = adminUsers.FirstOrDefault(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase))
                   ?? adminUsers.FirstOrDefault()
                   ?? await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                EmailConfirmed = true,
                LockoutEnabled = true
            };

            var create = await _userManager.CreateAsync(user, password);
            if (!create.Succeeded)
                return BadRequest(new { error = "create_failed", details = create.Errors.Select(e => e.Description) });
        }
        else
        {
            if (!string.Equals(user.UserName, userName, StringComparison.Ordinal))
            {
                var setUserName = await _userManager.SetUserNameAsync(user, userName);
                if (!setUserName.Succeeded)
                    return BadRequest(new { error = "username_set_failed", details = setUserName.Errors.Select(e => e.Description) });
            }

            if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                var setEmail = await _userManager.SetEmailAsync(user, email);
                if (!setEmail.Succeeded)
                    return BadRequest(new { error = "email_set_failed", details = setEmail.Errors.Select(e => e.Description) });
            }

            var hasPassword = await _userManager.HasPasswordAsync(user);
            if (hasPassword)
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var reset = await _userManager.ResetPasswordAsync(user, token, password);
                if (!reset.Succeeded)
                    return BadRequest(new { error = "password_reset_failed", details = reset.Errors.Select(e => e.Description) });
            }
            else
            {
                var addPwd = await _userManager.AddPasswordAsync(user, password);
                if (!addPwd.Succeeded)
                    return BadRequest(new { error = "password_add_failed", details = addPwd.Errors.Select(e => e.Description) });
            }
        }

        if (!await _userManager.IsInRoleAsync(user, Roles.Admin))
        {
            var addRole = await _userManager.AddToRoleAsync(user, Roles.Admin);
            if (!addRole.Succeeded)
                return BadRequest(new { error = "role_add_failed", details = addRole.Errors.Select(e => e.Description) });
        }

        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetTwoFactorEnabledAsync(user, false);

        await _audit.WriteAsync(
            eventType: "auth.dev.reset_admin",
            result: "success",
            user: null,
            httpContext: HttpContext,
            dataJson: "{\"email\":\"" + email + "\",\"userName\":\"" + userName + "\"}");

        return Ok(new
        {
            ok = true,
            email,
            userName,
            password,
            note = "Admin reset complete (dev-only). 2FA is disabled and lockout is cleared."
        });
    }
}

public sealed class DevResetAdminRequest
{
    public string? Email { get; set; }
    public string? UserName { get; set; }
    public string? Password { get; set; }
}