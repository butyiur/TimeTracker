namespace TimeTracker.Api.Contracts.Audit;

public sealed class AuditLogDto
{
    public long Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string EventType { get; set; } = null!;
    public string Result { get; set; } = null!;
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? IpAddress { get; set; }
    public string? CorrelationId { get; set; }
    public string? DataJson { get; set; }
}