using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public ProjectsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<List<Project>> Get() =>
        await _db.Projects.AsNoTracking().OrderBy(x => x.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Project>> Create([FromBody] Project input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Name is required.");

        var p = new Project { Name = input.Name.Trim() };
        _db.Projects.Add(p);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = p.Id }, p);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Project>> GetById(int id)
    {
        var p = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(p);
    }
}