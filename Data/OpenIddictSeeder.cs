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

        // ===== CLIENTS (RBAC TEST) =====
        await EnsureClient(appManager,
            clientId: "timetracker-employee-client",
            clientSecret: "employee-secret");

        await EnsureClient(appManager,
            clientId: "timetracker-hr-client",
            clientSecret: "hr-secret");

        await EnsureClient(appManager,
            clientId: "timetracker-admin-client",
            clientSecret: "admin-secret");
    }

    private static async Task EnsureClient(
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