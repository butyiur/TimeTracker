using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/timeentries")]
[Authorize(Policy = Policies.EmployeeOnly)]
public class TimeEntriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public TimeEntriesController(ApplicationDbContext db) => _db = db;

    // GET api/timeentries/mine
    [HttpGet("mine")]
    public async Task<ActionResult<List<TimeEntryDto>>> GetMine()
    {
        var userId = User.GetUserIdOrThrow();

        var list = await _db.TimeEntries
            .AsNoTracking()
            .Where(x => x.OwnerUserId == userId)
            .OrderByDescending(x => x.StartUtc)
            .Select(x => new TimeEntryDto(
                x.Id,
                x.ProjectId,
                x.StartUtc,
                x.EndUtc
            ))
            .ToListAsync();

        return Ok(list);
    }

    // POST api/timeentries/start
    [HttpPost("start")]
    public async Task<ActionResult<TimeEntryDto>> Start([FromBody] StartTimeEntryRequest req)
    {
        var userId = User.GetUserIdOrThrow();

        var projectOk = await _db.Projects
            .AsNoTracking()
            .AnyAsync(p => p.Id == req.ProjectId && p.OwnerUserId == userId);

        if (!projectOk)
            return NotFound();

        var hasRunning = await _db.TimeEntries
            .AnyAsync(x => x.OwnerUserId == userId && x.EndUtc == null);

        if (hasRunning)
            return BadRequest("You already have a running time entry.");

        var entry = new TimeEntry
        {
            ProjectId = req.ProjectId,
            OwnerUserId = userId,
            StartUtc = DateTime.UtcNow
        };

        _db.TimeEntries.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, entry.StartUtc, entry.EndUtc));
    }

    // POST api/timeentries/{id}/stop
    [HttpPost("{id:int}/stop")]
    public async Task<ActionResult<TimeEntryDto>> Stop(int id)
    {
        var userId = User.GetUserIdOrThrow();

        var entry = await _db.TimeEntries
            .FirstOrDefaultAsync(x => x.Id == id && x.OwnerUserId == userId);

        if (entry is null)
            return NotFound();

        if (entry.EndUtc != null)
            return BadRequest("Time entry already stopped.");

        entry.EndUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, entry.StartUtc, entry.EndUtc));
    }
}

public record StartTimeEntryRequest(int ProjectId);

public record TimeEntryDto(
    int Id,
    int ProjectId,
    DateTime StartUtc,
    DateTime? EndUtc
);