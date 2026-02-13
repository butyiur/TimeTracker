namespace TimeTracker.Api.Contracts.Projects;

public sealed class ProjectListItemResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string CreatedByUserId { get; set; } = null!;
}