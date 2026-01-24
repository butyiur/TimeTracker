using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using TimeTracker.Api.Auth;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class AuthController : ControllerBase
{
    [HttpPost("~/connect/token")]
    public IActionResult Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("OpenIddict request is missing.");

        if (!request.IsClientCredentialsGrantType())
            return BadRequest(new { error = "unsupported_grant_type" });

        string? role = request.ClientId switch
        {
            "timetracker-employee-client" => Roles.Employee,
            "timetracker-hr-client" => Roles.HR,
            "timetracker-admin-client" => Roles.Admin,
            _ => null
        };

        if (role is null)
            return Forbid();

        var identity = new ClaimsIdentity(
            authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            nameType: Claims.Name,
            roleType: Claims.Role);

        // Subject + Name
        identity.AddClaim(new Claim(Claims.Subject, request.ClientId!)
            .SetDestinations(Destinations.AccessToken));

        identity.AddClaim(new Claim(Claims.Name, request.ClientId!)
            .SetDestinations(Destinations.AccessToken));

        // Role (THIS is what your policies need)
        identity.AddClaim(new Claim(Claims.Role, role)
            .SetDestinations(Destinations.AccessToken));

        var principal = new ClaimsPrincipal(identity);
        principal.SetScopes(new[] { "api" });

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}