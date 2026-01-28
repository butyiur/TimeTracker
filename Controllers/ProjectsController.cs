using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Contracts.Projects;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;
using TimeTracker.Api.Auth;

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

    [HttpPost]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<ActionResult<Project>> Create([FromBody] CreateProjectRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Name is required.");

        if (string.IsNullOrWhiteSpace(input.OwnerUserId))
            return BadRequest("OwnerUserId is required.");

        // ellenõrzés: user létezik
        var exists = await _db.Users.AnyAsync(u => u.Id == input.OwnerUserId);
        if (!exists) return BadRequest("Owner user not found.");

        var p = new Project
        {
            Name = input.Name.Trim(),
            OwnerUserId = input.OwnerUserId
        };

        _db.Projects.Add(p);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = p.Id }, p);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = Policies.HrOnly)]
    public async Task<ActionResult<Project>> GetById(int id)
    {
        var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(p);
    }
}