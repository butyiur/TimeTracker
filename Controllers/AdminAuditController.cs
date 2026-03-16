using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Contracts.Audit;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/admin/audit")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminAuditController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public AdminAuditController(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
    [FromQuery] DateTime? fromUtc,
    [FromQuery] DateTime? toUtc,
    [FromQuery] string? eventType,
    [FromQuery] string? userId,
    [FromQuery] string? result,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 50)
    {
        if (!await IsAdminAsync()) return Forbid();

        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 50;

        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        // Default: last 7 days if nothing specified
        if (!fromUtc.HasValue && !toUtc.HasValue)
        {
            var defaultFrom = DateTime.UtcNow.AddDays(-7);
            query = query.Where(x => x.TimestampUtc >= defaultFrom);
        }

        if (fromUtc.HasValue)
            query = query.Where(x => x.TimestampUtc >= fromUtc.Value);

        if (toUtc.HasValue)
            query = query.Where(x => x.TimestampUtc <= toUtc.Value);

        if (!string.IsNullOrWhiteSpace(eventType))
        {
            var term = eventType.Trim();

            if (term.EndsWith("*", StringComparison.Ordinal))
            {
                var prefix = term[..^1];
                if (!string.IsNullOrWhiteSpace(prefix))
                    query = query.Where(x => x.EventType.StartsWith(prefix));
            }
            else if (term.EndsWith(".", StringComparison.Ordinal))
            {
                query = query.Where(x => x.EventType.StartsWith(term));
            }
            else
            {
                query = query.Where(x => x.EventType == term);
            }
        }

        if (!string.IsNullOrWhiteSpace(userId))
            query = query.Where(x => x.UserId == userId);

        if (!string.IsNullOrWhiteSpace(result))
            query = query.Where(x => x.Result == result);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(x => x.TimestampUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditLogDto
            {
                Id = x.Id,
                TimestampUtc = x.TimestampUtc,
                EventType = x.EventType,
                Result = x.Result,
                UserId = x.UserId,
                UserEmail = x.UserEmail,
                IpAddress = x.IpAddress,
                CorrelationId = x.CorrelationId,
                DataJson = x.DataJson
            })
            .ToListAsync();

        return Ok(new PagedAuditResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            Items = items
        });
    }

    private async Task<bool> IsAdminAsync()
    {
        var userId = User.GetUserIdOrThrow();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return false;

        return await _userManager.IsInRoleAsync(user, Roles.Admin);
    }
}