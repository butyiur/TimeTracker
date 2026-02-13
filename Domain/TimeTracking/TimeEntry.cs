using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.TimeTracking;

public class TimeEntry
{
    public int Id { get; set; }

    public int ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public string OwnerUserId { get; set; } = null!;
    public ApplicationUser OwnerUser { get; set; } = null!;

    public DateTime StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
}