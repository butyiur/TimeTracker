using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Auth;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/hr")]
[Authorize(Policy = Policies.HrOnly)]
public class HrController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, area = "hr" });
}