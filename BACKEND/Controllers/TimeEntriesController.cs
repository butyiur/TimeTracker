using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.TimeTracking;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/timeentries")]
public class TimeEntriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public TimeEntriesController(ApplicationDbContext db) => _db = db;

    // GET api/timeentries/mine
    [HttpGet("mine")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<List<TimeEntryDto>>> GetMine()
    {
        var userId = User.GetUserIdOrThrow();

        var list = await _db.TimeEntries
            .AsNoTracking()
            .Where(x => x.OwnerUserId == userId)
            .OrderByDescending(x => x.StartUtc)
            .Join(
                _db.Projects.AsNoTracking(),
                te => te.ProjectId,
                p => p.Id,
                (te, p) => new { te, p })
            .Select(x => new TimeEntryDto(
                x.te.Id,
                x.te.ProjectId,
                x.p.Name,
                x.te.TaskId,
                _db.ProjectTasks
                    .AsNoTracking()
                    .Where(t => t.Id == x.te.TaskId)
                    .Select(t => t.Name)
                    .FirstOrDefault(),
                EnsureUtc(x.te.StartUtc),
                EnsureUtc(x.te.EndUtc),
                x.te.Description
            ))
            .ToListAsync();

        return Ok(list);
    }

    // GET api/timeentries/manual-requests/mine?status=pending|approved|rejected|all
    [HttpGet("manual-requests/mine")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<List<ManualTimeEntryRequestDto>>> GetMyManualRequests([FromQuery] string? status = "pending")
    {
        var userId = User.GetUserIdOrThrow();

        var query = _db.ManualTimeEntryRequests
            .AsNoTracking()
            .Where(x => x.RequesterUserId == userId)
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

        var list = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Join(
                _db.Projects.AsNoTracking(),
                r => r.ProjectId,
                p => p.Id,
                (r, p) => new { r, p })
            .Select(x => new ManualTimeEntryRequestDto(
                x.r.Id,
                x.r.ProjectId,
                x.p.Name,
                x.r.TaskId,
                _db.ProjectTasks
                    .AsNoTracking()
                    .Where(t => t.Id == x.r.TaskId)
                    .Select(t => t.Name)
                    .FirstOrDefault(),
                EnsureUtc(x.r.StartUtc),
                EnsureUtc(x.r.EndUtc),
                x.r.Description,
                x.r.Status.ToString(),
                EnsureUtc(x.r.CreatedAtUtc)
            ))
            .ToListAsync();

        return Ok(list);
    }

    // GET api/timeentries/mine/benchmark
    [HttpGet("mine/benchmark")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<MyTimeBenchmarkDto>> GetMyBenchmark()
    {
        var userId = User.GetUserIdOrThrow();
        var nowUtc = DateTime.UtcNow;

        var dayStart = nowUtc.Date;
        var weekStart = StartOfWeekUtc(nowUtc);
        var monthStart = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var yearStart = new DateTime(nowUtc.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var minStart = yearStart;

        var rows = await _db.TimeEntries
            .AsNoTracking()
            .Where(x => x.StartUtc < nowUtc && (x.EndUtc ?? nowUtc) > minStart)
            .Select(x => new BenchmarkEntryRow(x.OwnerUserId, x.StartUtc, x.EndUtc))
            .ToListAsync();

        var day = BuildWindowBenchmark(rows, userId, dayStart, nowUtc);
        var week = BuildWindowBenchmark(rows, userId, weekStart, nowUtc);
        var month = BuildWindowBenchmark(rows, userId, monthStart, nowUtc);
        var year = BuildWindowBenchmark(rows, userId, yearStart, nowUtc);

        return Ok(new MyTimeBenchmarkDto(day, week, month, year));
    }

    // POST api/timeentries/manual-requests
    [HttpPost("manual-requests")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<ManualTimeEntryRequestDto>> CreateManualRequest([FromBody] CreateManualTimeEntryRequest req)
    {
        var userId = User.GetUserIdOrThrow();

        if (req.EndUtc <= req.StartUtc)
            return BadRequest(new { error = "invalid_interval", details = new[] { "A befejezés későbbi legyen, mint a kezdés." } });

        var now = DateTime.UtcNow;
        if (req.EndUtc > now || req.StartUtc > now)
            return BadRequest(new { error = "future_not_allowed", details = new[] { "Előre nem lehet időt rögzíteni." } });

        var minAllowed = now.Date.AddDays(-7);
        if (req.StartUtc < minAllowed)
            return BadRequest(new { error = "too_old", details = new[] { "Csak a mai napra és visszamenőleg 7 napra lehet rögzíteni." } });

        var assigned = await _db.ProjectAssignments
            .AsNoTracking()
            .Join(
                _db.Projects.AsNoTracking(),
                pa => pa.ProjectId,
                p => p.Id,
                (pa, p) => new { pa.ProjectId, pa.UserId, p.IsActive })
            .AnyAsync(x => x.ProjectId == req.ProjectId && x.UserId == userId && x.IsActive);
        if (!assigned)
            return BadRequest(new { error = "project_not_assignable", details = new[] { "Ehhez a projekthez nincs aktív hozzárendelésed vagy a projekt inaktív." } });

        if (!await IsValidTaskForProject(req.TaskId, req.ProjectId, requireActive: true))
            return BadRequest(new { error = "invalid_task", details = new[] { "A kiválasztott feladat nem ehhez a projekthez tartozik vagy nem aktív." } });

        var hasOverlap = await _db.TimeEntries
            .AnyAsync(x =>
                x.OwnerUserId == userId &&
                x.StartUtc < req.EndUtc &&
                (x.EndUtc ?? DateTime.MaxValue) > req.StartUtc);
        if (hasOverlap)
            return BadRequest(new { error = "overlap", details = new[] { "Az időintervallum átfed egy meglévő bejegyzéssel." } });

        var hasPendingOverlap = await _db.ManualTimeEntryRequests
            .AnyAsync(x =>
                x.RequesterUserId == userId &&
                x.Status == ManualTimeEntryRequestStatus.Pending &&
                x.StartUtc < req.EndUtc &&
                x.EndUtc > req.StartUtc);

        if (hasPendingOverlap)
            return BadRequest(new { error = "pending_overlap", details = new[] { "Van már átfedő, függőben lévő manuális kérelmed." } });

        var request = new ManualTimeEntryRequest
        {
            RequesterUserId = userId,
            ProjectId = req.ProjectId,
            TaskId = req.TaskId,
            StartUtc = req.StartUtc,
            EndUtc = req.EndUtc,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim()
        };

        _db.ManualTimeEntryRequests.Add(request);
        await _db.SaveChangesAsync();

        var projectName = await _db.Projects
            .AsNoTracking()
            .Where(x => x.Id == request.ProjectId)
            .Select(x => x.Name)
            .FirstAsync();

        var taskName = request.TaskId is null
            ? null
            : await _db.ProjectTasks
                .AsNoTracking()
                .Where(x => x.Id == request.TaskId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync();

        return Ok(new ManualTimeEntryRequestDto(
            request.Id,
            request.ProjectId,
            projectName,
            request.TaskId,
            taskName,
            EnsureUtc(request.StartUtc),
            EnsureUtc(request.EndUtc),
            request.Description,
            request.Status.ToString(),
            EnsureUtc(request.CreatedAtUtc)
        ));
    }

    // POST api/timeentries/start
    [HttpPost("start")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<TimeEntryDto>> Start([FromBody] StartTimeEntryRequest req)
    {
        var userId = User.GetUserIdOrThrow();

        var projectExists = await _db.Projects
            .AsNoTracking()
            .AnyAsync(p => p.Id == req.ProjectId && p.IsActive);

        if (!projectExists)
            return NotFound("Project not found or inactive.");

        var assigned = await _db.ProjectAssignments
            .AsNoTracking()
            .Join(
                _db.Projects.AsNoTracking(),
                pa => pa.ProjectId,
                p => p.Id,
                (pa, p) => new { pa.ProjectId, pa.UserId, p.IsActive })
            .AnyAsync(x => x.ProjectId == req.ProjectId && x.UserId == userId && x.IsActive);

        if (!assigned)
            return Forbid();

        if (!await IsValidTaskForProject(req.TaskId, req.ProjectId, requireActive: true))
            return BadRequest("Invalid task for selected project.");

        var hasRunning = await _db.TimeEntries
            .AnyAsync(x => x.OwnerUserId == userId && x.EndUtc == null);

        if (hasRunning)
            return BadRequest("You already have a running time entry.");

        var entry = new TimeEntry
        {
            ProjectId = req.ProjectId,
            TaskId = req.TaskId,
            OwnerUserId = userId,
            StartUtc = DateTime.UtcNow
        };

        _db.TimeEntries.Add(entry);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // ha DB-szinten is bevezetj�k az egy-fut�-entry szab�lyt (unique filtered index),
            // akkor itt j�het a "race condition" elleni v�delem
            return BadRequest("You already have a running time entry.");
        }

        var projectName = await _db.Projects
            .AsNoTracking()
            .Where(x => x.Id == entry.ProjectId)
            .Select(x => x.Name)
            .FirstAsync();

        var taskName = entry.TaskId is null
            ? null
            : await _db.ProjectTasks
                .AsNoTracking()
                .Where(x => x.Id == entry.TaskId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync();

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, projectName, entry.TaskId, taskName, EnsureUtc(entry.StartUtc), EnsureUtc(entry.EndUtc), entry.Description));
    }

    // POST api/timeentries/{id}/stop
    [HttpPost("{id:int}/stop")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<TimeEntryDto>> Stop(int id)
    {
        var userId = User.GetUserIdOrThrow();

        var entry = await _db.TimeEntries
            .FirstOrDefaultAsync(x => x.Id == id && x.OwnerUserId == userId);

        if (entry is null)
            return NotFound("Time entry not found.");

        if (entry.EndUtc != null)
            return BadRequest("Time entry already stopped.");

        entry.EndUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var projectName = await _db.Projects
            .AsNoTracking()
            .Where(x => x.Id == entry.ProjectId)
            .Select(x => x.Name)
            .FirstAsync();

        var taskName = entry.TaskId is null
            ? null
            : await _db.ProjectTasks
                .AsNoTracking()
                .Where(x => x.Id == entry.TaskId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync();

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, projectName, entry.TaskId, taskName, EnsureUtc(entry.StartUtc), EnsureUtc(entry.EndUtc), entry.Description));
    }

    // POST api/timeentries/stop-active
    [HttpPost("stop-active")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<TimeEntryDto>> StopActive([FromBody] StopActiveRequest? req)
    {
        var userId = User.GetUserIdOrThrow();

        var entry = await _db.TimeEntries
            .OrderByDescending(x => x.StartUtc)
            .FirstOrDefaultAsync(x => x.OwnerUserId == userId && x.EndUtc == null);

        if (entry is null)
            return NotFound(new { error = "active_not_found" });

        var effectiveProjectId = entry.ProjectId;

        if (req?.ProjectId is int projectId && projectId > 0 && projectId != entry.ProjectId)
        {
            var assigned = await _db.ProjectAssignments
                .AsNoTracking()
                .Join(
                    _db.Projects.AsNoTracking(),
                    pa => pa.ProjectId,
                    p => p.Id,
                    (pa, p) => new { pa.ProjectId, pa.UserId, p.IsActive })
                .AnyAsync(x => x.ProjectId == projectId && x.UserId == userId && x.IsActive);

            if (!assigned)
                return BadRequest(new { error = "project_not_assignable", details = new[] { "Ehhez a projekthez nincs aktív hozzárendelésed vagy a projekt inaktív." } });

            entry.ProjectId = projectId;
            effectiveProjectId = projectId;
        }

        if (req is not null)
        {
            if (!await IsValidTaskForProject(req.TaskId, effectiveProjectId, requireActive: true))
                return BadRequest(new { error = "invalid_task", details = new[] { "A kiválasztott feladat nem ehhez a projekthez tartozik vagy nem aktív." } });

            entry.TaskId = req.TaskId;
        }

        if (req is not null)
        {
            entry.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        }

        entry.EndUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var projectName = await _db.Projects
            .AsNoTracking()
            .Where(x => x.Id == entry.ProjectId)
            .Select(x => x.Name)
            .FirstAsync();

        var taskName = entry.TaskId is null
            ? null
            : await _db.ProjectTasks
                .AsNoTracking()
                .Where(x => x.Id == entry.TaskId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync();

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, projectName, entry.TaskId, taskName, EnsureUtc(entry.StartUtc), EnsureUtc(entry.EndUtc), entry.Description));
    }

    // DELETE api/timeentries/{id}
    [HttpDelete("{id:int}")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.GetUserIdOrThrow();

        var entry = await _db.TimeEntries
            .FirstOrDefaultAsync(x => x.Id == id && x.OwnerUserId == userId);

        if (entry is null)
            return NotFound("Time entry not found.");

        _db.TimeEntries.Remove(entry);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // HR: GET api/timeentries/user/{userId}?fromUtc=...&toUtc=...
    [HttpGet("user/{userId}")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOnly)]
    public async Task<ActionResult<List<TimeEntryDto>>> GetForUser(
        [FromRoute] string userId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc)
    {
        var query = _db.TimeEntries
            .AsNoTracking()
            .Where(x => x.OwnerUserId == userId);

        if (fromUtc.HasValue)
            query = query.Where(x => x.StartUtc >= fromUtc.Value);

        if (toUtc.HasValue)
            query = query.Where(x => x.StartUtc <= toUtc.Value);

        var list = await query
            .OrderByDescending(x => x.StartUtc)
            .Join(
                _db.Projects.AsNoTracking(),
                te => te.ProjectId,
                p => p.Id,
                (te, p) => new { te, p })
            .Select(x => new TimeEntryDto(
                x.te.Id,
                x.te.ProjectId,
                x.p.Name,
                x.te.TaskId,
                _db.ProjectTasks
                    .AsNoTracking()
                    .Where(t => t.Id == x.te.TaskId)
                    .Select(t => t.Name)
                    .FirstOrDefault(),
                EnsureUtc(x.te.StartUtc),
                EnsureUtc(x.te.EndUtc),
                x.te.Description
            ))
            .ToListAsync();

        return Ok(list);
    }

    private Task<bool> IsValidTaskForProject(int? taskId, int projectId, bool requireActive)
    {
        if (taskId is null)
            return Task.FromResult(true);

        return _db.ProjectTasks
            .AsNoTracking()
            .AnyAsync(x => x.Id == taskId.Value && x.ProjectId == projectId && (!requireActive || x.IsActive));
    }

    private static DateTime EnsureUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value
        };
    }

    private static DateTime? EnsureUtc(DateTime? value)
    {
        return value.HasValue ? EnsureUtc(value.Value) : null;
    }

    private static DateTime StartOfWeekUtc(DateTime utcNow)
    {
        var day = utcNow.DayOfWeek;
        var diffToMonday = ((int)day + 6) % 7;
        return utcNow.Date.AddDays(-diffToMonday);
    }

    private static TimeBenchmarkWindowDto BuildWindowBenchmark(
        List<BenchmarkEntryRow> rows,
        string currentUserId,
        DateTime windowStartUtc,
        DateTime windowEndUtc)
    {
        var byUser = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.UserId))
                continue;

            var end = row.EndUtc ?? windowEndUtc;
            var overlapStart = row.StartUtc > windowStartUtc ? row.StartUtc : windowStartUtc;
            var overlapEnd = end < windowEndUtc ? end : windowEndUtc;

            if (overlapEnd <= overlapStart)
                continue;

            var minutes = (int)Math.Round((overlapEnd - overlapStart).TotalMinutes);
            if (minutes <= 0)
                continue;

            if (!byUser.TryGetValue(row.UserId, out var current))
                byUser[row.UserId] = minutes;
            else
                byUser[row.UserId] = current + minutes;
        }

        var userMinutes = byUser.TryGetValue(currentUserId, out var mine) ? mine : 0;
        var population = byUser.Values.Where(x => x > 0).OrderBy(x => x).ToList();

        var sampleSize = population.Count;
        var percentile = 0;

        if (sampleSize > 0)
        {
            var lessOrEqual = population.Count(x => x <= userMinutes);
            percentile = (int)Math.Round((double)lessOrEqual * 100.0 / sampleSize);
            percentile = Math.Clamp(percentile, 0, 100);
        }

        var bucket = percentile < 20
            ? "red"
            : percentile <= 80
                ? "yellow"
                : "green";

        return new TimeBenchmarkWindowDto(userMinutes, percentile, bucket, sampleSize);
    }
}

public record StartTimeEntryRequest(int ProjectId, int? TaskId);

public record CreateManualTimeEntryRequest(
    int ProjectId,
    int? TaskId,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Description
);

public record StopActiveRequest(int? ProjectId, int? TaskId, string? Description);

public record ManualTimeEntryRequestDto(
    int Id,
    int ProjectId,
    string ProjectName,
    int? TaskId,
    string? TaskName,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Description,
    string Status,
    DateTime CreatedAtUtc
);

public record BenchmarkEntryRow(string UserId, DateTime StartUtc, DateTime? EndUtc);

public record TimeBenchmarkWindowDto(
    int Minutes,
    int Percentile,
    string Bucket,
    int SampleSize
);

public record MyTimeBenchmarkDto(
    TimeBenchmarkWindowDto Day,
    TimeBenchmarkWindowDto Week,
    TimeBenchmarkWindowDto Month,
    TimeBenchmarkWindowDto Year
);

public record TimeEntryDto(
    int Id,
    int ProjectId,
    string ProjectName,
    int? TaskId,
    string? TaskName,
    DateTime StartUtc,
    DateTime? EndUtc,
    string? Description
);