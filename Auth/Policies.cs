using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.Json;

namespace TimeTracker.Api.Auth;

public static class Policies
{
    public const string EmployeeOnly = "EmployeeOnly";
    public const string HrOnly = "HrOnly";
    public const string AdminOnly = "AdminOnly";
    public const string HrOrAdmin = "HrOrAdmin";
    public const string EmployeeOrHrOrAdmin = "EmployeeOrHrOrAdmin";

    public static void AddTimeTrackerPolicies(AuthorizationOptions options)
    {
        options.AddPolicy(EmployeeOnly, p =>
            p.RequireAuthenticatedUser()
            .RequireAssertion(ctx => HasAnyRole(ctx.User, Roles.Employee)));

        options.AddPolicy(HrOnly, p =>
            p.RequireAuthenticatedUser()
             .RequireAssertion(ctx => HasAnyRole(ctx.User, Roles.HR)));

        options.AddPolicy(AdminOnly, p =>
            p.RequireAuthenticatedUser()
             .RequireAssertion(ctx => HasAnyRole(ctx.User, Roles.Admin)));

        options.AddPolicy(HrOrAdmin, p =>
            p.RequireAuthenticatedUser()
             .RequireAssertion(ctx => HasAnyRole(ctx.User, Roles.HR, Roles.Admin)));

        options.AddPolicy(EmployeeOrHrOrAdmin, p =>
            p.RequireAuthenticatedUser()
             .RequireAssertion(ctx => HasAnyRole(ctx.User, Roles.Employee, Roles.HR, Roles.Admin)));
    }

    private static bool HasAnyRole(ClaimsPrincipal user, params string[] roles)
    {
        foreach (var role in roles)
        {
            if (user.IsInRole(role))
                return true;

            if (user.Claims.Any(c =>
                (string.Equals(c.Type, "role", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Type, "roles", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase)) &&
                ClaimContainsRole(c.Value, role)))
            {
                return true;
            }
        }

        return false;
    }

    private static bool ClaimContainsRole(string? rawValue, string expectedRole)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
            return false;

        if (string.Equals(rawValue, expectedRole, StringComparison.OrdinalIgnoreCase))
            return true;

        var trimmed = rawValue.Trim();

        if (trimmed.StartsWith("["))
        {
            try
            {
                var values = JsonSerializer.Deserialize<string[]>(trimmed);
                if (values?.Any(v => string.Equals(v, expectedRole, StringComparison.OrdinalIgnoreCase)) == true)
                    return true;
            }
            catch
            {
            }
        }

        var parts = trimmed.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Any(v => string.Equals(v, expectedRole, StringComparison.OrdinalIgnoreCase));
    }

}