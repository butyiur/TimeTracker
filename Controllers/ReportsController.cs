using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Contracts.Reports;
using TimeTracker.Api.Data;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Policy = Policies.HrOnly)]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public ReportsController(ApplicationDbContext db) => _db = db;

    // GET /api/reports/timeentries?from=2026-01-01&to=2026-01-31&projectId=1&userId=...&includeRunning=true
    [HttpGet("timeentries")]
    public async Task<ActionResult<List<TimeEntryReportRow>>> GetTimeEntries(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? projectId,
        [FromQuery] string? userId,
        [FromQuery] bool includeRunning = false)
    {
        var (fromUtc, toUtc, bad) = ParseRange(from, to);
        if (bad is not null) return BadRequest(bad);

        var q =
            from te in _db.TimeEntries.AsNoTracking()
            join p in _db.Projects.AsNoTracking() on te.ProjectId equals p.Id
            join u in _db.Users.AsNoTracking() on te.OwnerUserId equals u.Id
            select new { te, p, u };

        if (projectId is not null)
            q = q.Where(x => x.p.Id == projectId.Value);

        if (!string.IsNullOrWhiteSpace(userId))
            q = q.Where(x => x.u.Id == userId);

        if (fromUtc is not null)
            q = q.Where(x => x.te.StartUtc >= fromUtc.Value);

        if (toUtc is not null)
            q = q.Where(x => x.te.StartUtc < toUtc.Value);

        if (!includeRunning)
            q = q.Where(x => x.te.EndUtc != null);

        var list = await q
            .OrderByDescending(x => x.te.StartUtc)
            .Select(x => new TimeEntryReportRow(
                x.te.Id,
                x.p.Id,
                x.p.Name,
                x.u.Id,
                x.u.Email ?? x.u.UserName ?? x.u.Id,
                x.te.StartUtc,
                x.te.EndUtc,
                x.te.EndUtc == null
                    ? null
                    : (int)Math.Round((x.te.EndUtc.Value - x.te.StartUtc).TotalMinutes)
            ))
            .ToListAsync();

        return Ok(list);
    }

    // GET /api/reports/summary?from=2026-01-01&to=2026-01-31&projectId=1&userId=...
    [HttpGet("summary")]
    public async Task<ActionResult<List<TimeEntrySummaryRow>>> GetSummary(
    [FromQuery] string? from,
    [FromQuery] string? to,
    [FromQuery] int? projectId,
    [FromQuery] string? userId)
    {
        var (fromUtc, toUtc, bad) = ParseRange(from, to);
        if (bad is not null) return BadRequest(bad);

        var q =
            from te in _db.TimeEntries.AsNoTracking()
            where te.EndUtc != null
            join p in _db.Projects.AsNoTracking() on te.ProjectId equals p.Id
            join u in _db.Users.AsNoTracking() on te.OwnerUserId equals u.Id
            select new
            {
                te,
                ProjectId = p.Id,
                ProjectName = p.Name,
                UserId = u.Id,
                UserEmail = u.Email ?? u.UserName ?? u.Id
            };

        if (projectId is not null)
            q = q.Where(x => x.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(userId))
            q = q.Where(x => x.UserId == userId);

        if (fromUtc is not null)
            q = q.Where(x => x.te.StartUtc >= fromUtc.Value);

        if (toUtc is not null)
            q = q.Where(x => x.te.StartUtc < toUtc.Value);

        var list = await q
            .Select(x => new
            {
                x.ProjectId,
                x.ProjectName,
                x.UserId,
                x.UserEmail,
                Minutes = (int)Math.Round((x.te.EndUtc!.Value - x.te.StartUtc).TotalMinutes)
            })
            .GroupBy(x => new { x.ProjectId, x.ProjectName, x.UserId, x.UserEmail })
            .Select(g => new TimeEntrySummaryRow(
                g.Key.ProjectId,
                g.Key.ProjectName,
                g.Key.UserId,
                g.Key.UserEmail,
                g.Sum(x => x.Minutes)
            ))
            .OrderBy(x => x.ProjectName)
            .ThenBy(x => x.UserEmail)
            .ToListAsync();

        return Ok(list);
    }

    // GET /api/reports/export.csv?from=...&to=...&projectId=...&userId=...&includeRunning=true
    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? projectId,
        [FromQuery] string? userId,
        [FromQuery] bool includeRunning = false)
    {
        var res = await GetTimeEntries(from, to, projectId, userId, includeRunning);
        if (res.Result is BadRequestObjectResult bad) return bad;

        var list = (res.Value ?? new List<TimeEntryReportRow>());

        var sb = new StringBuilder();
        sb.AppendLine("EntryId,ProjectId,ProjectName,UserId,UserEmail,StartUtc,EndUtc,DurationMinutes");

        foreach (var r in list)
        {
            sb.AppendLine(string.Join(",",
                r.Id,
                r.ProjectId,
                Csv(r.ProjectName),
                Csv(r.UserId),
                Csv(r.UserEmail),
                r.StartUtc.ToString("O"),
                r.EndUtc?.ToString("O") ?? "",
                r.DurationMinutes?.ToString() ?? ""
            ));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv; charset=utf-8", "timetracker-export.csv");
    }

    private static string Csv(string? s)
    {
        s ??= "";
        var needsQuotes = s.Contains(',') || s.Contains('"') || s.Contains('\n') || s.Contains('\r');
        if (!needsQuotes) return s;
        return "\"" + s.Replace("\"", "\"\"") + "\"";
    }

    private static (DateTime? fromUtc, DateTime? toUtc, string? error) ParseRange(string? from, string? to)
    {
        DateTime? f = null;
        DateTime? t = null;

        if (!string.IsNullOrWhiteSpace(from))
        {
            if (!DateTime.TryParse(from, out var tmp))
                return (null, null, "Invalid 'from' date.");
            f = DateTime.SpecifyKind(tmp, DateTimeKind.Utc);
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            if (!DateTime.TryParse(to, out var tmp))
                return (null, null, "Invalid 'to' date.");
            // to exclusive: add 1 day if only date was passed? túl sok okoskodás, marad így.
            t = DateTime.SpecifyKind(tmp, DateTimeKind.Utc);
        }

        if (f is not null && t is not null && f >= t)
            return (null, null, "'from' must be earlier than 'to'.");

        return (f, t, null);
    }
}