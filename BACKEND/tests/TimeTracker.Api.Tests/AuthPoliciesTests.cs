using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using TimeTracker.Api.Auth;
using Xunit;

namespace TimeTracker.Api.Tests;

public sealed class AuthPoliciesTests
{
    private readonly IAuthorizationService _authorizationService;

    public AuthPoliciesTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization(Policies.AddTimeTrackerPolicies);
        _authorizationService = services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    [Fact]
    public async Task HrOrAdmin_Allows_AdminRole()
    {
        var principal = CreatePrincipal(("role", Roles.Admin));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOrAdmin);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task HrOrAdmin_Allows_HrRole()
    {
        var principal = CreatePrincipal(("role", Roles.HR));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOrAdmin);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task HrOnly_Denies_AdminRole()
    {
        var principal = CreatePrincipal(("role", Roles.Admin));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOnly);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task HrOnly_Allows_HrRole()
    {
        var principal = CreatePrincipal(("role", Roles.HR));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOnly);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task HrOrAdmin_Allows_JsonArrayRolesClaim()
    {
        var principal = CreatePrincipal(("roles", "[\"Employee\",\"HR\"]"));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOrAdmin);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task HrOrAdmin_Allows_CommaSeparatedRolesClaim()
    {
        var principal = CreatePrincipal(("roles", "Employee,Admin"));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOrAdmin);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task AdminOnly_Allows_ClaimTypesRole()
    {
        var principal = CreatePrincipal((ClaimTypes.Role, Roles.Admin));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.AdminOnly);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task EmployeeOnly_Denies_HrRole()
    {
        var principal = CreatePrincipal(("role", Roles.HR));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.EmployeeOnly);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task EmployeeOrHrOrAdmin_Allows_EmployeeRole()
    {
        var principal = CreatePrincipal(("role", Roles.Employee));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.EmployeeOrHrOrAdmin);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task EmployeeOrHrOrAdmin_Denies_UnknownRole()
    {
        var principal = CreatePrincipal(("role", "Guest"));

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.EmployeeOrHrOrAdmin);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task HrOrAdmin_Denies_AnonymousPrincipal()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity());

        var result = await _authorizationService.AuthorizeAsync(principal, null, Policies.HrOrAdmin);

        Assert.False(result.Succeeded);
    }

    private static ClaimsPrincipal CreatePrincipal(params (string Type, string Value)[] claims)
    {
        var identityClaims = claims.Select(c => new Claim(c.Type, c.Value)).ToList();
        identityClaims.Add(new Claim(ClaimTypes.NameIdentifier, "test-user"));

        var identity = new ClaimsIdentity(identityClaims, authenticationType: "TestAuth");
        return new ClaimsPrincipal(identity);
    }
}
