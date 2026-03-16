using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using System.Text.RegularExpressions;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class SettingsController : ControllerBase
{
    private static readonly Regex PhoneRegex = new(@"^\+[1-9][0-9]{7,14}$", RegexOptions.Compiled);

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;

    public SettingsController(UserManager<ApplicationUser> userManager, ApplicationDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserSettingsResponse>> Me(CancellationToken ct)
    {
        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();
        var email = ResolveDisplayEmail(user);

        var roles = await _userManager.GetRolesAsync(user);
        var is2faRequired = roles.Contains(Roles.HR) || roles.Contains(Roles.Admin);
        var is2faEnabled = await _userManager.GetTwoFactorEnabledAsync(user);

        var lastLogins = await _db.AuditLogs
            .AsNoTracking()
            .Where(x =>
                x.EventType == "auth.login.success" &&
                (
                    x.UserId == user.Id ||
                    (x.UserId == null && user.Email != null && x.UserEmail == user.Email)
                ))
            .OrderByDescending(x => x.TimestampUtc)
            .Take(5)
            .Select(x => new LastLoginDto(
                new DateTimeOffset(DateTime.SpecifyKind(x.TimestampUtc, DateTimeKind.Utc)),
                x.IpAddress,
                x.UserAgent))
            .ToListAsync(ct);

        return Ok(new UserSettingsResponse(
            user.Id,
            user.UserName,
            email,
            user.EmailConfirmed,
            user.PhoneNumber,
            is2faEnabled,
            is2faRequired,
            roles.ToArray(),
            lastLogins
        ));
    }

    [HttpPost("me/username")]
    public async Task<IActionResult> ChangeUsername([FromBody] ChangeUserNameRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.NewUserName))
            return BadRequest(new { error = "username_required" });

        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();

        var normalized = request.NewUserName.Trim();
        var previousUserName = user.UserName ?? string.Empty;
        var previousEmail = user.Email;

        var existing = await _userManager.FindByNameAsync(normalized);
        if (existing is not null && existing.Id != user.Id)
            return Conflict(new { error = "username_already_exists" });

        var shouldSyncLocalEmail = ShouldSyncLocalEmail(previousUserName, previousEmail);
        var nextLocalEmail = shouldSyncLocalEmail ? $"{normalized}@local" : null;

        if (!string.IsNullOrWhiteSpace(nextLocalEmail))
        {
            var existingEmail = await _userManager.FindByEmailAsync(nextLocalEmail);
            if (existingEmail is not null && existingEmail.Id != user.Id)
                return Conflict(new { error = "email_already_exists" });
        }

        var result = await _userManager.SetUserNameAsync(user, normalized);
        if (!result.Succeeded)
            return BadRequest(new { error = "username_change_failed", details = result.Errors.Select(e => e.Description) });

        if (!string.IsNullOrWhiteSpace(nextLocalEmail))
        {
            var emailResult = await _userManager.SetEmailAsync(user, nextLocalEmail);
            if (!emailResult.Succeeded)
            {
                await _userManager.SetUserNameAsync(user, previousUserName);
                return BadRequest(new { error = "email_sync_failed", details = emailResult.Errors.Select(e => e.Description) });
            }
        }

        return Ok(new { ok = true, userName = user.UserName });
    }

    private static bool ShouldSyncLocalEmail(string? userName, string? email)
    {
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(email))
            return false;

        var marker = "@local";
        if (!email.EndsWith(marker, StringComparison.OrdinalIgnoreCase))
            return false;

        var localPart = email[..^marker.Length];
        return string.Equals(localPart, userName, StringComparison.OrdinalIgnoreCase);
    }

    private static string? ResolveDisplayEmail(ApplicationUser user)
    {
        if (!string.IsNullOrWhiteSpace(user.Email))
            return user.Email;

        var userName = user.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return null;

        return userName.Contains('@') ? userName : null;
    }

    [HttpPost("me/password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (request is null ||
            string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { error = "password_required" });
        }

        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { error = "password_change_failed", details = result.Errors.Select(e => e.Description) });

        return Ok(new { ok = true });
    }

    [HttpPost("me/phone")]
    public async Task<IActionResult> ChangePhone([FromBody] ChangePhoneNumberRequest request)
    {
        if (request is null)
            return BadRequest(new { error = "phone_required" });

        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();

        var normalized = NormalizePhoneOrNull(request.PhoneNumber);

        if (normalized is not null && !PhoneRegex.IsMatch(normalized))
            return BadRequest(new { error = "phone_invalid_format", details = new[] { "A telefonszám formátuma: +123456789 (plusz jellel, szóközök nélkül)." } });

        var result = await _userManager.SetPhoneNumberAsync(user, normalized);
        if (!result.Succeeded)
            return BadRequest(new { error = "phone_change_failed", details = result.Errors.Select(e => e.Description) });

        return Ok(new { ok = true, phoneNumber = user.PhoneNumber });
    }

    private static string? NormalizePhoneOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}

public sealed record UserSettingsResponse(
    string UserId,
    string? UserName,
    string? Email,
    bool EmailConfirmed,
    string? PhoneNumber,
    bool TwoFactorEnabled,
    bool TwoFactorRequired,
    string[] Roles,
    List<LastLoginDto> LastLogins
);

public sealed record LastLoginDto(
    DateTimeOffset TimestampUtc,
    string? IpAddress,
    string? UserAgent
);

public sealed class ChangeUserNameRequest
{
    public string NewUserName { get; set; } = "";
}

public sealed class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public sealed class ChangePhoneNumberRequest
{
    public string? PhoneNumber { get; set; }
}
