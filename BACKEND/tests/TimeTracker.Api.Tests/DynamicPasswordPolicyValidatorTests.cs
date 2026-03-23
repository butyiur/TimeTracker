using Microsoft.AspNetCore.Identity;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Services;
using Xunit;

namespace TimeTracker.Api.Tests;

public sealed class DynamicPasswordPolicyValidatorTests
{
    [Fact]
    public async Task ValidateAsync_ReturnsSuccess_WhenPasswordSatisfiesPolicy()
    {
        var store = new TestSecurityPolicyStore(new SecurityPolicySnapshot(
            SessionTimeoutMinutes: 60,
            MaxFailedLoginAttempts: 5,
            PasswordMinLength: 10,
            PasswordRequireUppercase: true,
            PasswordRequireLowercase: true,
            PasswordRequireDigit: true,
            PasswordRequireNonAlphanumeric: true));

        var validator = new DynamicPasswordPolicyValidator(store);

        var result = await validator.ValidateAsync(
            manager: null!,
            user: new ApplicationUser(),
            password: "Abcdef1!23");

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsExpectedErrorCodes_WhenPasswordViolatesPolicy()
    {
        var store = new TestSecurityPolicyStore(new SecurityPolicySnapshot(
            SessionTimeoutMinutes: 60,
            MaxFailedLoginAttempts: 5,
            PasswordMinLength: 8,
            PasswordRequireUppercase: true,
            PasswordRequireLowercase: true,
            PasswordRequireDigit: true,
            PasswordRequireNonAlphanumeric: true));

        var validator = new DynamicPasswordPolicyValidator(store);

        var result = await validator.ValidateAsync(
            manager: null!,
            user: new ApplicationUser(),
            password: "abcdefg");

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordTooShort");
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresUpper");
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresDigit");
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresSpecial");
    }

    [Fact]
    public async Task ValidateAsync_Allows_PasswordEqualToMinimumLength()
    {
        var store = new TestSecurityPolicyStore(new SecurityPolicySnapshot(
            SessionTimeoutMinutes: 60,
            MaxFailedLoginAttempts: 5,
            PasswordMinLength: 8,
            PasswordRequireUppercase: false,
            PasswordRequireLowercase: false,
            PasswordRequireDigit: false,
            PasswordRequireNonAlphanumeric: false));

        var validator = new DynamicPasswordPolicyValidator(store);

        var result = await validator.ValidateAsync(
            manager: null!,
            user: new ApplicationUser(),
            password: "12345678");

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task ValidateAsync_Requires_Uppercase_WhenConfigured()
    {
        var result = await ValidateWithPolicy(
            password: "lowercase1!",
            passwordRequireUppercase: true);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresUpper");
    }

    [Fact]
    public async Task ValidateAsync_Requires_Lowercase_WhenConfigured()
    {
        var result = await ValidateWithPolicy(
            password: "UPPERCASE1!",
            passwordRequireLowercase: true);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresLower");
    }

    [Fact]
    public async Task ValidateAsync_Requires_Digit_WhenConfigured()
    {
        var result = await ValidateWithPolicy(
            password: "NoDigits!",
            passwordRequireDigit: true);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresDigit");
    }

    [Fact]
    public async Task ValidateAsync_Requires_SpecialCharacter_WhenConfigured()
    {
        var result = await ValidateWithPolicy(
            password: "NoSpecial123",
            passwordRequireNonAlphanumeric: true);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordRequiresSpecial");
    }

    [Fact]
    public async Task ValidateAsync_Treats_NullPassword_AsEmpty()
    {
        var result = await ValidateWithPolicy(
            password: null,
            passwordMinLength: 6);

        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordTooShort");
    }

    private static async Task<IdentityResult> ValidateWithPolicy(
        string? password,
        int passwordMinLength = 8,
        bool passwordRequireUppercase = false,
        bool passwordRequireLowercase = false,
        bool passwordRequireDigit = false,
        bool passwordRequireNonAlphanumeric = false)
    {
        var store = new TestSecurityPolicyStore(new SecurityPolicySnapshot(
            SessionTimeoutMinutes: 60,
            MaxFailedLoginAttempts: 5,
            PasswordMinLength: passwordMinLength,
            PasswordRequireUppercase: passwordRequireUppercase,
            PasswordRequireLowercase: passwordRequireLowercase,
            PasswordRequireDigit: passwordRequireDigit,
            PasswordRequireNonAlphanumeric: passwordRequireNonAlphanumeric));

        var validator = new DynamicPasswordPolicyValidator(store);

        return await validator.ValidateAsync(
            manager: null!,
            user: new ApplicationUser(),
            password: password);
    }

    private sealed class TestSecurityPolicyStore : ISecurityPolicyStore
    {
        private SecurityPolicySnapshot _policy;

        public TestSecurityPolicyStore(SecurityPolicySnapshot policy)
        {
            _policy = policy;
        }

        public Task<SecurityPolicySnapshot> GetAsync(CancellationToken ct = default)
        {
            return Task.FromResult(_policy);
        }

        public Task<SecurityPolicySnapshot> UpdateAsync(SecurityPolicySnapshot policy, CancellationToken ct = default)
        {
            _policy = policy;
            return Task.FromResult(_policy);
        }
    }
}
