using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class AuthController : ControllerBase
{
    [HttpPost("~/connect/token")]
    public IActionResult Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
                      ?? throw new InvalidOperationException("OpenIddict request is missing.");

        if (request.IsClientCredentialsGrantType())
        {
            // "sub" kötelezõ
            var identity = new ClaimsIdentity(
                authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                nameType: OpenIddictConstants.Claims.Name,
                roleType: OpenIddictConstants.Claims.Role);

            identity.AddClaim(OpenIddictConstants.Claims.Subject, request.ClientId!);
            identity.AddClaim(OpenIddictConstants.Claims.Name, request.ClientId!);

            var principal = new ClaimsPrincipal(identity);

            // Scope-ok (ha akarsz)
            principal.SetScopes(new[] { "api" });

            // Tokenba kerülhessenek a claim-ek
            foreach (var claim in principal.Claims)
                claim.SetDestinations(OpenIddictConstants.Destinations.AccessToken);

            return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        return BadRequest(new { error = "unsupported_grant_type" });
    }
}