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

        // ===== SCOPES =====
        await EnsureScope(scopeManager, "api", "TimeTracker API access");
        await EnsureScope(scopeManager, Scopes.OfflineAccess, "Refresh token access");

        // ===== CLIENTS =====

        // Swagger kliens (dev teszt) - Authorization Code + PKCE
        await EnsureSpaClient(
            appManager,
            clientId: "timetracker-swagger",
            redirectUri: "https://localhost:7037/swagger/oauth2-redirect.html",
            postLogoutRedirectUri: "https://localhost:7037/swagger/"
        );

        // Angular kliens (hosszú táv) - Authorization Code + PKCE
        await EnsureSpaClient(
            appManager,
            clientId: "timetracker-angular-spa",
            redirectUri: "http://localhost:4200/auth/callback",
            postLogoutRedirectUri: "http://localhost:4200/"
        );
    }

    private static async Task EnsureScope(
        IOpenIddictScopeManager scopeManager,
        string name,
        string displayName)
    {
        if (await scopeManager.FindByNameAsync(name) is not null)
            return;

        await scopeManager.CreateAsync(new OpenIddictScopeDescriptor
        {
            Name = name,
            DisplayName = displayName
        });
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

            ClientType = ClientTypes.Public,             //  SPA = public client (nincs client_secret)
            ConsentType = ConsentTypes.Explicit,    //  tiszta, OIDC-kompatibilis

            RedirectUris = { new Uri(redirectUri) },
            PostLogoutRedirectUris = { new Uri(postLogoutRedirectUri) },

            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,

                Permissions.GrantTypes.AuthorizationCode,   
                Permissions.GrantTypes.RefreshToken,

                Permissions.ResponseTypes.Code,

                //  scope permissioneket MIND prefixelve add meg
                Permissions.Prefixes.Scope + "api",
                Permissions.Prefixes.Scope + Scopes.Profile,
                Permissions.Prefixes.Scope + Scopes.Email,
                Permissions.Prefixes.Scope + Scopes.Roles,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess,
                Permissions.Prefixes.Scope + "offline_access",
            },

            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange
            }
        });
    }

    // (ha késõbb kell gép-gép integráció)
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