using System.Security.Claims;
using OpenIddict.Abstractions;

namespace TimeTracker.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static string GetUserIdOrThrow(this ClaimsPrincipal user)
    {
        // prefer OIDC standard subject claim
        var userId =
            user.FindFirst(OpenIddictConstants.Claims.Subject)?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("user_id")?.Value;

        if (string.IsNullOrWhiteSpace(userId))
            throw new InvalidOperationException("User ID claim missing from token.");

        return userId;
    }
}