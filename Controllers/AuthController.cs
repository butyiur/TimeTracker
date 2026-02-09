using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using TimeTracker.Api.Domain.Identity;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class AuthorizationController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AuthorizationController(UserManager<ApplicationUser> userManager)
        => _userManager = userManager;

    [HttpGet("~/connect/authorize")]
    public async Task<IActionResult> Authorize()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("OpenIddict request is missing.");

        // KIFEJEZETTEN a cookie sémával autentikálunk, nem a defaulttal
        var cookieAuth = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);

        if (!cookieAuth.Succeeded || cookieAuth.Principal?.Identity?.IsAuthenticated != true)
        {
            return Challenge(new AuthenticationProperties
            {
                RedirectUri = Request.PathBase + Request.Path + Request.QueryString.Value
            }, IdentityConstants.ApplicationScheme);
        }

        var user = await _userManager.GetUserAsync(cookieAuth.Principal);
        if (user is null) return Forbid();

        var principal = await _userManager.CreatePrincipalAsync(user);

        principal.SetScopes(request.GetScopes());
        principal.SetResources("api");

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("~/connect/token")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("OpenIddict request is missing.");

        if (!request.IsAuthorizationCodeGrantType() && !request.IsRefreshTokenGrantType())
            return BadRequest(new { error = "unsupported_grant_type" });

        var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        if (result.Principal is null) return Forbid();

        return SignIn(result.Principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}

internal static class UserManagerExtensions
{
    public static async Task<ClaimsPrincipal> CreatePrincipalAsync(
        this UserManager<ApplicationUser> userManager,
        ApplicationUser user)
    {
        var identity = new ClaimsIdentity(
            authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            nameType: Claims.Name,
            roleType: Claims.Role);

        identity.AddClaim(new Claim(Claims.Subject, user.Id)
            .SetDestinations(Destinations.AccessToken));

        identity.AddClaim(new Claim(Claims.Name, user.Email ?? user.UserName ?? user.Id)
            .SetDestinations(Destinations.AccessToken));

        var roles = await userManager.GetRolesAsync(user);
        foreach (var role in roles)
        {
            identity.AddClaim(new Claim(Claims.Role, role)
                .SetDestinations(Destinations.AccessToken));
        }

        return new ClaimsPrincipal(identity);
    }
}