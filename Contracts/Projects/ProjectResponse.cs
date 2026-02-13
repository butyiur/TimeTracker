namespace TimeTracker.Api.Contracts.Projects;

public sealed class ProjectResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string CreatedByUserId { get; set; } = null!;
}