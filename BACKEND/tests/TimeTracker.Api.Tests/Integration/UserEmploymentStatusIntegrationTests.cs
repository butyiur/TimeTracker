using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Controllers;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using Xunit;

namespace TimeTracker.Api.Tests.Integration;

public sealed class UserEmploymentStatusIntegrationTests : IAsyncLifetime
{
    private TestServer _server = null!;
    private HttpClient _client = null!;
    private SqliteConnection _connection = null!;

    private string _employeeId = string.Empty;
    private string _hrId = string.Empty;
    private string _adminId = string.Empty;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        var builder = new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddLogging();

                services.AddControllers()
                    .AddApplicationPart(typeof(HrController).Assembly);

                services.AddDbContext<ApplicationDbContext>(options =>
                {
                    options.UseSqlite(_connection);
                });

                services.AddIdentity<ApplicationUser, IdentityRole>(options =>
                    {
                        options.User.RequireUniqueEmail = true;
                        options.Password.RequiredLength = 1;
                        options.Password.RequireDigit = false;
                        options.Password.RequireLowercase = false;
                        options.Password.RequireUppercase = false;
                        options.Password.RequireNonAlphanumeric = false;
                        options.Password.RequiredUniqueChars = 1;
                    })
                    .AddEntityFrameworkStores<ApplicationDbContext>()
                    .AddDefaultTokenProviders();

                services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
                        options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
                    })
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme,
                        _ => { });

                services.AddAuthorization(Policies.AddTimeTrackerPolicies);
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseAuthentication();
                app.UseAuthorization();
                app.UseEndpoints(endpoints =>
                {
                    endpoints.MapControllers();
                });
            });

        _server = new TestServer(builder);
        _client = _server.CreateClient();

        await SeedAsync();
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        _server.Dispose();
        _connection.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task SetEmploymentActive_Allows_Admin_To_Inactivate_Employee()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Put,
            $"/api/hr/users/{_employeeId}/employment-active",
            _adminId,
            Roles.Admin);
        request.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _server.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var employee = await userManager.FindByIdAsync(_employeeId);
        Assert.NotNull(employee);
        Assert.False(employee!.EmploymentActive);
    }

    [Fact]
    public async Task SetEmploymentActive_Denies_EmployeeActor()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Put,
            $"/api/hr/users/{_hrId}/employment-active",
            _employeeId,
            Roles.Employee);
        request.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SetEmploymentActive_Denies_Hr_Targeting_Admin()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Put,
            $"/api/hr/users/{_adminId}/employment-active",
            _hrId,
            Roles.HR);
        request.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SetEmploymentActive_Denies_SelfUpdate()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Put,
            $"/api/hr/users/{_hrId}/employment-active",
            _hrId,
            Roles.HR);
        request.Content = JsonContent.Create(new { isActive = false });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsersList_Denies_EmployeeActor()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/admin/users",
            _employeeId,
            Roles.Employee);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task HrPing_Allows_HrOrAdmin()
    {
        var hrRequest = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/hr/ping",
            _hrId,
            Roles.HR);

        var hrResponse = await _client.SendAsync(hrRequest);
        Assert.Equal(HttpStatusCode.OK, hrResponse.StatusCode);

        var adminRequest = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/hr/ping",
            _adminId,
            Roles.Admin);

        var adminResponse = await _client.SendAsync(adminRequest);
        Assert.Equal(HttpStatusCode.OK, adminResponse.StatusCode);
    }

    private HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string userId, params string[] roles)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add(TestAuthHandler.UserIdHeader, userId);
        request.Headers.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return request;
    }

    private async Task SeedAsync()
    {
        using var scope = _server.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await db.Database.EnsureCreatedAsync();

        foreach (var role in new[] { Roles.Employee, Roles.HR, Roles.Admin })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        var employee = await EnsureUserAsync(userManager, "employee.test@local", true, true, Roles.Employee);
        var hr = await EnsureUserAsync(userManager, "hr.test@local", true, true, Roles.HR);
        var admin = await EnsureUserAsync(userManager, "admin.test@local", true, true, Roles.Admin);

        _employeeId = employee.Id;
        _hrId = hr.Id;
        _adminId = admin.Id;
    }

    private static async Task<ApplicationUser> EnsureUserAsync(
        UserManager<ApplicationUser> userManager,
        string email,
        bool registrationApproved,
        bool employmentActive,
        params string[] roles)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
            return existing;

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            RegistrationApproved = registrationApproved,
            EmploymentActive = employmentActive,
            LockoutEnabled = true
        };

        var create = await userManager.CreateAsync(user, "Test.Password.2026!");
        if (!create.Succeeded)
            throw new InvalidOperationException(string.Join("; ", create.Errors.Select(e => e.Description)));

        foreach (var role in roles)
        {
            var roleResult = await userManager.AddToRoleAsync(user, role);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", roleResult.Errors.Select(e => e.Description)));
        }

        return user;
    }
}
