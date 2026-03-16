using System.Security.Claims;
using System.Text.Json;
using OpenIddict.Abstractions;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Services;

public sealed class DbAuditWriter : IAuditWriter
{
    private readonly ApplicationDbContext _db;

    public DbAuditWriter(ApplicationDbContext db) => _db = db;

    public async Task WriteAsync(
        string eventType,
        string result,
        ClaimsPrincipal? user,
        HttpContext httpContext,
        string? dataJson = null)
    {
        string? userId =
            user?.FindFirst(OpenIddictConstants.Claims.Subject)?.Value
            ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        string? email =
            user?.FindFirst(OpenIddictConstants.Claims.Email)?.Value
            ?? user?.FindFirst(ClaimTypes.Email)?.Value
            ?? user?.Identity?.Name;

        var ip = httpContext.Connection.RemoteIpAddress?.ToString();
        var ua = httpContext.Request.Headers.UserAgent.ToString();
        var correlationId = httpContext.TraceIdentifier;

        var log = new AuditLog
        {
            TimestampUtc = DateTime.UtcNow,
            EventType = eventType,
            Result = result,
            UserId = userId,
            UserEmail = email,
            IpAddress = ip,
            UserAgent = ua,
            CorrelationId = correlationId,
            DataJson = dataJson
        };

        _db.AuditLogs.Add(log);
        await _db.SaveChangesAsync();
    }
}