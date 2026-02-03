using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.Entities;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;

    public string CreatedByUserId { get; set; } = null!;
    public ApplicationUser CreatedByUser { get; set; } = null!;

    public ICollection<ProjectAssignment> Assignments { get; set; } = new List<ProjectAssignment>();
}