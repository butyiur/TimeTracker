using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TimeTracker.Api.Auth;

namespace TimeTracker.Api.Controllers;

[ApiController]
[Route("api/employee")]
[Authorize(Policy = Policies.EmployeeOnly)]
public class EmployeeController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { ok = true, area = "employee" });
}