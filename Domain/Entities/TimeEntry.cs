using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.Entities;

public class TimeEntry
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string UserId { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;

    public DateTime StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
}