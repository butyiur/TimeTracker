namespace TimeTracker.Api.Contracts.Projects;

public sealed class ProjectListItemResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; }
    public int? PlannedHours { get; set; }
    public string CreatedByUserId { get; set; } = null!;
}