using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Server.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;
using static OpenIddict.Abstractions.OpenIddictConstants;
using Microsoft.AspNetCore;
using OpenIddict.Abstractions;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AuthController(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    [HttpPost("~/connect/token")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("OpenIddict request is missing.");

        if (!request.IsClientCredentialsGrantType())
            return BadRequest(new { error = "unsupported_grant_type" });

        // client -> role + dev email mapping
        (string role, string email)? map = request.ClientId switch
        {
            "timetracker-employee-client" => (Roles.Employee, "employee@local"),
            "timetracker-hr-client" => (Roles.HR, "hr@local"),
            "timetracker-admin-client" => (Roles.Admin, "admin@local"),
            _ => null
        };

        if (map is null)
            return Forbid();

        var (role, email) = map.Value;

        // This is the key: find the dev user and embed its id into token
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return Problem($"Dev user not found for {email}. Run IdentitySeeder first.", statusCode: 500);

        var identity = new ClaimsIdentity(
            authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            nameType: Claims.Name,
            roleType: Claims.Role);

        // These describe the CLIENT (fine)
        identity.AddClaim(new Claim(Claims.Subject, request.ClientId!)
            .SetDestinations(Destinations.AccessToken));

        identity.AddClaim(new Claim(Claims.Name, request.ClientId!)
            .SetDestinations(Destinations.AccessToken));

        // Role for policies
        identity.AddClaim(new Claim(Claims.Role, role)
            .SetDestinations(Destinations.AccessToken));

        // This describes the USER we impersonate in dev (THIS is what your APIs need)
        identity.AddClaim(new Claim("user_id", user.Id)
            .SetDestinations(Destinations.AccessToken));

        // Optional: standard NameIdentifier too (many libs expect this)
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, user.Id)
            .SetDestinations(Destinations.AccessToken));

        var principal = new ClaimsPrincipal(identity);
        principal.SetScopes(new[] { "api" });

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}