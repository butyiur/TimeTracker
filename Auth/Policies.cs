using Microsoft.AspNetCore.Authorization;

namespace TimeTracker.Api.Auth;

public static class Policies
{
    public const string EmployeeOnly = "EmployeeOnly";
    public const string HrOnly = "HrOnly";
    public const string AdminOnly = "AdminOnly";
    public const string HrOrAdmin = "HrOrAdmin";

    public static void AddTimeTrackerPolicies(AuthorizationOptions options)
    {
        options.AddPolicy(EmployeeOnly, p =>
            p.RequireAuthenticatedUser()
            .RequireRole(Roles.Employee));

        options.AddPolicy(HrOnly, p =>
            p.RequireAuthenticatedUser()
             .RequireRole(Roles.HR));

        options.AddPolicy(AdminOnly, p =>
            p.RequireAuthenticatedUser()
             .RequireRole(Roles.Admin));

        options.AddPolicy(HrOrAdmin, p =>
            p.RequireAuthenticatedUser()
             .RequireRole(Roles.HR, Roles.Admin));
    }
}