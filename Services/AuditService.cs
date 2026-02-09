using System.Text.Json;
using Microsoft.AspNetCore.Http;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Services;

public interface IAuditService
{
    Task WriteAsync(
        string eventType,
        string result,
        string? userId = null,
        string? userEmail = null,
        object? data = null);
}

public sealed class AuditService : IAuditService
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _http;

    public AuditService(ApplicationDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    public async Task WriteAsync(
        string eventType,
        string result,
        string? userId = null,
        string? userEmail = null,
        object? data = null)
    {
        var ctx = _http.HttpContext;

        var log = new AuditLog
        {
            EventType = eventType,
            Result = result,
            UserId = userId,
            UserEmail = userEmail,
            IpAddress = ctx?.Connection.RemoteIpAddress?.ToString(),
            UserAgent = ctx?.Request.Headers.UserAgent.ToString(),
            CorrelationId = ctx?.TraceIdentifier,
            DataJson = data is null ? null : JsonSerializer.Serialize(data)
        };

        _db.AuditLogs.Add(log);
        await _db.SaveChangesAsync();
    }
}