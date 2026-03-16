namespace TimeTracker.Api.Domain.Entities;

public class AuditLog
{
    public long Id { get; set; }

    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

    public string EventType { get; set; } = null!;      // e.g. auth.login.success
    public string Result { get; set; } = "success";     // success / fail

    public string? UserId { get; set; }
    public string? UserEmail { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public string? CorrelationId { get; set; }          // optional tracing

    public string? DataJson { get; set; }               // optional extra payload
}