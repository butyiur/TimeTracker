using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/account/2fa")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class AccountSecurityController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AccountSecurityController(UserManager<ApplicationUser> userManager)
        => _userManager = userManager;

    [HttpPost("totp/setup")]
    public async Task<IActionResult> SetupTotp()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        // új kulcs (ha újra setupol)
        await _userManager.ResetAuthenticatorKeyAsync(user);

        var key = await _userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrWhiteSpace(key))
            return Problem("Authenticator key generation failed.");

        var email = user.Email ?? user.UserName ?? user.Id;

        // otpauth URI: ezt fogja az Angular QR-kóddá alakítani
        var issuer = "TimeTracker";
        var uri = BuildOtpAuthUri(issuer, email, key);

        return Ok(new
        {
            sharedKey = key,
            authenticatorUri = uri
        });
    }

    [HttpPost("totp/enable")]
    public async Task<IActionResult> EnableTotp([FromBody] EnableTotpRequest req)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { error = "code_required" });

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var code = req.Code.Replace(" ", "").Replace("-", "");

        var isValid = await _userManager.VerifyTwoFactorTokenAsync(
            user,
            TokenOptions.DefaultAuthenticatorProvider,
            code);

        if (!isValid)
            return BadRequest(new { error = "invalid_code" });

        await _userManager.SetTwoFactorEnabledAsync(user, true);

        // recovery codes – ezt most adjuk vissza egyszer
        var recoveryCodes = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, number: 10);

        return Ok(new
        {
            enabled = true,
            recoveryCodes
        });
    }

    [HttpPost("totp/disable")]
    public async Task<IActionResult> DisableTotp()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        await _userManager.SetTwoFactorEnabledAsync(user, false);
        await _userManager.ResetAuthenticatorKeyAsync(user);

        return Ok(new { enabled = false });
    }

    [HttpPost("recoverycodes/regenerate")]
    public async Task<IActionResult> RegenerateRecoveryCodes()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var is2faEnabled = await _userManager.GetTwoFactorEnabledAsync(user);
        if (!is2faEnabled)
            return BadRequest(new { error = "2fa_not_enabled" });

        var recoveryCodes = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, number: 10);

        return Ok(new { recoveryCodes });
    }

    private static string BuildOtpAuthUri(string issuer, string email, string secret)
    {
        // RFC kompatibilis otpauth URI (TOTP, 6 digit)
        var encIssuer = Uri.EscapeDataString(issuer);
        var encEmail = Uri.EscapeDataString(email);

        return $"otpauth://totp/{encIssuer}:{encEmail}?secret={secret}&issuer={encIssuer}&digits=6";
    }
}

public sealed class EnableTotpRequest
{
    public string Code { get; set; } = "";
}