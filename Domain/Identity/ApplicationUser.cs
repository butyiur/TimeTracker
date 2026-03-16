using Microsoft.AspNetCore.Identity;

namespace TimeTracker.Api.Domain.Identity;

public class ApplicationUser : IdentityUser
{
    // k�s�bb: FullName, Department, stb.
    public bool EmploymentActive { get; set; } = true;
    public bool RegistrationApproved { get; set; } = true;
    public DateTimeOffset? RegistrationRequestedAtUtc { get; set; }
}