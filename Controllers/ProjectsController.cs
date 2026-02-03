using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Contracts.Projects;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public ProjectsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<List<Project>> Get() =>
        await _db.Projects.AsNoTracking().OrderBy(x => x.Id).ToListAsync();

    [HttpGet("{id:int}")]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<ActionResult<Project>> GetById(int id)
    {
        var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(p);
    }

    [HttpPost]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<ActionResult<Project>> Create([FromBody] CreateProjectRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Name is required.");

        var hrUserId = User.GetUserIdOrThrow();

        var p = new Project
        {
            Name = input.Name.Trim(),
            CreatedByUserId = hrUserId
        };

        _db.Projects.Add(p);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = p.Id }, p);
    }

    public record AssignUserRequest(string UserId);

    [HttpPost("{id:int}/assign")]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserId))
            return BadRequest("UserId is required.");

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == id);
        if (!projectExists) return NotFound("Project not found.");

        var userExists = await _db.Users.AnyAsync(u => u.Id == req.UserId);
        if (!userExists) return BadRequest("User not found.");

        var already = await _db.ProjectAssignments.AnyAsync(x => x.ProjectId == id && x.UserId == req.UserId);
        if (already) return Ok("Already assigned.");

        _db.ProjectAssignments.Add(new ProjectAssignment
        {
            ProjectId = id,
            UserId = req.UserId,
            AssignedAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok("Assigned.");
    }

    [HttpPost("{id:int}/unassign")]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<IActionResult> Unassign(int id, [FromBody] AssignUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserId))
            return BadRequest("UserId is required.");

        var row = await _db.ProjectAssignments.FirstOrDefaultAsync(x => x.ProjectId == id && x.UserId == req.UserId);
        if (row is null) return NotFound("Assignment not found.");

        _db.ProjectAssignments.Remove(row);
        await _db.SaveChangesAsync();
        return Ok("Unassigned.");
    }

    [HttpGet("{id:int}/assignees")]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<ActionResult<List<object>>> Assignees(int id)
    {
        var list = await _db.ProjectAssignments
            .AsNoTracking()
            .Where(x => x.ProjectId == id)
            .Join(_db.Users.AsNoTracking(),
                pa => pa.UserId,
                u => u.Id,
                (pa, u) => new { u.Id, u.Email, pa.AssignedAtUtc })
            .OrderBy(x => x.Email)
            .ToListAsync();

        return Ok(list);
    }
}