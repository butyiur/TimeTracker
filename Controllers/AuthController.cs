using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;
using Microsoft.AspNetCore.WebUtilities;
using System.Text;
using System.Security.Claims;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Services;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _environment;
    private readonly ISecurityPolicyStore _policyStore;
    private readonly IEmailSender _emailSender;
    private readonly EmailOptions _emailOptions;
    private static readonly string[] SupportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    public AuthController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        IWebHostEnvironment environment,
        ISecurityPolicyStore policyStore,
        IEmailSender emailSender,
        Microsoft.Extensions.Options.IOptions<EmailOptions> emailOptions)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _environment = environment;
        _policyStore = policyStore;
        _emailSender = emailSender;
        _emailOptions = emailOptions.Value;
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

    // GET /api/auth/me  (Bearer token - SPA)
    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
    public async Task<IActionResult> Me()
    {
        var userId =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return Unauthorized();

        if (!user.RegistrationApproved)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "pending_registration_approval" });

        if (!user.EmploymentActive)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "inactive_profile" });

        if (await _userManager.IsLockedOutAsync(user))
            return StatusCode(StatusCodes.Status423Locked, new { error = "account_locked" });

        var name = user.UserName ?? user.Email ?? user.Id;
        var email = ResolveDisplayEmail(user);
        var roles = (await _userManager.GetRolesAsync(user)).ToArray();


        return Ok(new
        {
            userId,
            name,
            email,
            phoneNumber = user.PhoneNumber,
            roles,
            photoUrl = userId is null ? null : ResolvePhotoUrl(userId)
        });
    }

    // GET /api/auth/password-policy
    [HttpGet("password-policy")]
    [AllowAnonymous]
    public async Task<IActionResult> PasswordPolicy(CancellationToken ct)
    {
        var policy = await _policyStore.GetAsync(ct);

        return Ok(new
        {
            passwordMinLength = policy.PasswordMinLength,
            passwordRequireUppercase = policy.PasswordRequireUppercase,
            passwordRequireLowercase = policy.PasswordRequireLowercase,
            passwordRequireDigit = policy.PasswordRequireDigit,
            passwordRequireNonAlphanumeric = policy.PasswordRequireNonAlphanumeric
        });
    }

    // POST /api/auth/register
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (request is null ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "email_password_required" });
        }

        var email = request.Email.Trim();
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
            return Conflict(new { error = "email_already_exists" });

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = false,
            LockoutEnabled = true,
            EmploymentActive = true,
            RegistrationApproved = false,
            RegistrationRequestedAtUtc = DateTimeOffset.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                error = "register_failed",
                details = createResult.Errors.Select(e => e.Description)
            });
        }

        var roleResult = await _userManager.AddToRoleAsync(user, Roles.Employee);
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            return BadRequest(new
            {
                error = "role_assignment_failed",
                details = roleResult.Errors.Select(e => e.Description)
            });
        }

        await SendEmailConfirmationAsync(user, CancellationToken.None);

        return Ok(new
        {
            ok = true,
            userId = user.Id,
            email = user.Email,
            role = Roles.Employee,
            requiresHrApproval = true
        });
    }

    // POST /api/auth/resend-email-confirmation
    [HttpPost("resend-email-confirmation")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendEmailConfirmation([FromBody] ResendEmailConfirmationRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Email))
            return Ok(new { ok = true });

        var emailInput = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(emailInput)
                   ?? await _userManager.FindByNameAsync(emailInput);

        if (user is null || user.EmailConfirmed)
            return Ok(new { ok = true });

        await SendEmailConfirmationAsync(user, ct);
        return Ok(new { ok = true });
    }

    // POST /api/auth/confirm-email
    [HttpPost("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        if (request is null ||
            string.IsNullOrWhiteSpace(request.UserId) ||
            string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "invalid_request" });
        }

        var user = await _userManager.FindByIdAsync(request.UserId.Trim());
        if (user is null)
            return BadRequest(new { error = "invalid_confirmation" });

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token.Trim()));
        }
        catch
        {
            return BadRequest(new { error = "invalid_token" });
        }

        var result = await _userManager.ConfirmEmailAsync(user, decodedToken);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                error = "email_confirmation_failed",
                details = result.Errors.Select(e => e.Description)
            });
        }

        return Ok(new { ok = true });
    }

    // POST /api/auth/forgot-password
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Email))
            return Ok(new { ok = true });

        var emailInput = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(emailInput)
                   ?? await _userManager.FindByNameAsync(emailInput);

        if (user is null)
            return Ok(new { ok = true });

        var targetEmail = ResolveDisplayEmail(user);
        if (string.IsNullOrWhiteSpace(targetEmail))
            return Ok(new { ok = true });

        var rawToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));

        var resetUrl = BuildPasswordResetUrl(targetEmail, token);

        var subject = "Jelszó visszaállítás";
        var body = $"<p>Jelszó-visszaállítási kérelmet kaptunk a TimeTracker fiókodhoz.</p><p><a href=\"{resetUrl}\">Jelszó visszaállítása</a></p><p>Ha nem te kérted, ezt figyelmen kívül hagyhatod.</p>";

        await _emailSender.SendAsync(targetEmail, subject, body, ct);

        return Ok(new { ok = true });
    }

    // POST /api/auth/reset-password
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (request is null ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Token) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { error = "invalid_request" });
        }

        var emailInput = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(emailInput)
                   ?? await _userManager.FindByNameAsync(emailInput);

        if (user is null)
            return BadRequest(new { error = "invalid_token_or_email" });

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token.Trim()));
        }
        catch
        {
            return BadRequest(new { error = "invalid_token" });
        }

        var result = await _userManager.ResetPasswordAsync(user, decodedToken, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                error = "reset_password_failed",
                details = result.Errors.Select(e => e.Description)
            });
        }

        return Ok(new { ok = true });
    }

    private string? ResolvePhotoUrl(string userId)
    {
        var folder = EnsureProfileFolder();

        foreach (var ext in SupportedExtensions)
        {
            var fileName = $"{userId}{ext}";
            var fullPath = Path.Combine(folder, fileName);

            if (System.IO.File.Exists(fullPath))
                return BuildAbsoluteUrl($"/uploads/profiles/{fileName}");
        }

        return null;
    }

    private string EnsureProfileFolder()
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
            webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");

        var folder = Path.Combine(webRoot, "uploads", "profiles");
        Directory.CreateDirectory(folder);
        return folder;
    }

    private string BuildAbsoluteUrl(string relativePath)
    {
        var host = $"{Request.Scheme}://{Request.Host.Value}";
        return host + relativePath;
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

    private string BuildPasswordResetUrl(string email, string token)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_emailOptions.PasswordResetSpaBaseUrl)
            ? "http://localhost:4200"
            : _emailOptions.PasswordResetSpaBaseUrl.TrimEnd('/');

        return $"{baseUrl}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }

    private async Task SendEmailConfirmationAsync(ApplicationUser user, CancellationToken ct)
    {
        var targetEmail = ResolveDisplayEmail(user);
        if (string.IsNullOrWhiteSpace(targetEmail))
            return;

        var rawToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));
        var confirmUrl = BuildEmailConfirmationUrl(user.Id, token);

        var subject = "E-mail cím megerősítése";
        var body = $"<p>Köszönjük a regisztrációt a TimeTracker rendszerben.</p><p><a href=\"{confirmUrl}\">E-mail cím megerősítése</a></p><p>Ha nem te regisztráltál, figyelmen kívül hagyhatod ezt az üzenetet.</p>";

        await _emailSender.SendAsync(targetEmail, subject, body, ct);
    }

    private string BuildEmailConfirmationUrl(string userId, string token)
    {
        var baseUrl = string.IsNullOrWhiteSpace(_emailOptions.EmailConfirmationSpaBaseUrl)
            ? "http://localhost:4200"
            : _emailOptions.EmailConfirmationSpaBaseUrl.TrimEnd('/');

        return $"{baseUrl}/confirm-email?userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
    }
}

public sealed class RegisterRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class ForgotPasswordRequest
{
    public string Email { get; set; } = "";
}

public sealed class ResetPasswordRequest
{
    public string Email { get; set; } = "";
    public string Token { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public sealed class ResendEmailConfirmationRequest
{
    public string Email { get; set; } = "";
}

public sealed class ConfirmEmailRequest
{
    public string UserId { get; set; } = "";
    public string Token { get; set; } = "";
}