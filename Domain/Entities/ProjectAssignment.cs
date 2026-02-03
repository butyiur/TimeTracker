using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.Entities;

public class ProjectAssignment
{
    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string UserId { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;

    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
}