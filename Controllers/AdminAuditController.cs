using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/admin/audit")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminAuditController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AdminAuditController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? eventType,
        [FromQuery] string? userId,
        [FromQuery] int take = 100)
    {
        if (take is < 1 or > 500) take = 100;

        var q = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (fromUtc.HasValue) q = q.Where(x => x.TimestampUtc >= fromUtc.Value);
        if (toUtc.HasValue) q = q.Where(x => x.TimestampUtc <= toUtc.Value);
        if (!string.IsNullOrWhiteSpace(eventType)) q = q.Where(x => x.EventType == eventType);
        if (!string.IsNullOrWhiteSpace(userId)) q = q.Where(x => x.UserId == userId);

        var list = await q
            .OrderByDescending(x => x.TimestampUtc)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.TimestampUtc,
                x.EventType,
                x.Result,
                x.UserId,
                x.UserEmail,
                x.IpAddress,
                x.UserAgent,
                x.CorrelationId,
                x.DataJson
            })
            .ToListAsync();

        return Ok(list);
    }
}