using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Contracts.Reports;
using TimeTracker.Api.Data;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public ReportsController(ApplicationDbContext db) => _db = db;

    // GET /api/reports/timeentries?from=...&to=...&projectId=1&userId=...&includeRunning=true
    [HttpGet("timeentries")]
    public async Task<ActionResult<List<TimeEntryReportRow>>> GetTimeEntries(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? projectId,
        [FromQuery] int? taskId,
        [FromQuery] string? userId,
        [FromQuery] bool includeRunning = false)
    {
        var (fromUtc, toUtc, error) = ParseRange(from, to);
        if (error is not null) return BadRequest(error);

        var q =
            from te in _db.TimeEntries.AsNoTracking()
            join p in _db.Projects.AsNoTracking() on te.ProjectId equals p.Id
            join t in _db.ProjectTasks.AsNoTracking() on te.TaskId equals t.Id into taskJoin
            from task in taskJoin.DefaultIfEmpty()
            join u in _db.Users.AsNoTracking() on te.OwnerUserId equals u.Id
            select new { te, p, task, u };

        if (projectId is not null)
            q = q.Where(x => x.p.Id == projectId.Value);

        if (taskId is not null)
            q = q.Where(x => x.te.TaskId == taskId.Value);

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
                x.te.TaskId,
                x.task != null ? x.task.Name : null,
                x.u.Id,
                x.u.Email ?? x.u.UserName ?? x.u.Id,
                x.te.StartUtc,
                x.te.EndUtc,
                x.te.EndUtc == null
                    ? null
                    : EF.Functions.DateDiffMinute(x.te.StartUtc, x.te.EndUtc.Value)
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
    [FromQuery] int? taskId,
    [FromQuery] string? userId)
    {
        var (fromUtc, toUtc, error) = ParseRange(from, to);
        if (error is not null)
            return BadRequest(error);

        var q =
            from te in _db.TimeEntries.AsNoTracking()
            where te.EndUtc != null
            join p in _db.Projects.AsNoTracking() on te.ProjectId equals p.Id
            join t in _db.ProjectTasks.AsNoTracking() on te.TaskId equals t.Id into taskJoin
            from task in taskJoin.DefaultIfEmpty()
            join u in _db.Users.AsNoTracking() on te.OwnerUserId equals u.Id
            select new
            {
                te.ProjectId,
                ProjectName = p.Name,
                te.TaskId,
                TaskName = task != null ? task.Name : null,
                UserId = u.Id,
                UserEmail = u.Email ?? u.UserName ?? u.Id,
                te.StartUtc,
                te.EndUtc
            };

        if (projectId is not null)
            q = q.Where(x => x.ProjectId == projectId.Value);

        if (taskId is not null)
            q = q.Where(x => x.TaskId == taskId.Value);

        if (!string.IsNullOrWhiteSpace(userId))
            q = q.Where(x => x.UserId == userId);

        if (fromUtc is not null)
            q = q.Where(x => x.StartUtc >= fromUtc.Value);

        if (toUtc is not null)
            q = q.Where(x => x.StartUtc < toUtc.Value);

        var rawData = await q.ToListAsync();

        var result = rawData
            .GroupBy(x => new
            {
                x.ProjectId,
                x.ProjectName,
                x.TaskId,
                x.TaskName,
                x.UserId,
                x.UserEmail
            })
            .Select(g => new TimeEntrySummaryRow(
                g.Key.ProjectId,
                g.Key.ProjectName,
                g.Key.TaskId,
                g.Key.TaskName,
                g.Key.UserId,
                g.Key.UserEmail,
                g.Sum(e =>
                    (int)Math.Round(
                        (e.EndUtc!.Value - e.StartUtc).TotalMinutes))
            ))
            .OrderBy(x => x.ProjectName)
            .ThenBy(x => x.TaskName)
            .ThenBy(x => x.UserEmail)
            .ToList();

        return Ok(result);
    }

    // GET /api/reports/export.csv?from=...&to=...&projectId=...&userId=...&includeRunning=true
    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? projectId,
        [FromQuery] int? taskId,
        [FromQuery] string? userId,
        [FromQuery] bool includeRunning = false)
    {
        var res = await GetTimeEntries(from, to, projectId, taskId, userId, includeRunning);
        if (res.Result is BadRequestObjectResult bad) return bad;

        var list = ExtractActionResultValue(res) ?? new List<TimeEntryReportRow>();

        var sb = new StringBuilder();
        sb.AppendLine("sep=,");
        sb.AppendLine("EntryId,ProjectId,ProjectName,TaskId,TaskName,UserId,UserEmail,StartUtc,EndUtc,DurationMinutes");

        foreach (var r in list)
        {
            sb.AppendLine(string.Join(",",
                r.Id,
                r.ProjectId,
                Csv(r.ProjectName),
                r.TaskId?.ToString() ?? "",
                Csv(r.TaskName),
                Csv(r.UserId),
                Csv(r.UserEmail),
                r.StartUtc.ToString("O"),
                r.EndUtc?.ToString("O") ?? "",
                r.DurationMinutes?.ToString() ?? ""
            ));
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()),
            "text/csv; charset=utf-8",
            "timetracker-export.csv");
    }

    // GET /api/reports/export.xlsx?from=...&to=...&projectId=...&userId=...&includeRunning=true
    [HttpGet("export.xlsx")]
    public async Task<IActionResult> ExportXlsx(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] int? projectId,
        [FromQuery] int? taskId,
        [FromQuery] string? userId,
        [FromQuery] bool includeRunning = false)
    {
        var entriesResult = await GetTimeEntries(from, to, projectId, taskId, userId, includeRunning);
        if (entriesResult.Result is BadRequestObjectResult entriesBad)
            return entriesBad;

        var summaryResult = await GetSummary(from, to, projectId, taskId, userId);
        if (summaryResult.Result is BadRequestObjectResult summaryBad)
            return summaryBad;

        var entries = ExtractActionResultValue(entriesResult) ?? new List<TimeEntryReportRow>();
        var summary = ExtractActionResultValue(summaryResult) ?? new List<TimeEntrySummaryRow>();

        using var workbook = new XLWorkbook();

        var entriesSheet = workbook.Worksheets.Add("Entries");
        entriesSheet.Cell(1, 1).Value = "EntryId";
        entriesSheet.Cell(1, 2).Value = "ProjectId";
        entriesSheet.Cell(1, 3).Value = "ProjectName";
        entriesSheet.Cell(1, 4).Value = "TaskId";
        entriesSheet.Cell(1, 5).Value = "TaskName";
        entriesSheet.Cell(1, 6).Value = "UserId";
        entriesSheet.Cell(1, 7).Value = "UserEmail";
        entriesSheet.Cell(1, 8).Value = "StartUtc";
        entriesSheet.Cell(1, 9).Value = "EndUtc";
        entriesSheet.Cell(1, 10).Value = "DurationMinutes";

        for (var i = 0; i < entries.Count; i++)
        {
            var row = i + 2;
            var item = entries[i];

            entriesSheet.Cell(row, 1).Value = item.Id;
            entriesSheet.Cell(row, 2).Value = item.ProjectId;
            entriesSheet.Cell(row, 3).Value = item.ProjectName;
            entriesSheet.Cell(row, 4).Value = item.TaskId;
            entriesSheet.Cell(row, 5).Value = item.TaskName;
            entriesSheet.Cell(row, 6).Value = item.UserId;
            entriesSheet.Cell(row, 7).Value = item.UserEmail;
            entriesSheet.Cell(row, 8).Value = item.StartUtc.ToString("O");
            entriesSheet.Cell(row, 9).Value = item.EndUtc?.ToString("O") ?? "";
            entriesSheet.Cell(row, 10).Value = item.DurationMinutes;
        }

        var summarySheet = workbook.Worksheets.Add("Summary");
        summarySheet.Cell(1, 1).Value = "ProjectId";
        summarySheet.Cell(1, 2).Value = "ProjectName";
        summarySheet.Cell(1, 3).Value = "TaskId";
        summarySheet.Cell(1, 4).Value = "TaskName";
        summarySheet.Cell(1, 5).Value = "UserId";
        summarySheet.Cell(1, 6).Value = "UserEmail";
        summarySheet.Cell(1, 7).Value = "TotalMinutes";
        summarySheet.Cell(1, 8).Value = "TotalHours";

        for (var i = 0; i < summary.Count; i++)
        {
            var row = i + 2;
            var item = summary[i];

            summarySheet.Cell(row, 1).Value = item.ProjectId;
            summarySheet.Cell(row, 2).Value = item.ProjectName;
            summarySheet.Cell(row, 3).Value = item.TaskId;
            summarySheet.Cell(row, 4).Value = item.TaskName;
            summarySheet.Cell(row, 5).Value = item.UserId;
            summarySheet.Cell(row, 6).Value = item.UserEmail;
            summarySheet.Cell(row, 7).Value = item.TotalMinutes;
            summarySheet.Cell(row, 8).Value = Math.Round(item.TotalMinutes / 60.0, 2);
        }

        entriesSheet.Columns().AdjustToContents();
        summarySheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "timetracker-export.xlsx");
    }

    private static string Csv(string? s)
    {
        s ??= "";
        var needsQuotes = s.Contains(',') || s.Contains('"') || s.Contains('\n') || s.Contains('\r');
        return needsQuotes ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;
    }

    private static T? ExtractActionResultValue<T>(ActionResult<T> result)
    {
        if (result.Value is not null)
            return result.Value;

        if (result.Result is OkObjectResult ok && ok.Value is T typed)
            return typed;

        if (result.Result is ObjectResult obj && obj.Value is T objectTyped)
            return objectTyped;

        return default;
    }

    private static (DateTime? fromUtc, DateTime? toUtc, string? error) ParseRange(string? from, string? to)
    {
        DateTime? f = null;
        DateTime? t = null;

        if (!string.IsNullOrWhiteSpace(from))
        {
            if (!DateTimeOffset.TryParse(from, CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dto))
                return (null, null, "Invalid 'from' date. Use ISO 8601, e.g. 2026-02-16T15:16:41Z");

            f = dto.UtcDateTime;
        }

        if (!string.IsNullOrWhiteSpace(to))
        {
            if (!DateTimeOffset.TryParse(to, CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dto))
                return (null, null, "Invalid 'to' date. Use ISO 8601, e.g. 2026-02-16T18:00:00Z");

            t = dto.UtcDateTime;
        }

        if (f is not null && t is not null && f >= t)
            return (null, null, "'from' must be earlier than 'to'.");

        return (f, t, null);
    }
}