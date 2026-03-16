using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.TimeTracking;

public class Project
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    // Inactive projects stay in history, but cannot be used for new assignments/time logging.
    public bool IsActive { get; set; } = true;

    // Optional high-level project estimate (stored in hours).
    public int? PlannedHours { get; set; }

    // Ki hozta l�tre a projektet (tulaj/creator)
    public string CreatedByUserId { get; set; } = null!;
    public ApplicationUser CreatedByUser { get; set; } = null!;

    public ICollection<ProjectAssignment> Assignments { get; set; } = new List<ProjectAssignment>();
    public ICollection<ProjectTask> Tasks { get; set; } = new List<ProjectTask>();
}