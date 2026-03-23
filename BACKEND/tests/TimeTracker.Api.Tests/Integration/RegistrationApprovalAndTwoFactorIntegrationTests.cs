using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Controllers;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Services;
using Xunit;

namespace TimeTracker.Api.Tests.Integration;

public sealed class RegistrationApprovalAndTwoFactorIntegrationTests : IAsyncLifetime
{
    private TestServer _server = null!;
    private HttpClient _client = null!;
    private SqliteConnection _connection = null!;

    private string _hrId = string.Empty;
    private string _adminId = string.Empty;
    private string _employeeId = string.Empty;
    private FakeEmailSender _emailSender = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        _emailSender = new FakeEmailSender();

        var builder = new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddLogging();
                services.AddSingleton<IEmailSender>(_emailSender);
                services.AddSingleton<ISecurityPolicyStore>(new InMemorySecurityPolicyStore());
                services.AddSingleton<IOptions<EmailOptions>>(Options.Create(new EmailOptions()));

                services.AddControllers()
                    .AddApplicationPart(typeof(AuthController).Assembly);

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
    public async Task RegisterAndConfirmEmail_CreatesPendingUserAndConfirmsEmail()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "new.pending@local",
            password = "x"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var userId = json.GetProperty("userId").GetString();
        Assert.False(string.IsNullOrWhiteSpace(userId));
        Assert.True(json.GetProperty("requiresHrApproval").GetBoolean());

        using (var scope = _server.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByIdAsync(userId!);
            Assert.NotNull(user);
            Assert.False(user!.EmailConfirmed);
            Assert.False(user.RegistrationApproved);
        }

        var confirmationToken = ExtractLatestEmailConfirmationToken(_emailSender);
        Assert.False(string.IsNullOrWhiteSpace(confirmationToken));

