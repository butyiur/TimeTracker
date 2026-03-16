using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using System.Security.Claims;
using System.Text.Json;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Contracts.Projects;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.TimeTracking;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public ProjectsController(ApplicationDbContext db) => _db = db;

    [HttpGet("mine")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOnly)]
    public async Task<ActionResult<List<MyProjectDto>>> GetMine()
    {
        var userId = User.GetUserIdOrThrow();

        var list = await _db.ProjectAssignments
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Join(
                _db.Projects.AsNoTracking(),
                pa => pa.ProjectId,
                p => p.Id,
                (pa, p) => new { p.Id, p.Name, p.IsActive })
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new MyProjectDto(x.Id, x.Name))
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<List<ProjectListItemResponse>> Get() =>
    await _db.Projects
            .AsNoTracking()
            .OrderBy(x => x.Id)
            .Select(x => new ProjectListItemResponse
            {
                Id = x.Id,
                Name = x.Name,
                IsActive = x.IsActive,
                PlannedHours = x.PlannedHours,
                CreatedByUserId = x.CreatedByUserId
            })
            .ToListAsync();

    [HttpGet("paged")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectsPagedResponse<ProjectListItemResponse>>> GetPaged(
        [FromQuery] string? q = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Projects
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var search = q.Trim();
            query = query.Where(x =>
                x.Name.Contains(search)
                || x.Id.ToString().Contains(search));
        }

        var totalItems = await query.CountAsync();
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)safePageSize));
        if (safePage > totalPages)
            safePage = totalPages;

        var items = await query
            .OrderByDescending(x => x.Id)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new ProjectListItemResponse
            {
                Id = x.Id,
                Name = x.Name,
                IsActive = x.IsActive,
                PlannedHours = x.PlannedHours,
                CreatedByUserId = x.CreatedByUserId
            })
            .ToListAsync();

        return Ok(new ProjectsPagedResponse<ProjectListItemResponse>(
            safePage,
            safePageSize,
            totalItems,
            totalPages,
            items));
    }

    [HttpGet("{id:int}")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectResponse>> GetById(int id)
    {
        var p = await _db.Projects
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new ProjectResponse
            {
                Id = x.Id,
                Name = x.Name,
                IsActive = x.IsActive,
                PlannedHours = x.PlannedHours,
                CreatedByUserId = x.CreatedByUserId
            })
            .FirstOrDefaultAsync();

        return p is null ? NotFound() : Ok(p);
    }

    [HttpPost]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectResponse>> Create([FromBody] CreateProjectRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Name is required.");

        var projectName = input.Name.Trim();

        var duplicate = await _db.Projects
            .AsNoTracking()
            .AnyAsync(x => x.Name == projectName);

        if (duplicate)
            return Conflict(new { error = "project_name_exists", details = new[] { "Már létezik ilyen nevű projekt." } });

        var hrUserId = User.GetUserIdOrThrow();

        var creatorExists = await _db.Users
            .AsNoTracking()
            .AnyAsync(x => x.Id == hrUserId);

        if (!creatorExists)
        {
            var emailOrName =
                User.FindFirst(OpenIddictConstants.Claims.Email)?.Value
                ?? User.FindFirst(ClaimTypes.Email)?.Value
                ?? User.FindFirst(OpenIddictConstants.Claims.Name)?.Value
                ?? User.Identity?.Name;

            if (!string.IsNullOrWhiteSpace(emailOrName))
            {
                var resolved = await _db.Users
                    .AsNoTracking()
                    .Where(x => x.Email == emailOrName || x.UserName == emailOrName)
                    .Select(x => x.Id)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrWhiteSpace(resolved))
                    hrUserId = resolved;
            }
        }

        var validCreatorId = await _db.Users
            .AsNoTracking()
            .AnyAsync(x => x.Id == hrUserId);

        if (!validCreatorId)
            return BadRequest(new { error = "creator_user_not_found", details = new[] { "A bejelentkezett felhasználó nem található az adatbázisban, ezért a projekt nem hozható létre." } });

        var p = new Project
        {
            Name = projectName,
            IsActive = true,
            PlannedHours = NormalizePlannedHours(input.PlannedHours),
            CreatedByUserId = hrUserId
        };

        _db.Projects.Add(p);
        await _db.SaveChangesAsync();

        var dto = new ProjectResponse
        {
            Id = p.Id,
            Name = p.Name,
            IsActive = p.IsActive,
            PlannedHours = p.PlannedHours,
            CreatedByUserId = p.CreatedByUserId
        };

        return CreatedAtAction(nameof(GetById), new { id = p.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectResponse>> Update(int id, [FromBody] UpdateProjectRequest input)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id);
        if (project is null) return NotFound("Project not found.");

        if (!string.IsNullOrWhiteSpace(input.Name))
        {
            var normalizedName = input.Name.Trim();
            var duplicate = await _db.Projects
                .AsNoTracking()
                .AnyAsync(x => x.Id != id && x.Name == normalizedName);

            if (duplicate)
                return Conflict(new { error = "project_name_exists", details = new[] { "Már létezik ilyen nevű projekt." } });

            project.Name = normalizedName;
        }

        if (input.PlannedHours.HasValue)
            project.PlannedHours = NormalizePlannedHours(input.PlannedHours);

        if (input.IsActive.HasValue)
            project.IsActive = input.IsActive.Value;

        await _db.SaveChangesAsync();

        return Ok(new ProjectResponse
        {
            Id = project.Id,
            Name = project.Name,
            IsActive = project.IsActive,
            PlannedHours = project.PlannedHours,
            CreatedByUserId = project.CreatedByUserId
        });
    }

    public record AssignUserRequest(string UserId);

    [HttpPost("{id:int}/assign")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserId))
            return BadRequest("UserId is required.");

        var projectState = await _db.Projects
            .AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.IsActive })
            .FirstOrDefaultAsync();

        if (projectState is null)
            return NotFound("Project not found.");

        if (!projectState.IsActive)
            return BadRequest(new { error = "project_inactive", details = new[] { "Inaktív projekthez nem rendelhető felhasználó." } });

        var userState = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == req.UserId)
            .Select(u => new { u.Id, u.EmploymentActive, u.RegistrationApproved })
            .FirstOrDefaultAsync();

        if (userState is null)
            return BadRequest(new { error = "user_not_found", details = new[] { "A felhasználó nem található." } });

        if (!userState.EmploymentActive || !userState.RegistrationApproved)
            return BadRequest(new
            {
                error = "user_not_assignable",
                details = new[] { "Csak aktív és jóváhagyott foglalkoztatási státuszú felhasználó rendelhető projekthez." }
            });

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
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
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
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
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

    [HttpGet("{id:int}/tasks")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.EmployeeOrHrOrAdmin)]
    public async Task<ActionResult<List<ProjectTaskResponse>>> GetTasks(int id)
    {
        var projectExists = await _db.Projects.AnyAsync(x => x.Id == id);
        if (!projectExists) return NotFound("Project not found.");

        var isHrOrAdmin = HasAnyRole(User, Roles.HR, Roles.Admin);
        if (!isHrOrAdmin)
        {
            var userId = User.GetUserIdOrThrow();
            var assigned = await _db.ProjectAssignments
                .AsNoTracking()
                .AnyAsync(x => x.ProjectId == id && x.UserId == userId);

            if (!assigned)
                return Forbid();
        }

        var list = await _db.ProjectTasks
            .AsNoTracking()
            .Where(x => x.ProjectId == id)
            .OrderBy(x => x.Name)
            .Select(x => new ProjectTaskResponse
            {
                Id = x.Id,
                ProjectId = x.ProjectId,
                Name = x.Name,
                IsActive = x.IsActive,
                PlannedHours = x.PlannedHours,
                CreatedAtUtc = x.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(list);
    }

    private static bool HasAnyRole(ClaimsPrincipal user, params string[] roles)
    {
        foreach (var role in roles)
        {
            if (user.IsInRole(role))
                return true;

            if (user.Claims.Any(c =>
                (string.Equals(c.Type, "role", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Type, "roles", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase)) &&
                ClaimContainsRole(c.Value, role)))
            {
                return true;
            }
        }

        return false;
    }

    private static bool ClaimContainsRole(string? rawValue, string expectedRole)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
            return false;

        if (string.Equals(rawValue, expectedRole, StringComparison.OrdinalIgnoreCase))
            return true;

        var trimmed = rawValue.Trim();

        if (trimmed.StartsWith("["))
        {
            try
            {
                var values = JsonSerializer.Deserialize<string[]>(trimmed);
                if (values?.Any(v => string.Equals(v, expectedRole, StringComparison.OrdinalIgnoreCase)) == true)
                    return true;
            }
            catch
            {
            }
        }

        var parts = trimmed.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Any(v => string.Equals(v, expectedRole, StringComparison.OrdinalIgnoreCase));
    }

    [HttpPost("{id:int}/tasks")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectTaskResponse>> CreateTask(int id, [FromBody] CreateProjectTaskRequest input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Task name is required.");

        var projectExists = await _db.Projects.AnyAsync(x => x.Id == id);
        if (!projectExists) return NotFound("Project not found.");

        var task = new ProjectTask
        {
            ProjectId = id,
            Name = input.Name.Trim(),
            IsActive = true,
            PlannedHours = NormalizePlannedHours(input.PlannedHours)
        };

        _db.ProjectTasks.Add(task);
        await _db.SaveChangesAsync();

        return Ok(new ProjectTaskResponse
        {
            Id = task.Id,
            ProjectId = task.ProjectId,
            Name = task.Name,
            IsActive = task.IsActive,
            PlannedHours = task.PlannedHours,
            CreatedAtUtc = task.CreatedAtUtc
        });
    }

    [HttpPut("tasks/{taskId:int}")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, Policy = Policies.HrOrAdmin)]
    public async Task<ActionResult<ProjectTaskResponse>> UpdateTask(int taskId, [FromBody] UpdateProjectTaskRequest input)
    {
        var task = await _db.ProjectTasks.FirstOrDefaultAsync(x => x.Id == taskId);
        if (task is null) return NotFound("Task not found.");

        if (!string.IsNullOrWhiteSpace(input.Name))
            task.Name = input.Name.Trim();

        if (input.IsActive.HasValue)
            task.IsActive = input.IsActive.Value;

        if (input.PlannedHours.HasValue)
            task.PlannedHours = NormalizePlannedHours(input.PlannedHours);

        await _db.SaveChangesAsync();

        return Ok(new ProjectTaskResponse
        {
            Id = task.Id,
            ProjectId = task.ProjectId,
            Name = task.Name,
            IsActive = task.IsActive,
            PlannedHours = task.PlannedHours,
            CreatedAtUtc = task.CreatedAtUtc
        });
    }

    private static int? NormalizePlannedHours(int? hours)
    {
        if (!hours.HasValue) return null;
        if (hours.Value <= 0) return null;
        return Math.Min(hours.Value, 100_000);
    }
}

public sealed record MyProjectDto(int Id, string Name);

public sealed class ProjectTaskResponse
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int? PlannedHours { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class CreateProjectTaskRequest
{
    public string Name { get; set; } = string.Empty;
    public int? PlannedHours { get; set; }
}

public sealed class UpdateProjectRequest
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
    public int? PlannedHours { get; set; }
}

public sealed class UpdateProjectTaskRequest
{
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
    public int? PlannedHours { get; set; }
}

public sealed record ProjectsPagedResponse<T>(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    IReadOnlyList<T> Items
);