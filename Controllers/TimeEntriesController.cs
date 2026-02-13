using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    [Authorize(Policy = Policies.EmployeeOnly)]
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
    [Authorize(Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<TimeEntryDto>> Start([FromBody] StartTimeEntryRequest req)
    {
        var userId = User.GetUserIdOrThrow();

        var projectExists = await _db.Projects
            .AsNoTracking()
            .AnyAsync(p => p.Id == req.ProjectId);

        if (!projectExists)
            return NotFound("Project not found.");

        var assigned = await _db.ProjectAssignments
            .AsNoTracking()
            .AnyAsync(x => x.ProjectId == req.ProjectId && x.UserId == userId);

        if (!assigned)
            return Forbid();

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

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // ha DB-szinten is bevezetjük az egy-futó-entry szabályt (unique filtered index),
            // akkor itt jöhet a "race condition" elleni védelem
            return BadRequest("You already have a running time entry.");
        }

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, entry.StartUtc, entry.EndUtc));
    }

    // POST api/timeentries/{id}/stop
    [HttpPost("{id:int}/stop")]
    [Authorize(Policy = Policies.EmployeeOnly)]
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

        return Ok(new TimeEntryDto(entry.Id, entry.ProjectId, entry.StartUtc, entry.EndUtc));
    }

    // DELETE api/timeentries/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Policy = Policies.EmployeeOnly)]
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
    [Authorize(Policy = Policies.HrOnly)]
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
            .Select(x => new TimeEntryDto(
                x.Id,
                x.ProjectId,
                x.StartUtc,
                x.EndUtc
            ))
            .ToListAsync();

        return Ok(list);
    }
}

public record StartTimeEntryRequest(int ProjectId);

public record TimeEntryDto(
    int Id,
    int ProjectId,
    DateTime StartUtc,
    DateTime? EndUtc
);