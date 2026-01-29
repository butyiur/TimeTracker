using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace TimeTracker.Api.Data;

public static class OpenIddictSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var appManager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();
        var scopeManager = scope.ServiceProvider.GetRequiredService<IOpenIddictScopeManager>();

        // ===== SCOPE =====
        if (await scopeManager.FindByNameAsync("api") is null)
        {
            await scopeManager.CreateAsync(new OpenIddictScopeDescriptor
            {
                Name = "api",
                DisplayName = "TimeTracker API access"
            });
        }

        // ===== SPA CLIENT (Angular) - Authorization Code + PKCE =====
        await EnsureSpaClient(
            appManager,
            clientId: "timetracker-angular-spa",
            redirectUri: "https://localhost:7037/swagger/oauth2-redirect.html",
            postLogoutRedirectUri: "https://localhost:7037/swagger/oauth2-redirect.html"
        );
    }

    private static async Task EnsureSpaClient(
        IOpenIddictApplicationManager appManager,
        string clientId,
        string redirectUri,
        string postLogoutRedirectUri)
    {
        if (await appManager.FindByClientIdAsync(clientId) is not null)
            return;

        await appManager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = clientId,
            DisplayName = clientId,
            ConsentType = ConsentTypes.Explicit,
            RedirectUris = { new Uri(redirectUri) },
            // PostLogoutRedirectUris = { new Uri(postLogoutRedirectUri) }, // opcionális, maradhat kikommentezve
            Permissions =
    {
        Permissions.Endpoints.Authorization,
        Permissions.Endpoints.Token,

        Permissions.GrantTypes.AuthorizationCode,
        Permissions.GrantTypes.RefreshToken,

        Permissions.ResponseTypes.Code,

        Permissions.Prefixes.Scope + "api",
        Permissions.Scopes.Profile,
        Permissions.Scopes.Email,
        Permissions.Scopes.Roles
    },
            Requirements =
    {
        Requirements.Features.ProofKeyForCodeExchange
    }
        });
    }

    private static async Task EnsureClientCredentialsClient(
        IOpenIddictApplicationManager appManager,
        string clientId,
        string clientSecret)
    {
        if (await appManager.FindByClientIdAsync(clientId) is not null)
            return;

        await appManager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = clientId,
            ClientSecret = clientSecret,
            DisplayName = clientId,
            Permissions =
            {
                Permissions.Endpoints.Token,
                Permissions.GrantTypes.ClientCredentials,
                Permissions.Prefixes.Scope + "api"
            }
        });
    }
}