using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using System.Text.RegularExpressions;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Services;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/admin/security")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminSecurityController : ControllerBase
{
    private static readonly Regex MailHeaderRegex = new(@"^\[(?<ts>[^\]]+)\]\s+TO=(?<to>.*?)\s+SUBJECT=(?<subject>.*)$", RegexOptions.Compiled);
    private static readonly Regex HrefRegex = new(@"href=\""(?<url>[^\""\s]+)\""", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly ISecurityPolicyStore _policyStore;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IWebHostEnvironment _environment;
    private readonly ApplicationDbContext _db;
    private readonly TimeTracker.Api.Data.IAuditWriter _audit;

    public AdminSecurityController(
        ISecurityPolicyStore policyStore,
        UserManager<ApplicationUser> userManager,
        IWebHostEnvironment environment,
        ApplicationDbContext db,
        TimeTracker.Api.Data.IAuditWriter audit)
    {
        _policyStore = policyStore;
        _userManager = userManager;
        _environment = environment;
        _db = db;
        _audit = audit;
    }

    [HttpGet("policy")]
    public async Task<ActionResult<SecurityPolicySnapshot>> GetPolicy(CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();

        var policy = await _policyStore.GetAsync(ct);
        return Ok(policy);
    }

    [HttpPut("policy")]
    public async Task<ActionResult<SecurityPolicySnapshot>> UpdatePolicy([FromBody] UpdateSecurityPolicyRequest request, CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();

        var updated = await _policyStore.UpdateAsync(
            new SecurityPolicySnapshot(
                request.SessionTimeoutMinutes,
                request.MaxFailedLoginAttempts,
                request.PasswordMinLength,
                request.PasswordRequireUppercase,
                request.PasswordRequireLowercase,
                request.PasswordRequireDigit,
                request.PasswordRequireNonAlphanumeric),
            ct);

        return Ok(updated);
    }

    [HttpGet("locked-users")]
    public async Task<ActionResult<List<LockedUserDto>>> GetLockedUsers(CancellationToken ct)
    {
        if (!await IsAdminAsync()) return Forbid();

        var now = DateTimeOffset.UtcNow;
        var policy = await _policyStore.GetAsync(ct);
        var lockoutThreshold = Math.Max(1, policy.MaxFailedLoginAttempts);

        var candidates = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.LockoutEnabled && (u.LockoutEnd != null || u.AccessFailedCount > 0))
            .ToListAsync(ct);

        var list = new List<LockedUserDto>(capacity: candidates.Count);

        var candidateIds = candidates
            .Select(x => x.Id)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList();

        var lockoutHistory = await _db.AuditLogs
            .AsNoTracking()
            .Where(x => (x.EventType == "auth.login.locked_out" || x.EventType == "auth.account.unlocked")
                && x.UserId != null
                && candidateIds.Contains(x.UserId))
            .OrderBy(x => x.TimestampUtc)
            .Select(x => new { x.UserId, x.EventType, x.TimestampUtc })
            .ToListAsync(ct);

        var lockoutStarts = new Dictionary<string, DateTimeOffset?>(StringComparer.Ordinal);

        foreach (var userEvents in lockoutHistory.GroupBy(x => x.UserId!, StringComparer.Ordinal))
        {
            DateTime? currentLockStart = null;

            foreach (var audit in userEvents)
            {
                if (audit.EventType == "auth.account.unlocked")
                {
                    currentLockStart = null;
                    continue;
                }

                if (audit.EventType == "auth.login.locked_out" && currentLockStart is null)
                {
                    currentLockStart = audit.TimestampUtc;
                }
            }

            if (currentLockStart.HasValue)
            {
                var utc = DateTime.SpecifyKind(currentLockStart.Value, DateTimeKind.Utc);
                lockoutStarts[userEvents.Key] = new DateTimeOffset(utc);
            }
        }

        foreach (var candidate in candidates)
        {
            var isLockedOut = await _userManager.IsLockedOutAsync(candidate);
            if (!isLockedOut && candidate.AccessFailedCount < lockoutThreshold)
                continue;

            lockoutStarts.TryGetValue(candidate.Id, out var lockoutStartedAtUtc);

            list.Add(new LockedUserDto(
                candidate.Id,
                candidate.UserName,
                candidate.Email,
                candidate.AccessFailedCount,
                candidate.LockoutEnd,
                candidate.LockoutEnabled,
                isLockedOut || candidate.AccessFailedCount >= lockoutThreshold,
                lockoutStartedAtUtc));
        }

        list = list
            .OrderByDescending(x => x.IsLockedOut)
            .ThenByDescending(x => x.LockoutEnd)
            .ThenByDescending(x => x.AccessFailedCount)
            .ToList();

        return Ok(list);
    }

    [HttpPost("unlock/{userId}")]
    public async Task<IActionResult> UnlockUser([FromRoute] string userId)
    {
        if (!await IsAdminAsync()) return Forbid();

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return NotFound(new { error = "user_not_found" });

        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);

        await _audit.WriteAsync(
            eventType: "auth.account.unlocked",
            result: "success",
            userId: user.Id,
            userEmail: user.Email,
            user: User);

        return Ok(new { ok = true, userId = user.Id });
    }

    [HttpGet("reset-requests")]
    public async Task<ActionResult<List<ResetRequestLogDto>>> GetResetRequests([FromQuery] int take = 50, CancellationToken ct = default)
    {
        if (!await IsAdminAsync()) return Forbid();

        var basePath = string.IsNullOrWhiteSpace(_environment.ContentRootPath)
            ? AppContext.BaseDirectory
            : _environment.ContentRootPath;

        var mailboxFile = Path.Combine(basePath, "App_Data", "dev-mailbox.log");
        if (!System.IO.File.Exists(mailboxFile))
            return Ok(new List<ResetRequestLogDto>());

        var takeClamped = Math.Clamp(take, 1, 200);
        var list = new List<ResetRequestLogDto>(capacity: Math.Min(takeClamped * 3, 600));

        await using var stream = new FileStream(mailboxFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var reader = new StreamReader(stream);

        var chunkLines = new List<string>(capacity: 16);
        while (!reader.EndOfStream)
        {
            ct.ThrowIfCancellationRequested();

            var line = await reader.ReadLineAsync(ct);
            if (line is null)
                continue;

            if (line.Trim() == "---")
            {
                TryAppendResetRequest(chunkLines, list);
                chunkLines.Clear();

                if (list.Count > takeClamped * 4)
                {
                    list = list
                        .OrderByDescending(x => x.TimestampUtc)
                        .Take(takeClamped * 2)
                        .ToList();
                }

                continue;
            }

            chunkLines.Add(line);
        }

        TryAppendResetRequest(chunkLines, list);

        var ordered = list
            .OrderByDescending(x => x.TimestampUtc)
            .Take(takeClamped)
            .ToList();

        return Ok(ordered);
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return false;

        return await _userManager.IsInRoleAsync(user, Roles.Admin);
    }

    private static void TryAppendResetRequest(List<string> chunkLines, List<ResetRequestLogDto> list)
    {
        if (chunkLines.Count == 0)
            return;

        var header = chunkLines[0].Trim();
        var match = MailHeaderRegex.Match(header);
        if (!match.Success)
            return;

        var timestampRaw = match.Groups["ts"].Value;
        var to = match.Groups["to"].Value;
        var subject = match.Groups["subject"].Value;

        var body = string.Join("\n", chunkLines.Skip(1));
        var hrefMatch = HrefRegex.Match(body);
        var resetUrl = hrefMatch.Success ? hrefMatch.Groups["url"].Value : null;

        var isPasswordResetMail =
            (!string.IsNullOrWhiteSpace(subject) && subject.Contains("jelszó visszaállítás", StringComparison.OrdinalIgnoreCase))
            || (!string.IsNullOrWhiteSpace(resetUrl) && resetUrl.Contains("/reset-password", StringComparison.OrdinalIgnoreCase))
            || body.Contains("/reset-password", StringComparison.OrdinalIgnoreCase);

        if (!isPasswordResetMail)
            return;

        DateTimeOffset.TryParse(timestampRaw, out var timestamp);

        list.Add(new ResetRequestLogDto(
            timestamp == default ? timestampRaw : timestamp.ToUniversalTime().ToString("O"),
            string.IsNullOrWhiteSpace(to) ? null : to,
            string.IsNullOrWhiteSpace(subject) ? null : subject,
            resetUrl));
    }

}

public sealed class UpdateSecurityPolicyRequest
{
    public int SessionTimeoutMinutes { get; set; } = 60;
    public int MaxFailedLoginAttempts { get; set; } = 5;
    public int PasswordMinLength { get; set; } = 8;
    public bool PasswordRequireUppercase { get; set; }
    public bool PasswordRequireLowercase { get; set; }
    public bool PasswordRequireDigit { get; set; }
    public bool PasswordRequireNonAlphanumeric { get; set; }
}

public sealed record LockedUserDto(
    string UserId,
    string? UserName,
    string? Email,
    int AccessFailedCount,
    DateTimeOffset? LockoutEnd,
    bool LockoutEnabled,
    bool IsLockedOut,
    DateTimeOffset? LockoutStartedAtUtc
);

public sealed record ResetRequestLogDto(
    string TimestampUtc,
    string? To,
    string? Subject,
    string? ResetUrl
);
