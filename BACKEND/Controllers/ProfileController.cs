using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class ProfileController : ControllerBase
{
    private const long MaxPhotoSizeBytes = 2 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    };

    private static readonly string[] SupportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _environment;

    public ProfileController(UserManager<ApplicationUser> userManager, IWebHostEnvironment environment)
    {
        _userManager = userManager;
        _environment = environment;
    }

    [HttpGet("me")]
    public async Task<ActionResult<ProfileMeResponse>> Me()
    {
        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);

        if (user is null)
            return Unauthorized();

        var roles = await _userManager.GetRolesAsync(user);

        var name = user.UserName ?? user.Email ?? user.Id;
        var email = ResolveDisplayEmail(user);

        return Ok(new ProfileMeResponse(
            user.Id,
            name,
            user.UserName,
            email,
            user.PhoneNumber,
            user.EmailConfirmed,
            roles.ToArray(),
            ResolvePhotoUrl(user.Id)
        ));
    }

    [HttpPost("me/photo")]
    [RequestSizeLimit(MaxPhotoSizeBytes)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<PhotoUploadResponse>> UploadPhoto([FromForm] PhotoUploadRequest request)
    {
        var file = request.File;

        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        if (file.Length > MaxPhotoSizeBytes)
            return BadRequest("File is too large. Max size is 2 MB.");

        if (!AllowedContentTypes.Contains(file.ContentType))
            return BadRequest("Unsupported file type. Allowed: jpeg, png, webp, gif.");

        var userId = User.GetUserIdOrThrow();
        var folder = EnsureProfileFolder();

        DeleteExistingPhotos(folder, userId);

        var extension = ToExtension(file.ContentType);
        var fileName = $"{userId}{extension}";
        var fullPath = Path.Combine(folder, fileName);

        await using var stream = System.IO.File.Create(fullPath);
        await file.CopyToAsync(stream);

        var photoUrl = BuildAbsoluteUrl($"/uploads/profiles/{fileName}");
        return Ok(new PhotoUploadResponse(photoUrl));
    }

    [HttpDelete("me/photo")]
    public IActionResult DeletePhoto()
    {
        var userId = User.GetUserIdOrThrow();
        var folder = EnsureProfileFolder();

        DeleteExistingPhotos(folder, userId);

        return NoContent();
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

    private static void DeleteExistingPhotos(string folder, string userId)
    {
        foreach (var ext in SupportedExtensions)
        {
            var file = Path.Combine(folder, $"{userId}{ext}");
            if (System.IO.File.Exists(file))
                System.IO.File.Delete(file);
        }
    }

    private static string ToExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        _ => ".jpg"
    };

    private static string? ResolveDisplayEmail(ApplicationUser user)
    {
        if (!string.IsNullOrWhiteSpace(user.Email))
            return user.Email;

        var userName = user.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return null;

        return userName.Contains('@') ? userName : null;
    }

    private string BuildAbsoluteUrl(string relativePath)
    {
        var host = $"{Request.Scheme}://{Request.Host.Value}";
        return host + relativePath;
    }
}

public record ProfileMeResponse(
    string UserId,
    string Name,
    string? UserName,
    string? Email,
    string? PhoneNumber,
    bool EmailConfirmed,
    string[] Roles,
    string? PhotoUrl
);

public record PhotoUploadResponse(string PhotoUrl);

public sealed class PhotoUploadRequest
{
    public IFormFile? File { get; set; }
}
