
using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TimeTracker.Api.Controllers;

[ApiController]
public class AuthorizationController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;

    public AuthorizationController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
    }

    [HttpGet("~/connect/authorize")]
    public async Task<IActionResult> Authorize()
    {

        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("OpenIddict request is missing.");

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

        if (!user.RegistrationApproved)
        {
            await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
            return Forbid();
        }

        if (!user.EmploymentActive)
        {
            await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
            return Forbid();
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
            return Forbid();
        }

        var roles = await _userManager.GetRolesAsync(user);
        var isPrivileged = roles.Any(r =>
            string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r, Roles.HR, StringComparison.OrdinalIgnoreCase));
        if (isPrivileged && !user.TwoFactorEnabled)
        {
            await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
            return Forbid();
        }

        if (isPrivileged)
        {
            var authenticatedWithMfa = cookieAuth.Principal.Claims.Any(x =>
                string.Equals(x.Type, "amr", StringComparison.OrdinalIgnoreCase)
                && string.Equals(x.Value, "mfa", StringComparison.OrdinalIgnoreCase));

            var rememberedForTwoFactor = await _signInManager.IsTwoFactorClientRememberedAsync(user);
            if (!authenticatedWithMfa && !rememberedForTwoFactor)
            {
                await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
                return Challenge(new AuthenticationProperties
                {
                    RedirectUri = Request.PathBase + Request.Path + Request.QueryString.Value
                }, IdentityConstants.ApplicationScheme);
            }
        }

        var principal = await _userManager.CreatePrincipalAsync(user, isPrivileged);

        principal.SetScopes(request.GetScopes());
        principal.SetResources("api");

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}

internal static class UserManagerExtensions
{
    public static async Task<ClaimsPrincipal> CreatePrincipalAsync(
        this UserManager<ApplicationUser> userManager,
        ApplicationUser user,
        bool isPrivileged)
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

        if (isPrivileged)
        {
            identity.AddClaim(new Claim("tt_mfa", "1")
                .SetDestinations(Destinations.AccessToken));
        }

        return new ClaimsPrincipal(identity);
    }
}
