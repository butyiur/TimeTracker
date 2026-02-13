using System.Text.Json;
using TimeTracker.Api.Services;

namespace TimeTracker.Api.Middleware;

public sealed class AuditMiddleware
{
    private static readonly HashSet<string> Mutating = new(StringComparer.OrdinalIgnoreCase)
    {
        "POST","PUT","PATCH","DELETE"
    };

    private readonly RequestDelegate _next;

    public AuditMiddleware(RequestDelegate next) => _next = next;

    public async Task Invoke(HttpContext context, IAuditWriter writer)
    {
        if (!Mutating.Contains(context.Request.Method))
        {
            await _next(context);
            return;
        }

        try
        {
            await _next(context);

            var result = context.Response.StatusCode >= 400 ? "fail" : "success";

            var dataJson = JsonSerializer.Serialize(new
            {
                method = context.Request.Method,
                path = context.Request.Path.ToString(),
                statusCode = context.Response.StatusCode
            });

            await writer.WriteAsync(
                eventType: "api.request",
                result: result,
                user: context.User,
                httpContext: context,
                dataJson: dataJson
            );
        }
        catch
        {
            var dataJson = JsonSerializer.Serialize(new
            {
                method = context.Request.Method,
                path = context.Request.Path.ToString(),
                statusCode = 500
            });

            await writer.WriteAsync(
                eventType: "api.request",
                result: "fail",
                user: context.User,
                httpContext: context,
                dataJson: dataJson
            );

            throw;
        }
    }
}