using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using System.Data;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Data;

public static class IdentitySeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        // Roles
        foreach (var role in new[] { Roles.Employee, Roles.HR, Roles.Admin })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        // Dev users
        await EnsureUser(userManager, Roles.HR, "hr@local", "Hr.Local.2026!StrongPass");
        await EnsureUser(userManager, Roles.Admin, "admin@local", "Admin.Local.2026!StrongPass");
    }

    private static async Task EnsureUser(
        UserManager<ApplicationUser> userManager,
        string role,
        string email,
        string password)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                RegistrationApproved = true,
                EmploymentActive = true,
                LockoutEnabled = true
            };

            var create = await userManager.CreateAsync(user, password);
            if (!create.Succeeded)
                throw new InvalidOperationException($"Failed to create {email}: " +
                    string.Join("; ", create.Errors.Select(e => e.Description)));

            Console.WriteLine($"Seeded user: {email} | role: {role} | id: {user.Id}");

        }
        else
        {
            user.EmailConfirmed = true;
            user.RegistrationApproved = true;
            user.EmploymentActive = true;
            user.LockoutEnabled = true;

            var normalize = await userManager.UpdateAsync(user);
            if (!normalize.Succeeded)
                throw new InvalidOperationException($"Failed to normalize {email}: " +
                    string.Join("; ", normalize.Errors.Select(e => e.Description)));
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            var addRole = await userManager.AddToRoleAsync(user, role);
            if (!addRole.Succeeded)
                throw new InvalidOperationException($"Failed to add role {role} to {email}: " +
                    string.Join("; ", addRole.Errors.Select(e => e.Description)));
        }


        

    }

}
