using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Domain.TimeTracking;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/hr")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
public class HrController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public HrController(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, area = "hr" });

    [HttpGet("users")]
    public async Task<ActionResult<List<HrUserListItemDto>>> GetUsers()
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderBy(x => x.Email ?? x.UserName ?? x.Id)
            .ToListAsync();

        var userIds = users.Select(x => x.Id).ToArray();
        var roleRows = await _db.UserRoles
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                role => role.Id,
                (ur, role) => new { ur.UserId, role.Name })
            .ToListAsync();

        var rolesByUserId = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .Select(x => x.Name)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .OrderBy(x => x)
                    .ToArray());

        var list = users
            .Select(user => new HrUserListItemDto(
                user.Id,
                user.Email,
                user.UserName,
                rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : Array.Empty<string>()))
            .ToList();

        return Ok(list);
    }

    [HttpGet("users/paged")]
    public async Task<ActionResult<HrPagedResponse<HrUserListItemDto>>> GetUsersPaged(
        [FromQuery] string? q = null,
        [FromQuery] bool assignableOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Users
            .AsNoTracking()
            .AsQueryable();

        if (assignableOnly)
            query = query.Where(x => x.EmploymentActive && x.RegistrationApproved);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var search = q.Trim();
            query = query.Where(x =>
                x.Id.Contains(search)
                || (x.Email != null && x.Email.Contains(search))
                || (x.UserName != null && x.UserName.Contains(search)));
        }

        var totalItems = await query.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)safePageSize));
        if (safePage > totalPages)
            safePage = totalPages;

        var users = await query
            .OrderBy(x => x.Email ?? x.UserName ?? x.Id)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync();

        var userIds = users.Select(x => x.Id).ToArray();
        var roleRows = await _db.UserRoles
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .Join(_db.Roles.AsNoTracking(),
                ur => ur.RoleId,
                role => role.Id,
                (ur, role) => new { ur.UserId, role.Name })
            .ToListAsync();

        var rolesByUserId = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .Select(x => x.Name)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .OrderBy(x => x)
                    .ToArray());

        var items = users
            .Select(user => new HrUserListItemDto(
                user.Id,
                user.Email,
                user.UserName,
                rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : Array.Empty<string>()))
            .ToList();

        return Ok(new HrPagedResponse<HrUserListItemDto>(
            safePage,
            safePageSize,
            totalItems,
            totalPages,
            items));
    }

    [HttpPut("users/{userId}/employment-active")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<IActionResult> SetEmploymentActive([FromRoute] string userId, [FromBody] HrSetEmploymentActiveRequest request)
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

        return Ok(new { ok = true, userId = user.Id, isActive = user.EmploymentActive });
    }

    [HttpGet("registration-requests")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<ActionResult<List<HrRegistrationRequestDto>>> GetRegistrationRequests()
    {
        var users = await _db.Users
            .AsNoTracking()
            .Where(x => !x.RegistrationApproved)
            .OrderByDescending(x => x.RegistrationRequestedAtUtc)
            .ThenBy(x => x.Email ?? x.UserName ?? x.Id)
            .Select(x => new HrRegistrationRequestDto(
                x.Id,
                x.Email,
                x.UserName,
                x.EmailConfirmed,
                x.RegistrationRequestedAtUtc))
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("registration-requests/paged")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<ActionResult<HrPagedResponse<HrRegistrationRequestDto>>> GetRegistrationRequestsPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Users
            .AsNoTracking()
            .Where(x => !x.RegistrationApproved);

        var totalItems = await query.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)safePageSize));
        if (safePage > totalPages)
            safePage = totalPages;

        var items = await query
            .OrderByDescending(x => x.RegistrationRequestedAtUtc)
            .ThenBy(x => x.Email ?? x.UserName ?? x.Id)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new HrRegistrationRequestDto(
                x.Id,
                x.Email,
                x.UserName,
                x.EmailConfirmed,
                x.RegistrationRequestedAtUtc))
            .ToListAsync();

        return Ok(new HrPagedResponse<HrRegistrationRequestDto>(
            safePage,
            safePageSize,
            totalItems,
            totalPages,
            items));
    }

    [HttpPost("registration-requests/{userId}/approve")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<IActionResult> ApproveRegistrationRequest([FromRoute] string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return NotFound(new { error = "user_not_found" });

        var targetRoles = await _userManager.GetRolesAsync(user);
        var targetIsAdmin = targetRoles.Any(r => string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase));
        if (targetIsAdmin)
            return Forbid();

        user.RegistrationApproved = true;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                error = "registration_approval_failed",
                details = result.Errors.Select(x => x.Description)
            });
        }

        await _userManager.UpdateSecurityStampAsync(user);
        return Ok(new { ok = true, userId = user.Id, approved = true });
    }

    [HttpPost("registration-requests/{userId}/reject")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<IActionResult> RejectRegistrationRequest([FromRoute] string userId)
    {
        var actorId = User.GetUserIdOrThrow();
        if (string.Equals(actorId, userId, StringComparison.Ordinal))
            return BadRequest(new { error = "self_update_not_allowed", details = new[] { "Saját fiók nem utasítható el ezen a felületen." } });

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return NotFound(new { error = "user_not_found" });

        var targetRoles = await _userManager.GetRolesAsync(user);
        var targetIsAdmin = targetRoles.Any(r => string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase));
        if (targetIsAdmin)
            return Forbid();

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                error = "registration_reject_failed",
                details = result.Errors.Select(x => x.Description)
            });
        }

        return Ok(new { ok = true, userId, rejected = true });
    }

    [HttpGet("manual-time-requests")]
    public async Task<ActionResult<List<HrManualTimeRequestDto>>> GetManualTimeRequests([FromQuery] string? status = "pending")
    {
        var query = _db.ManualTimeEntryRequests
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
                query = query.Where(x => x.Status == ManualTimeEntryRequestStatus.Pending);
            else if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase))
                query = query.Where(x => x.Status == ManualTimeEntryRequestStatus.Approved);
            else if (string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase))
                query = query.Where(x => x.Status == ManualTimeEntryRequestStatus.Rejected);
        }

        var list = await (
            from r in query
            join p in _db.Projects.AsNoTracking() on r.ProjectId equals p.Id
            join u in _db.Users.AsNoTracking() on r.RequesterUserId equals u.Id
            join t in _db.ProjectTasks.AsNoTracking() on r.TaskId equals t.Id into taskJoin
            from task in taskJoin.DefaultIfEmpty()
            orderby r.CreatedAtUtc descending
            select new HrManualTimeRequestDto(
                r.Id,
                r.RequesterUserId,
                u.Email,
                r.ProjectId,
                p.Name,
                r.TaskId,
                task != null ? task.Name : null,
                r.StartUtc,
                r.EndUtc,
                r.Description,
                r.Status.ToString(),
                r.CreatedAtUtc,
                r.ReviewerUserId,
                r.ReviewedAtUtc,
                r.ReviewerComment
            ))
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("manual-time-requests/{id:int}/approve")]
    public async Task<IActionResult> ApproveManualTimeRequest(int id, [FromBody] HrReviewRequest? review)
    {
        var reviewerId = User.GetUserIdOrThrow();

        var req = await _db.ManualTimeEntryRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (req is null)
            return NotFound(new { error = "request_not_found" });

        if (req.Status != ManualTimeEntryRequestStatus.Pending)
            return BadRequest(new { error = "already_reviewed", details = new[] { "A kérelem már el lett bírálva." } });

        var assigned = await _db.ProjectAssignments
            .AsNoTracking()
            .Join(
                _db.Projects.AsNoTracking(),
                pa => pa.ProjectId,
                p => p.Id,
                (pa, p) => new { pa.ProjectId, pa.UserId, p.IsActive })
            .AnyAsync(x => x.ProjectId == req.ProjectId && x.UserId == req.RequesterUserId && x.IsActive);

        if (!assigned)
            return BadRequest(new { error = "project_not_assignable", details = new[] { "A felhasználó már nincs aktív projekthez rendelve vagy a projekt inaktív." } });

        var hasOverlap = await _db.TimeEntries
            .AnyAsync(x =>
                x.OwnerUserId == req.RequesterUserId &&
                x.StartUtc < req.EndUtc &&
                (x.EndUtc ?? DateTime.MaxValue) > req.StartUtc);

        if (hasOverlap)
            return BadRequest(new { error = "overlap", details = new[] { "A kérés időintervalluma már átfed meglévő bejegyzéssel." } });

        var validTask = await _db.ProjectTasks
            .AsNoTracking()
            .AnyAsync(x => x.Id == req.TaskId && x.ProjectId == req.ProjectId);

        if (!validTask)
            return BadRequest(new { error = "task_not_found", details = new[] { "A kérelemhez tartozó feladat már nem érvényes ehhez a projekthez." } });

        var entry = new TimeEntry
        {
            OwnerUserId = req.RequesterUserId,
            ProjectId = req.ProjectId,
            TaskId = req.TaskId,
            StartUtc = req.StartUtc,
            EndUtc = req.EndUtc,
            Description = req.Description
        };

        _db.TimeEntries.Add(entry);

        req.Status = ManualTimeEntryRequestStatus.Approved;
        req.ReviewerUserId = reviewerId;
        req.ReviewedAtUtc = DateTime.UtcNow;
        req.ReviewerComment = string.IsNullOrWhiteSpace(review?.Comment) ? null : review!.Comment.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { ok = true, requestId = id, status = "Approved", timeEntryId = entry.Id });
    }

    [HttpPost("manual-time-requests/{id:int}/reject")]
    public async Task<IActionResult> RejectManualTimeRequest(int id, [FromBody] HrReviewRequest? review)
    {
        var reviewerId = User.GetUserIdOrThrow();

        var req = await _db.ManualTimeEntryRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (req is null)
            return NotFound(new { error = "request_not_found" });

        if (req.Status != ManualTimeEntryRequestStatus.Pending)
            return BadRequest(new { error = "already_reviewed", details = new[] { "A kérelem már el lett bírálva." } });

        req.Status = ManualTimeEntryRequestStatus.Rejected;
        req.ReviewerUserId = reviewerId;
        req.ReviewedAtUtc = DateTime.UtcNow;
        req.ReviewerComment = string.IsNullOrWhiteSpace(review?.Comment) ? null : review!.Comment.Trim();

        await _db.SaveChangesAsync();
        return Ok(new { ok = true, requestId = id, status = "Rejected" });
    }
}

public record HrReviewRequest(string? Comment);

public record HrManualTimeRequestDto(
    int Id,
    string RequesterUserId,
    string? RequesterEmail,
    int ProjectId,
    string ProjectName,
    int TaskId,
    string? TaskName,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Description,
    string Status,
    DateTime CreatedAtUtc,
    string? ReviewerUserId,
    DateTime? ReviewedAtUtc,
    string? ReviewerComment
);

public record HrUserListItemDto(
    string UserId,
    string? Email,
    string? UserName,
    string[] Roles
);

public record HrRegistrationRequestDto(
    string UserId,
    string? Email,
    string? UserName,
    bool EmailConfirmed,
    DateTimeOffset? RegistrationRequestedAtUtc
);

public sealed class HrSetEmploymentActiveRequest
{
    public bool IsActive { get; set; }
}

public sealed record HrPagedResponse<T>(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    IReadOnlyList<T> Items
);
