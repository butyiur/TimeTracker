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

        await EnsureSpaClient(
            appManager,
            clientId: "timetracker-swagger",
            redirectUri: "https://localhost:7037/swagger/oauth2-redirect.html",
            postLogoutRedirectUri: "https://localhost:7037/swagger/"
        );

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
        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = clientId,
            DisplayName = clientId,
            ClientType = OpenIddictConstants.ClientTypes.Public,
            ConsentType = OpenIddictConstants.ConsentTypes.Implicit,

            RedirectUris = { new Uri(redirectUri) },
            PostLogoutRedirectUris = { new Uri(postLogoutRedirectUri) },

            Permissions =
        {
            OpenIddictConstants.Permissions.Endpoints.Authorization,
            OpenIddictConstants.Permissions.Endpoints.Token,

            OpenIddictConstants.Permissions.GrantTypes.AuthorizationCode,
            OpenIddictConstants.Permissions.GrantTypes.RefreshToken,
            OpenIddictConstants.Permissions.ResponseTypes.Code,

            OpenIddictConstants.Permissions.Prefixes.Scope + "openid",
            OpenIddictConstants.Permissions.Prefixes.Scope + "profile",
            OpenIddictConstants.Permissions.Prefixes.Scope + "email",
            OpenIddictConstants.Permissions.Prefixes.Scope + "roles",
            OpenIddictConstants.Permissions.Prefixes.Scope + "api",
            OpenIddictConstants.Permissions.Prefixes.Scope + OpenIddictConstants.Scopes.OfflineAccess
        },

            Requirements =
        {
            OpenIddictConstants.Requirements.Features.ProofKeyForCodeExchange
        }
        };

        var existing = await appManager.FindByClientIdAsync(clientId);
        if (existing is null)
        {
            await appManager.CreateAsync(descriptor);
            return;
        }

        await appManager.UpdateAsync(existing, descriptor);
    }

    // (ha k�s�bb kell g�p-g�p integr�ci�)
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
