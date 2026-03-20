namespace TimeTracker.Api.Domain.TimeTracking;

public enum ManualTimeEntryRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public class ManualTimeEntryRequest
{
    public int Id { get; set; }

    public string RequesterUserId { get; set; } = null!;
    public int ProjectId { get; set; }
    public int TaskId { get; set; }
    public ProjectTask? Task { get; set; }

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string? Description { get; set; }

    public ManualTimeEntryRequestStatus Status { get; set; } = ManualTimeEntryRequestStatus.Pending;
    public string? ReviewerUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewerComment { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
