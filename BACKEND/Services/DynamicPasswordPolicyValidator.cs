using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Services;

public sealed class DynamicPasswordPolicyValidator : IPasswordValidator<ApplicationUser>
{
    private readonly ISecurityPolicyStore _policyStore;

    public DynamicPasswordPolicyValidator(ISecurityPolicyStore policyStore)
    {
        _policyStore = policyStore;
    }

    public async Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user, string? password)
    {
        var value = password ?? string.Empty;
        var policy = await _policyStore.GetAsync();
        var errors = new List<IdentityError>();

        if (value.Length < policy.PasswordMinLength)
        {
            errors.Add(new IdentityError
            {
                Code = "PasswordTooShort",
                Description = $"A jelszó legalább {policy.PasswordMinLength} karakter hosszú legyen."
            });
        }

        if (policy.PasswordRequireUppercase && !value.Any(char.IsUpper))
        {
            errors.Add(new IdentityError
            {
                Code = "PasswordRequiresUpper",
                Description = "A jelszónak tartalmaznia kell legalább egy nagybetűt."
            });
        }

        if (policy.PasswordRequireLowercase && !value.Any(char.IsLower))
        {
            errors.Add(new IdentityError
            {
                Code = "PasswordRequiresLower",
                Description = "A jelszónak tartalmaznia kell legalább egy kisbetűt."
            });
        }

        if (policy.PasswordRequireDigit && !value.Any(char.IsDigit))
        {
            errors.Add(new IdentityError
            {
                Code = "PasswordRequiresDigit",
                Description = "A jelszónak tartalmaznia kell legalább egy számjegyet."
            });
        }

        if (policy.PasswordRequireNonAlphanumeric && !Regex.IsMatch(value, "[^a-zA-Z0-9]"))
        {
            errors.Add(new IdentityError
            {
                Code = "PasswordRequiresSpecial",
                Description = "A jelszónak tartalmaznia kell legalább egy speciális karaktert."
            });
        }

        return errors.Count > 0 ? IdentityResult.Failed(errors.ToArray()) : IdentityResult.Success;
    }
}
