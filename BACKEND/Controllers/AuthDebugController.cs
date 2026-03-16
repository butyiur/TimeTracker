using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Validation.AspNetCore;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/auth/debug")]
public class AuthDebugController : ControllerBase
{
    [HttpGet("me")]
    [Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
    public IActionResult Me() => Ok(new
    {
        name = User.Identity?.Name,
        roles = User.Claims.Where(c => c.Type is "role" or "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                           .Select(c => c.Value)
                           .Distinct()
                           .ToArray(),
        claims = User.Claims.Select(c => new { c.Type, c.Value }).ToArray()
    });
}