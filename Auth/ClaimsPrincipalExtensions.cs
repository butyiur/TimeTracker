using System.Security.Claims;
using OpenIddict.Abstractions;

public static class ClaimsPrincipalExtensions
{
    public static string GetUserIdOrThrow(this ClaimsPrincipal user)
    {
        var userId =
            user.FindFirst("user_id")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst(OpenIddictConstants.Claims.Subject)?.Value;

        if (string.IsNullOrWhiteSpace(userId))
            throw new InvalidOperationException("User ID claim missing from token.");

        return userId;
    }
}