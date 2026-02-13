namespace TimeTracker.Api.Domain.TimeTracking;

public enum ApprovalStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public class Approval
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string UserId { get; set; } = default!;
    public DateTime PeriodStartUtc { get; set; }
    public DateTime PeriodEndUtc { get; set; }

    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    public string? DecidedByUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? Comment { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}