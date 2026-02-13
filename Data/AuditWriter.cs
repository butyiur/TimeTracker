using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.TimeTracking;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Data;

public interface IAuditWriter
{
    Task WriteAsync(
        string eventType,
        string result,
        ClaimsPrincipal? user = null,
        string? userEmail = null,
        string? userId = null,
        string? dataJson = null);
}

public sealed class AuditWriter : IAuditWriter
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _http;

    public AuditWriter(ApplicationDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    public async Task WriteAsync(
        string eventType,
        string result,
        ClaimsPrincipal? user = null,
        string? userEmail = null,
        string? userId = null,
        string? dataJson = null)
    {
        var ctx = _http.HttpContext;

        var resolvedUserId =
            userId
            ?? user?.FindFirst(OpenIddict.Abstractions.OpenIddictConstants.Claims.Subject)?.Value
            ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var resolvedEmail =
            userEmail
            ?? user?.FindFirst(ClaimTypes.Email)?.Value
            ?? user?.Identity?.Name;

        var log = new AuditLog
        {
            TimestampUtc = DateTime.UtcNow,
            EventType = eventType,
            Result = result,
            UserId = resolvedUserId,
            UserEmail = resolvedEmail,
            IpAddress = ctx?.Connection?.RemoteIpAddress?.ToString(),
            UserAgent = ctx?.Request?.Headers.UserAgent.ToString(),
            CorrelationId = ctx?.TraceIdentifier,
            DataJson = dataJson
        };

        _db.AuditLogs.Add(log);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // audit log hiba ne ölje meg az auth flow-t
        }
    }
}