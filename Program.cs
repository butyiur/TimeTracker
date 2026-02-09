using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using System.Security.Claims;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using Microsoft.AspNetCore.Authorization;

Console.WriteLine("=== PROGRAM.CS LOADED ===");

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<TimeTracker.Api.Services.IAuditService, TimeTracker.Api.Services.AuditService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<TimeTracker.Api.Data.IAuditWriter, TimeTracker.Api.Data.AuditWriter>();

// Razor Pages kell az Identity UI-hoz (login/logout/2FA később)
builder.Services.AddRazorPages();

// DB
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.UseOpenIddict();
});

// Identity (interactive login + token providers -> 2FA alap)
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// OpenIddict
// OpenIddict
builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
               .UseDbContext<ApplicationDbContext>();
    })
    .AddServer(options =>
    {
        options.SetAuthorizationEndpointUris("/connect/authorize");
        options.SetTokenEndpointUris("/connect/token");

        options.AllowAuthorizationCodeFlow();
        options.AllowRefreshTokenFlow();
        options.RequireProofKeyForCodeExchange();

        options.RegisterScopes("api", "profile", "email", "roles");

        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough();

        options.DisableAccessTokenEncryption(); // dev
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// Authorization (policies marad)
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.EmployeeOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Employee));

    options.AddPolicy(Policies.HrOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.HR));

    options.AddPolicy(Policies.AdminOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Admin));
});

// API-barát cookie redirect-ek (maradhat)
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = ctx =>
    {
        // OpenIddict authorize/login flow-nál KELL a redirect
        if (ctx.Request.Path.StartsWithSegments("/connect"))
        {
            ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        }

        // API endpointoknál maradjon a 401
        ctx.Response.StatusCode = 401;
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        // OpenIddict flow közben itt is jobb a redirect
        if (ctx.Request.Path.StartsWithSegments("/connect"))
        {
            ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        }

        ctx.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
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

// DEBUG ENDPOINTOK – IDE!
if (app.Environment.IsDevelopment())
{
    app.MapGet("/secure", (ClaimsPrincipal user) =>
    {
        return Results.Ok(new
        {
            name = user.Identity?.Name,
            claims = user.Claims.Select(c => new { c.Type, c.Value })
        });
    })
    .WithDisplayName("HTTP: GET /secure")
    .RequireAuthorization(policy =>
    {
        policy.AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
        policy.RequireAuthenticatedUser();
    });

    app.MapGet("/debug/endpoints", (IEnumerable<EndpointDataSource> sources) =>
    {
        var list = sources
            .SelectMany(s => s.Endpoints)
            .Select(e => new
            {
                displayName = e.DisplayName,
                route = (e as RouteEndpoint)?.RoutePattern?.RawText
            })
            .ToList();

        return Results.Ok(list);
    })
    .WithDisplayName("HTTP: GET /debug/endpoints");
}


// ❗❗ EZ MINDIG UTOLSÓ
app.Run();