        var confirmResponse = await _client.PostAsJsonAsync("/api/auth/confirm-email", new
        {
            userId,
            token = confirmationToken
        });

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);

        using var verifyScope = _server.Services.CreateScope();
        var verifyUserManager = verifyScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var confirmed = await verifyUserManager.FindByIdAsync(userId!);
        Assert.NotNull(confirmed);
        Assert.True(confirmed!.EmailConfirmed);
    }

    [Fact]
    public async Task AuthMe_IsForbiddenUntilHrApproval_ThenAllowedAfterApproval()
    {
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "approval.flow@local",
            password = "x"
        });

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var registerJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registerJson.GetProperty("userId").GetString()!;

        var meBefore = CreateAuthorizedRequest(HttpMethod.Get, "/api/auth/me", userId, Roles.Employee);
        var beforeResponse = await _client.SendAsync(meBefore);
        Assert.Equal(HttpStatusCode.Forbidden, beforeResponse.StatusCode);
        var beforeJson = await beforeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("pending_registration_approval", beforeJson.GetProperty("error").GetString());

        var approveRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            $"/api/hr/registration-requests/{userId}/approve",
            _hrId,
            Roles.HR);

        var approveResponse = await _client.SendAsync(approveRequest);
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        var meAfter = CreateAuthorizedRequest(HttpMethod.Get, "/api/auth/me", userId, Roles.Employee);
        var afterResponse = await _client.SendAsync(meAfter);
        Assert.Equal(HttpStatusCode.OK, afterResponse.StatusCode);
    }

    [Fact]
    public async Task UsersPagedAssignableOnly_HidesPendingUser_UntilApproval()
    {
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "hr.queue@local",
            password = "x"
        });
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registerJson.GetProperty("userId").GetString()!;

        var listBeforeRequest = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/hr/users/paged?assignableOnly=true&page=1&pageSize=50",
            _hrId,
            Roles.HR);
        var listBeforeResponse = await _client.SendAsync(listBeforeRequest);
        Assert.Equal(HttpStatusCode.OK, listBeforeResponse.StatusCode);

        var listBeforeJson = await listBeforeResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain(
            listBeforeJson.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("userId").GetString()),
            id => string.Equals(id, userId, StringComparison.Ordinal));

        var approveRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            $"/api/hr/registration-requests/{userId}/approve",
            _hrId,
            Roles.HR);
        var approveResponse = await _client.SendAsync(approveRequest);
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        var listAfterRequest = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/hr/users/paged?assignableOnly=true&page=1&pageSize=50",
            _hrId,
            Roles.HR);
        var listAfterResponse = await _client.SendAsync(listAfterRequest);
        Assert.Equal(HttpStatusCode.OK, listAfterResponse.StatusCode);

        var listAfterJson = await listAfterResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(
            listAfterJson.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("userId").GetString()),
            id => string.Equals(id, userId, StringComparison.Ordinal));
    }

    [Fact]
    public async Task ApproveRegistration_DeniesAdminActor()
    {
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "admin.cannot.approve@local",
            password = "x"
        });
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var registerJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registerJson.GetProperty("userId").GetString()!;

        var approveRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            $"/api/hr/registration-requests/{userId}/approve",
            _adminId,
            Roles.Admin);
        var approveResponse = await _client.SendAsync(approveRequest);

        Assert.Equal(HttpStatusCode.Forbidden, approveResponse.StatusCode);
    }

    [Fact]
    public async Task TotpSetup_ReturnsSharedKeyAndOtpAuthUri()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/setup",
            _employeeId,
            Roles.Employee);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var sharedKey = json.GetProperty("sharedKey").GetString();
        var uri = json.GetProperty("authenticatorUri").GetString();

        Assert.False(string.IsNullOrWhiteSpace(sharedKey));
        Assert.False(string.IsNullOrWhiteSpace(uri));
        Assert.StartsWith("otpauth://totp/", uri, StringComparison.Ordinal);
    }

    [Fact]
    public async Task TotpEnable_WithValidCode_EnablesAndReturnsRecoveryCodes()
    {
        await SetupAuthenticatorAsync(_employeeId, Roles.Employee);

        var code = await GenerateAuthenticatorCodeAsync(_employeeId);
        var enableRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/enable",
            _employeeId,
            Roles.Employee);
        enableRequest.Content = JsonContent.Create(new { code });

        var enableResponse = await _client.SendAsync(enableRequest);
        Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);

        var json = await enableResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("enabled").GetBoolean());
        Assert.Equal(10, json.GetProperty("recoveryCodes").GetArrayLength());
    }

    [Fact]
    public async Task TotpEnable_WithInvalidCode_ReturnsBadRequest()
    {
        await SetupAuthenticatorAsync(_employeeId, Roles.Employee);

        var enableRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/enable",
            _employeeId,
            Roles.Employee);
        enableRequest.Content = JsonContent.Create(new { code = "000000" });

        var response = await _client.SendAsync(enableRequest);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_code", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task RecoveryCodesRegenerate_RequiresEnabledTwoFactor()
    {
        var request = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/recoverycodes/regenerate",
            _employeeId,
            Roles.Employee);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2fa_not_enabled", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task DisableTotp_DeniesPrivilegedUser()
    {
        await EnsureTwoFactorEnabledAsync(_hrId);

        var request = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/disable",
            _hrId,
            Roles.HR);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("2fa_required_for_privileged_roles", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task DisableTotp_AllowsEmployee()
    {
        await SetupAuthenticatorAsync(_employeeId, Roles.Employee);
        var code = await GenerateAuthenticatorCodeAsync(_employeeId);
        var enableRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/enable",
            _employeeId,
            Roles.Employee);
        enableRequest.Content = JsonContent.Create(new { code });
        var enableResponse = await _client.SendAsync(enableRequest);
        Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);

        var disableRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/disable",
            _employeeId,
            Roles.Employee);
        var disableResponse = await _client.SendAsync(disableRequest);
        Assert.Equal(HttpStatusCode.OK, disableResponse.StatusCode);

        var json = await disableResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(json.GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public async Task RecoveryCodesRegenerate_ReturnsCodes_WhenTwoFactorEnabled()
    {
        await SetupAuthenticatorAsync(_employeeId, Roles.Employee);
        var code = await GenerateAuthenticatorCodeAsync(_employeeId);
        var enableRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/enable",
            _employeeId,
            Roles.Employee);
        enableRequest.Content = JsonContent.Create(new { code });
        var enableResponse = await _client.SendAsync(enableRequest);
        Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);

        var regenerateRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/recoverycodes/regenerate",
            _employeeId,
            Roles.Employee);
        var regenerateResponse = await _client.SendAsync(regenerateRequest);
        Assert.Equal(HttpStatusCode.OK, regenerateResponse.StatusCode);

        var json = await regenerateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(10, json.GetProperty("recoveryCodes").GetArrayLength());
    }

    [Fact]
    public async Task ConfirmEmail_ReturnsBadRequest_ForInvalidTokenFormat()
    {
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "invalid.token@local",
            password = "x"
        });
        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var registerJson = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = registerJson.GetProperty("userId").GetString()!;

        var confirmResponse = await _client.PostAsJsonAsync("/api/auth/confirm-email", new
        {
            userId,
            token = "%%%invalid-base64url%%%"
        });

        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        var json = await confirmResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("invalid_token", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task AuthMe_ReturnsLocked_WhenUserIsLockedOut()
    {
        await LockOutUserAsync(_employeeId);

        var meRequest = CreateAuthorizedRequest(
            HttpMethod.Get,
            "/api/auth/me",
            _employeeId,
            Roles.Employee);
        var meResponse = await _client.SendAsync(meRequest);

        Assert.Equal((HttpStatusCode)423, meResponse.StatusCode);
        var json = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("account_locked", json.GetProperty("error").GetString());
    }

    private HttpRequestMessage CreateAuthorizedRequest(HttpMethod method, string url, string userId, params string[] roles)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add(TestAuthHandler.UserIdHeader, userId);
        request.Headers.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return request;
    }

    private async Task SetupAuthenticatorAsync(string userId, params string[] roles)
    {
        var setupRequest = CreateAuthorizedRequest(
            HttpMethod.Post,
            "/api/account/2fa/totp/setup",
            userId,
            roles);
        var response = await _client.SendAsync(setupRequest);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<string> GenerateAuthenticatorCodeAsync(string userId)
    {
        using var scope = _server.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId);
        Assert.NotNull(user);

        var key = await userManager.GetAuthenticatorKeyAsync(user!);
        Assert.False(string.IsNullOrWhiteSpace(key));

        var code = GenerateCurrentTotpCode(key!);
        Assert.False(string.IsNullOrWhiteSpace(code));
        return code;
    }

    private static string GenerateCurrentTotpCode(string base32Key)
    {
        var key = Base32Decode(base32Key);
        var timestepNumber = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var timestepBytes = BitConverter.GetBytes((long)timestepNumber);
        if (BitConverter.IsLittleEndian)
            Array.Reverse(timestepBytes);

        using var hmac = new HMACSHA1(key);
        var hash = hmac.ComputeHash(timestepBytes);
        var offset = hash[^1] & 0x0F;

        var binaryCode = ((hash[offset] & 0x7F) << 24)
            | ((hash[offset + 1] & 0xFF) << 16)
            | ((hash[offset + 2] & 0xFF) << 8)
            | (hash[offset + 3] & 0xFF);

        var code = binaryCode % 1_000_000;
        return code.ToString("D6");
    }

    private static byte[] Base32Decode(string input)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var clean = input.Trim().TrimEnd('=').Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        if (clean.Length == 0)
            return [];

        var output = new List<byte>();
        var buffer = 0;
        var bitsLeft = 0;

        foreach (var ch in clean)
        {
            var val = alphabet.IndexOf(ch);
            if (val < 0)
                throw new FormatException("Invalid base32 character.");

            buffer = (buffer << 5) | val;
            bitsLeft += 5;

            while (bitsLeft >= 8)
            {
                bitsLeft -= 8;
                output.Add((byte)((buffer >> bitsLeft) & 0xFF));
            }
        }

        return output.ToArray();
    }

    private async Task EnsureTwoFactorEnabledAsync(string userId)
    {
        using var scope = _server.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId);
        Assert.NotNull(user);

        await userManager.ResetAuthenticatorKeyAsync(user!);
        await userManager.SetTwoFactorEnabledAsync(user!, true);
    }

    private async Task LockOutUserAsync(string userId)
    {
        using var scope = _server.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByIdAsync(userId);
        Assert.NotNull(user);

        await userManager.SetLockoutEnabledAsync(user!, true);
        await userManager.SetLockoutEndDateAsync(user!, DateTimeOffset.UtcNow.AddMinutes(10));
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

        var employee = await EnsureUserAsync(userManager, "employee.flow@local", true, true, Roles.Employee);
        var hr = await EnsureUserAsync(userManager, "hr.flow@local", true, true, Roles.HR);
        var admin = await EnsureUserAsync(userManager, "admin.flow@local", true, true, Roles.Admin);

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

    private static string ExtractLatestEmailConfirmationToken(FakeEmailSender sender)
    {
        var htmlBody = sender.Sent.LastOrDefault()?.Body;
        if (string.IsNullOrWhiteSpace(htmlBody))
            throw new InvalidOperationException("No confirmation email was captured.");

        var hrefMatch = Regex.Match(htmlBody, "href=\"([^\"]+)\"", RegexOptions.IgnoreCase);
        if (!hrefMatch.Success)
            throw new InvalidOperationException("Confirmation URL not found in email body.");

        var uri = new Uri(hrefMatch.Groups[1].Value);
        var query = QueryHelpers.ParseQuery(uri.Query);
        if (!query.TryGetValue("token", out var tokenValues))
            throw new InvalidOperationException("Token parameter not found in confirmation URL.");

        return tokenValues.ToString();
    }

    private sealed class InMemorySecurityPolicyStore : ISecurityPolicyStore
    {
        private SecurityPolicySnapshot _snapshot = new(
            SessionTimeoutMinutes: 60,
            MaxFailedLoginAttempts: 5,
            PasswordMinLength: 6,
            PasswordRequireUppercase: false,
            PasswordRequireLowercase: false,
            PasswordRequireDigit: false,
            PasswordRequireNonAlphanumeric: false);

        public Task<SecurityPolicySnapshot> GetAsync(CancellationToken ct = default)
            => Task.FromResult(_snapshot);

        public Task<SecurityPolicySnapshot> UpdateAsync(SecurityPolicySnapshot policy, CancellationToken ct = default)
        {
            _snapshot = policy;
            return Task.FromResult(_snapshot);
        }
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        private readonly List<EmailMessage> _sent = [];

        public IReadOnlyList<EmailMessage> Sent => _sent;

        public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
        {
            _sent.Add(new EmailMessage(to, subject, htmlBody));
            return Task.CompletedTask;
        }
    }

    private sealed record EmailMessage(string To, string Subject, string Body);
}
