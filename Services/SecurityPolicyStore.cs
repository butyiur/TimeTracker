using System.Text.Json;

namespace TimeTracker.Api.Services;

public sealed record SecurityPolicySnapshot(
    int SessionTimeoutMinutes,
    int MaxFailedLoginAttempts,
    int PasswordMinLength,
    bool PasswordRequireUppercase,
    bool PasswordRequireLowercase,
    bool PasswordRequireDigit,
    bool PasswordRequireNonAlphanumeric
);

public interface ISecurityPolicyStore
{
    Task<SecurityPolicySnapshot> GetAsync(CancellationToken ct = default);
    Task<SecurityPolicySnapshot> UpdateAsync(SecurityPolicySnapshot policy, CancellationToken ct = default);
}

public sealed class JsonSecurityPolicyStore : ISecurityPolicyStore
{
    private const int DefaultSessionTimeoutMinutes = 60;
    private const int DefaultMaxFailedLoginAttempts = 5;
    private const int DefaultPasswordMinLength = 8;
    private const bool DefaultPasswordRequireUppercase = false;
    private const bool DefaultPasswordRequireLowercase = false;
    private const bool DefaultPasswordRequireDigit = false;
    private const bool DefaultPasswordRequireNonAlphanumeric = false;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly string _filePath;

    public JsonSecurityPolicyStore(IWebHostEnvironment env)
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var basePath = string.IsNullOrWhiteSpace(localAppData)
            ? (string.IsNullOrWhiteSpace(env.ContentRootPath) ? AppContext.BaseDirectory : env.ContentRootPath)
            : localAppData;

        var appDataDir = Path.Combine(basePath, "TimeTracker.Api", "App_Data");
        Directory.CreateDirectory(appDataDir);
        _filePath = Path.Combine(appDataDir, "security-policy.json");
    }

    public async Task<SecurityPolicySnapshot> GetAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (!File.Exists(_filePath))
            {
                var defaults = Normalize(new SecurityPolicySnapshot(
                    DefaultSessionTimeoutMinutes,
                    DefaultMaxFailedLoginAttempts,
                    DefaultPasswordMinLength,
                    DefaultPasswordRequireUppercase,
                    DefaultPasswordRequireLowercase,
                    DefaultPasswordRequireDigit,
                    DefaultPasswordRequireNonAlphanumeric));
                await SaveAsync(defaults, ct);
                return defaults;
            }

            await using var stream = File.OpenRead(_filePath);
            var policy = await JsonSerializer.DeserializeAsync<SecurityPolicySnapshot>(stream, JsonOptions, ct);

            var normalized = Normalize(policy ?? new SecurityPolicySnapshot(
                DefaultSessionTimeoutMinutes,
                DefaultMaxFailedLoginAttempts,
                DefaultPasswordMinLength,
                DefaultPasswordRequireUppercase,
                DefaultPasswordRequireLowercase,
                DefaultPasswordRequireDigit,
                DefaultPasswordRequireNonAlphanumeric));
            return normalized;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<SecurityPolicySnapshot> UpdateAsync(SecurityPolicySnapshot policy, CancellationToken ct = default)
    {
        var normalized = Normalize(policy);

        await _lock.WaitAsync(ct);
        try
        {
            await SaveAsync(normalized, ct);
            return normalized;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task SaveAsync(SecurityPolicySnapshot policy, CancellationToken ct)
    {
        await using var stream = File.Create(_filePath);
        await JsonSerializer.SerializeAsync(stream, policy, JsonOptions, ct);
    }

    private static SecurityPolicySnapshot Normalize(SecurityPolicySnapshot policy)
    {
        var timeout = Math.Clamp(policy.SessionTimeoutMinutes, 5, 1440);
        var failedAttempts = Math.Clamp(policy.MaxFailedLoginAttempts, 3, 20);
        var passwordMinLength = Math.Clamp(policy.PasswordMinLength, 6, 128);

        return new SecurityPolicySnapshot(
            timeout,
            failedAttempts,
            passwordMinLength,
            policy.PasswordRequireUppercase,
            policy.PasswordRequireLowercase,
            policy.PasswordRequireDigit,
            policy.PasswordRequireNonAlphanumeric);
    }
}
