namespace TimeTracker.Api.Domain.TimeTracking;

public class ProjectTask
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    // Optional task-level estimate (stored in hours).
    public int? PlannedHours { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
