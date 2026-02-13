using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.TimeTracking;

public class Project
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    // Ki hozta létre a projektet (tulaj/creator)
    public string CreatedByUserId { get; set; } = null!;
    public ApplicationUser CreatedByUser { get; set; } = null!;

    public ICollection<ProjectAssignment> Assignments { get; set; } = new List<ProjectAssignment>();
}