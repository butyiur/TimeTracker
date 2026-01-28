using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TimeTracker.Api.Data;
using OpenIddict.Validation.AspNetCore;
using TimeTracker.Api.Domain.Identity;
using System.Data;
using TimeTracker.Api.Auth;
using System.Security.Claims;


Console.WriteLine("=== PROGRAM.CS LOADED ===");

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DB
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.UseOpenIddict();
});

builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// OpenIddict
builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
               .UseDbContext<ApplicationDbContext>();
    })
    .AddServer(options =>
    {
        options.SetTokenEndpointUris("/connect/token");
        options.AllowClientCredentialsFlow();

        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
               .EnableTokenEndpointPassthrough();

        options.RegisterScopes("api");


        // Dev-ben oké
        options.DisableAccessTokenEncryption();
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// Auth middleware
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
});


builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.EmployeeOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Employee));

    options.AddPolicy(Policies.HrOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.HR));

    options.AddPolicy(Policies.AdminOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Admin));
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();


// DEBUG
if (app.Environment.IsDevelopment())
{
    app.MapGet("/debug/claims", (System.Security.Claims.ClaimsPrincipal user) =>
    {
        var claims = user.Claims.Select(c => new { c.Type, c.Value }).ToList();
        return Results.Ok(claims);
    }).RequireAuthorization();
}

app.MapGet("/secure", (System.Security.Claims.ClaimsPrincipal user) =>
{
    return Results.Ok(new { user = user.Identity?.Name ?? "anonymous" });
}).RequireAuthorization();

await OpenIddictSeeder.SeedAsync(app.Services);
await IdentitySeeder.SeedAsync(app.Services);

app.Run();