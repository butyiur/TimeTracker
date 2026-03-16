using System.Security.Claims;

namespace TimeTracker.Api.Services;

public interface IAuditWriter
{
    Task WriteAsync(
        string eventType,
        string result,
        ClaimsPrincipal? user,
        HttpContext httpContext,
        string? dataJson = null);
}