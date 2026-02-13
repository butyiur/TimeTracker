using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using System.Security.Claims;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.OpenApi.Models;

Console.WriteLine("=== PROGRAM.CS LOADED ===");

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "TimeTracker.Api", Version = "v1" });

    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            AuthorizationCode = new OpenApiOAuthFlow
            {
                AuthorizationUrl = new Uri("https://localhost:7037/connect/authorize"),
                TokenUrl = new Uri("https://localhost:7037/connect/token"),
                Scopes = new Dictionary<string, string>
                {
                    ["api"] = "TimeTracker API access",
                    ["offline_access"] = "Refresh token access"
                }
            }
        }
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "oauth2"
                }
            },
            new[] { "api", "offline_access" }
        }
    });
});

builder.Services.AddHttpContextAccessor();

// Audit DI (ahogy nálad volt, csak egyszer)
builder.Services.AddScoped<TimeTracker.Api.Services.IAuditService, TimeTracker.Api.Services.AuditService>();
builder.Services.AddScoped<TimeTracker.Api.Data.IAuditWriter, TimeTracker.Api.Data.AuditWriter>();
builder.Services.AddScoped<TimeTracker.Api.Services.IAuditWriter, TimeTracker.Api.Services.DbAuditWriter>();

// Razor Pages kell az Identity UI-hoz
builder.Services.AddRazorPages();

// DB
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.UseOpenIddict();
});

// ✅ IDENTITY: CSAK EZ MARAD!
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

        //  ide VEDD FEL
        options.RegisterScopes("api", "profile", "email", "roles", "offline_access");


        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableStatusCodePagesIntegration();

        options.DisableAccessTokenEncryption(); // ok devben
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// Authorization policies
builder.Services.AddAuthorization(options =>
{

    Policies.AddTimeTrackerPolicies(options);
    options.AddPolicy(Policies.EmployeeOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Employee));

    options.AddPolicy(Policies.HrOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.HR));

    options.AddPolicy(Policies.AdminOnly, p =>
        p.RequireAuthenticatedUser().RequireRole(Roles.Admin));
});

// API-barát cookie redirect-ek
builder.Services.ConfigureApplicationCookie(options =>
{
    // ✅ Identity UI valódi útvonalai
    options.LoginPath = "/Identity/Account/Login";
    options.LogoutPath = "/Identity/Account/Logout";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";

    options.Events.OnRedirectToLogin = ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/connect"))
        {
            ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        }

        ctx.Response.StatusCode = 401;
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/connect"))
        {
            ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        }

        ctx.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
});

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ip,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            });
    });

    options.AddPolicy("admin", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ip,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            });
    });
});


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "TimeTracker.Api v1");

        c.OAuthClientId("timetracker-swagger");     // ez nálad már seeded
        c.OAuthAppName("TimeTracker Swagger");
        c.OAuthUsePkce();                           // PKCE kötelező
        c.OAuthScopes("api", "offline_access");     // ha nem kell refresh: csak "api"
    });
}

app.UseHttpsRedirection();
app.UseStaticFiles();

// Rate limiter middleware
app.UseRateLimiter();

// Auth middlewares
app.UseAuthentication();
app.UseAuthorization();


app.MapGet("/", (HttpContext ctx) =>
{
    if (app.Environment.IsDevelopment())
        return Results.Redirect("/swagger");
    return Results.Ok("TimeTracker API");
});

// Endpoints
app.MapControllers();
app.MapRazorPages();

// ✅ DI DUMP: legyen a seeder ELŐTT, mert most azt debugoljuk
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var store = scope.ServiceProvider.GetService<IUserStore<ApplicationUser>>();
    var roleStore = scope.ServiceProvider.GetService<IUserRoleStore<ApplicationUser>>();

    Console.WriteLine("IUserStore<ApplicationUser> = " + store?.GetType().FullName);
    Console.WriteLine("IUserRoleStore<ApplicationUser> = " + roleStore?.GetType().FullName);
}

// ✅ Seeder most már nem fog RoleStore hibán elhasalni
await IdentitySeeder.SeedAsync(app.Services);
await OpenIddictSeeder.SeedAsync(app.Services);

// DEBUG endpointok
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

app.Run();