using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
public class AdminUsersController : ControllerBase
{
    private static readonly string[] AllowedRoles = [Roles.Employee, Roles.HR, Roles.Admin];

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _environment;

    private static readonly string[] SupportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

    public AdminUsersController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db,
        IWebHostEnvironment environment)
    {
        _userManager = userManager;
        _db = db;
        _environment = environment;
    }

    [HttpGet]
    public async Task<ActionResult<AdminUserPagedResponse>> GetUsers(
        [FromQuery] string? q = null,
        [FromQuery] string? role = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 25;

        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(x =>
                (x.Email != null && x.Email.Contains(term)) ||
                (x.UserName != null && x.UserName.Contains(term)));
        }

        var filterRole = string.IsNullOrWhiteSpace(role) ? null : NormalizeRole(role);
        if (filterRole is not null)
        {
            query = query.Where(u =>
                _db.UserRoles
                    .Join(_db.Roles,
                        ur => ur.RoleId,
                        r => r.Id,
                        (ur, r) => new { ur.UserId, RoleName = r.Name })
                    .Any(x => x.UserId == u.Id && x.RoleName == filterRole));
        }

        var totalItems = await query.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize));
        if (page > totalPages) page = totalPages;

        var now = DateTimeOffset.UtcNow;

        var activeUsers = await query.CountAsync(x => x.EmploymentActive);
        var inactiveUsers = totalItems - activeUsers;
        var lockedUsers = await query.CountAsync(x =>
            x.LockoutEnabled
            && x.LockoutEnd.HasValue
            && x.LockoutEnd.Value > now);

        var filteredUserIdsQuery = query.Select(x => x.Id);
        var hrUsers = await _db.UserRoles
            .AsNoTracking()
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => new { ur.UserId, RoleName = r.Name })
            .Where(x => filteredUserIdsQuery.Contains(x.UserId)
                && x.RoleName != null
                && x.RoleName == Roles.HR)
            .Select(x => x.UserId)
            .Distinct()
            .CountAsync();

        var adminUsers = await _db.UserRoles
            .AsNoTracking()
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => new { ur.UserId, RoleName = r.Name })
            .Where(x => filteredUserIdsQuery.Contains(x.UserId)
                && x.RoleName != null
                && x.RoleName == Roles.Admin)
            .Select(x => x.UserId)
            .Distinct()
            .CountAsync();

        var users = await query
            .OrderBy(x => x.Email ?? x.UserName ?? x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userIds = users.Select(x => x.Id).ToArray();
        var rolesByUserId = await _db.UserRoles
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => new { ur.UserId, RoleName = r.Name })
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(
                g => g.Key,
                g => g.Select(x => x.RoleName)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .OrderBy(x => x)
                    .ToArray());

        var list = new List<AdminUserListItemDto>(users.Count);

        foreach (var user in users)
        {
            var roles = rolesByUserId.TryGetValue(user.Id, out var mappedRoles)
                ? mappedRoles
                : Array.Empty<string>();

            var lockoutActive = user.LockoutEnabled
                && user.LockoutEnd.HasValue
                && user.LockoutEnd.Value > now;
            var employmentActive = user.EmploymentActive;
            var lockoutReason = ResolveLockoutReason(employmentActive, lockoutActive, user.AccessFailedCount);

            list.Add(new AdminUserListItemDto(
                user.Id,
                user.Email,
                user.UserName,
                roles,
                employmentActive,
                lockoutActive,
                user.LockoutEnd,
                user.AccessFailedCount,
                user.EmailConfirmed,
                lockoutReason));
        }

        return Ok(new AdminUserPagedResponse(
            Page: page,
            PageSize: pageSize,
            TotalItems: totalItems,
            TotalPages: totalPages,
            ActiveUsers: activeUsers,
            InactiveUsers: inactiveUsers,
            HrUsers: hrUsers,
            AdminUsers: adminUsers,
            LockedUsers: lockedUsers,
            Items: list));
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult<AdminUserDetailsDto>> GetUserDetails([FromRoute] string userId)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
        if (user is null)
            return NotFound(new { error = "user_not_found" });

        var roles = await _db.UserRoles
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => r.Name)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .OrderBy(x => x)
            .ToArrayAsync();

        var now = DateTimeOffset.UtcNow;
        var isLockedOut = user.LockoutEnabled
            && user.LockoutEnd.HasValue
            && user.LockoutEnd.Value > now;
        var employmentActive = user.EmploymentActive;
        var lockoutReason = ResolveLockoutReason(employmentActive, isLockedOut, user.AccessFailedCount);

        return Ok(new AdminUserDetailsDto(
            user.Id,
            user.Email,
            user.UserName,
            user.PhoneNumber,
            user.EmailConfirmed,
            roles,
            employmentActive,
            isLockedOut,
            user.LockoutEnd,
            user.AccessFailedCount,
            lockoutReason,
            ResolvePhotoUrl(user.Id)
        ));
    }

    [HttpPut("{userId}/active")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<IActionResult> SetActive([FromRoute] string userId, [FromBody] SetUserActiveRequest request)
    {
        var actorId = User.GetUserIdOrThrow();
        if (string.Equals(actorId, userId, StringComparison.Ordinal))
            return BadRequest(new { error = "self_update_not_allowed", details = new[] { "Saját fiók nem inaktiválható ezen a felületen." } });

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return NotFound(new { error = "user_not_found" });

        var targetRoles = await _userManager.GetRolesAsync(user);
        var targetIsAdmin = targetRoles.Any(r => string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase));

        if (targetIsAdmin)
            return Forbid();

        user.EmploymentActive = request.IsActive;
        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            return BadRequest(new
            {
                error = "employment_status_update_failed",
                details = updateResult.Errors.Select(x => x.Description)
            });
        }

        await _userManager.UpdateSecurityStampAsync(user);

        return Ok(new { ok = true, userId = user.Id, isActive = request.IsActive });
    }

    [HttpPut("{userId}/roles")]
    public async Task<IActionResult> SetRoles([FromRoute] string userId, [FromBody] SetUserRolesRequest request)
    {
        var actorId = User.GetUserIdOrThrow();
        var actorIsAdmin = await IsCurrentUserAdminAsync(actorId);

        if (!actorIsAdmin)
            return Forbid();

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return NotFound(new { error = "user_not_found" });

        if (string.Equals(actorId, userId, StringComparison.Ordinal))
            return BadRequest(new { error = "self_role_update_not_allowed", details = new[] { "Saját szerepkör nem módosítható ezen a felületen." } });

        var currentRoles = await _userManager.GetRolesAsync(user);
        var targetIsAdmin = currentRoles.Any(r => string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase));
        if (targetIsAdmin)
            return BadRequest(new { error = "admin_role_update_not_allowed", details = new[] { "Admin jogosultság nem módosítható ezen a felületen." } });

        var targetIsEmployeeOrHr = currentRoles.Any(r => string.Equals(r, Roles.Employee, StringComparison.OrdinalIgnoreCase))
            || currentRoles.Any(r => string.Equals(r, Roles.HR, StringComparison.OrdinalIgnoreCase));
        if (!targetIsEmployeeOrHr)
            return BadRequest(new { error = "employee_or_hr_role_required", details = new[] { "Csak Employee vagy HR felhasználó szerepe módosítható ezen a felületen." } });

        var requestedRoles = (request.Roles ?? Array.Empty<string>())
            .Select(NormalizeRole)
            .Where(r => r is not null)
            .Select(r => r!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (requestedRoles.Length == 0)
            return BadRequest(new { error = "invalid_roles", details = new[] { "Csak Employee vagy HR szerepkör engedélyezett." } });

        var requestedHasEmployee = requestedRoles.Contains(Roles.Employee, StringComparer.OrdinalIgnoreCase);
        var requestedHasHr = requestedRoles.Contains(Roles.HR, StringComparer.OrdinalIgnoreCase);
        var requestedHasAdmin = requestedRoles.Contains(Roles.Admin, StringComparer.OrdinalIgnoreCase);
        var hasOnlyAllowed = requestedRoles.All(r =>
            string.Equals(r, Roles.Employee, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r, Roles.HR, StringComparison.OrdinalIgnoreCase));

        var hasExactlyOneAllowedRole = requestedRoles.Length == 1 && (requestedHasEmployee || requestedHasHr);
        if (!hasOnlyAllowed || requestedHasAdmin || !hasExactlyOneAllowedRole)
        {
            return BadRequest(new
            {
                error = "invalid_role_transition",
                details = new[] { "Csak Employee ↔ HR módosítás engedélyezett (egyszerre csak egy szerepkör lehet)." }
            });
        }

        if (requestedHasHr && !user.TwoFactorEnabled)
        {
            return BadRequest(new
            {
                error = "hr_requires_2fa",
                details = new[] { "HR szerepkör csak olyan felhasználónak adható, akinél a 2FA már be van kapcsolva." }
            });
        }

        var toAdd = requestedRoles.Except(currentRoles, StringComparer.OrdinalIgnoreCase).ToArray();
        var toRemove = currentRoles.Except(requestedRoles, StringComparer.OrdinalIgnoreCase).ToArray();

        if (toRemove.Length > 0)
        {
            var removeResult = await _userManager.RemoveFromRolesAsync(user, toRemove);
            if (!removeResult.Succeeded)
            {
                return BadRequest(new
                {
                    error = "remove_roles_failed",
                    details = removeResult.Errors.Select(x => x.Description)
                });
            }
        }

        if (toAdd.Length > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, toAdd);
            if (!addResult.Succeeded)
            {
                return BadRequest(new
                {
                    error = "add_roles_failed",
                    details = addResult.Errors.Select(x => x.Description)
                });
            }
        }

        await _userManager.UpdateSecurityStampAsync(user);

        var finalRoles = (await _userManager.GetRolesAsync(user)).OrderBy(x => x).ToArray();
        return Ok(new { ok = true, userId = user.Id, roles = finalRoles });
    }

    private static string? NormalizeRole(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var match = AllowedRoles.FirstOrDefault(x => string.Equals(x, value.Trim(), StringComparison.OrdinalIgnoreCase));
        return match;
    }

    private async Task<bool> IsCurrentUserAdminAsync(string actorId)
    {
        var actor = await _userManager.FindByIdAsync(actorId);
        if (actor is null)
            return false;

        return await _userManager.IsInRoleAsync(actor, Roles.Admin);
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

    private static string? ResolveLockoutReason(bool employmentActive, bool isLockedOut, int accessFailedCount)
    {
        if (!employmentActive)
            return "manual_inactivation";

        if (!isLockedOut)
            return null;

        if (accessFailedCount > 0)
            return "failed_login_attempts";

        return "lockout";
    }
}

public sealed record AdminUserListItemDto(
    string UserId,
    string? Email,
    string? UserName,
    string[] Roles,
    bool IsActive,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    int AccessFailedCount,
    bool EmailConfirmed,
    string? LockoutReason
);

public sealed record AdminUserPagedResponse(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    int ActiveUsers,
    int InactiveUsers,
    int HrUsers,
    int AdminUsers,
    int LockedUsers,
    List<AdminUserListItemDto> Items
);

public sealed class SetUserActiveRequest
{
    public bool IsActive { get; set; }
}

public sealed class SetUserRolesRequest
{
    public string[] Roles { get; set; } = Array.Empty<string>();
}

public sealed record AdminUserDetailsDto(
    string UserId,
    string? Email,
    string? UserName,
    string? PhoneNumber,
    bool EmailConfirmed,
    string[] Roles,
    bool IsActive,
    bool IsLockedOut,
    DateTimeOffset? LockoutEnd,
    int AccessFailedCount,
    string? LockoutReason,
    string? PhotoUrl
);