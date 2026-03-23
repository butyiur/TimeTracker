using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using OpenIddict.Abstractions;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Data;
using TimeTracker.Api.Domain.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using System.Security.Claims;
using Microsoft.OpenApi.Models;
using TimeTracker.Api.Middleware;
using OpenIddict.Server.AspNetCore;
using TimeTracker.Api.Services;

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
builder.Services.AddSingleton<ISecurityPolicyStore, JsonSecurityPolicyStore>();
builder.Services.AddScoped<IPasswordValidator<ApplicationUser>, DynamicPasswordPolicyValidator>();
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

builder.Services.AddScoped<TimeTracker.Api.Services.IAuditService, TimeTracker.Api.Services.AuditService>();
builder.Services.AddScoped<TimeTracker.Api.Services.IAuditWriter, TimeTracker.Api.Services.DbAuditWriter>();
builder.Services.AddScoped<TimeTracker.Api.Data.IAuditWriter, TimeTracker.Api.Data.AuditWriter>();

// Razor Pages kell az Identity UI-hoz
builder.Services.AddRazorPages();

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
        options.Password.RequiredLength = 1;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredUniqueChars = 1;

        options.SignIn.RequireConfirmedAccount = false;

        // 2FA működéshez hasznos (nem kötelező, de tiszta)
        options.SignIn.RequireConfirmedEmail = false;
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
        options.SetAuthorizationEndpointUris("/connect/authorize");
        options.SetTokenEndpointUris("/connect/token");

        options.AllowAuthorizationCodeFlow();
        options.AllowRefreshTokenFlow();
        options.RequireProofKeyForCodeExchange();

        options.RegisterScopes("api", "profile", "email", "roles", "offline_access");


        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
            .EnableStatusCodePagesIntegration()
            //.EnableTokenEndpointPassthrough()
            .EnableAuthorizationEndpointPassthrough();

        options.DisableAccessTokenEncryption(); // ok devben
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });



builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = "Dynamic";
    options.DefaultChallengeScheme = "Dynamic";
})
.AddPolicyScheme("Dynamic", "Dynamic", options =>
{
    options.ForwardDefaultSelector = context =>
    {
        var path = context.Request.Path;

        if (path.StartsWithSegments("/connect") || path.StartsWithSegments("/.well-known"))
            return OpenIddictServerAspNetCoreDefaults.AuthenticationScheme;

        return OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    };
});

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    Policies.AddTimeTrackerPolicies(options);
});

// API-barát cookie redirect-ek
builder.Services.ConfigureApplicationCookie(options =>
{
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

    options.Events.OnValidatePrincipal = async ctx =>
    {
        var issuedUtc = ctx.Properties.IssuedUtc;
        if (issuedUtc is null) return;

        var policyStore = ctx.HttpContext.RequestServices.GetRequiredService<ISecurityPolicyStore>();
        var policy = await policyStore.GetAsync();

        var elapsed = DateTimeOffset.UtcNow - issuedUtc.Value;
        if (elapsed > TimeSpan.FromMinutes(policy.SessionTimeoutMinutes))
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        }
    };
});

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("default", context =>
    {
        var path = context.Request.Path.Value ?? "";

        if (path.StartsWith("/connect", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/.well-known", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/Identity", StringComparison.OrdinalIgnoreCase))
        {
            return RateLimitPartition.GetNoLimiter("nolimit");
        }

        return RateLimitPartition.GetFixedWindowLimiter("fixed", _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1)
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

builder.Services.AddCors(options =>
{
    options.AddPolicy("spa", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});


var app = builder.Build();


app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-App-Instance"] = "TimeTracker.Api";
    await next();
});

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "TimeTracker.Api v1");

    c.OAuthClientId("timetracker-swagger");
    c.OAuthAppName("TimeTracker Swagger");

    c.OAuthUsePkce();                 // PKCE kötelező a kliens miatt
    c.OAuthScopes("api", "offline_access"); // csak akkor, ha tényleg kell refresh token
});

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/connect/authorize"))
        Console.WriteLine("=== HIT /connect/authorize === " + ctx.Request.Method + " " + ctx.Request.Path + ctx.Request.QueryString);

    await next();

    if (ctx.Request.Path.StartsWithSegments("/connect/authorize"))
        Console.WriteLine("=== AFTER /connect/authorize === Status " + ctx.Response.StatusCode);
});


app.UseCors("spa");

// (Rate limiter csak a normál API-ra, connect-re NE)
// csak akkor limitálunk, ha NEM /connect, NEM /.well-known, NEM /Identity
//app.UseWhen(
// ctx => !(ctx.Request.Path.StartsWithSegments("/connect")
//   || ctx.Request.Path.StartsWithSegments("/.well-known")
//|| ctx.Request.Path.StartsWithSegments("/Identity")),
//branch =>
// {
//branch.UseRateLimiter();
//});

//app.UseRateLimiter();

app.UseAuthentication();

app.Use(async (ctx, next) =>
{
    if (!ctx.Request.Path.StartsWithSegments("/api"))
    {
        await next();
        return;
    }

    if (ctx.User?.Identity?.IsAuthenticated != true)
    {
        await next();
        return;
    }

    var userId =
        ctx.User.FindFirstValue(OpenIddictConstants.Claims.Subject)
        ?? ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);

    if (string.IsNullOrWhiteSpace(userId))
    {
        await next();
        return;
    }

    var userManager = ctx.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var user = await userManager.FindByIdAsync(userId);
    if (user is null)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new { error = "user_not_found" });
        return;
    }

    if (!user.RegistrationApproved)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        await ctx.Response.WriteAsJsonAsync(new { error = "pending_registration_approval" });
        return;
    }

    if (!user.EmploymentActive)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        await ctx.Response.WriteAsJsonAsync(new { error = "inactive_profile" });
        return;
    }

    if (await userManager.IsLockedOutAsync(user))
    {
        ctx.Response.StatusCode = StatusCodes.Status423Locked;
        await ctx.Response.WriteAsJsonAsync(new { error = "account_locked" });
        return;
    }

    await next();
});

app.UseAuthorization();

app.MapControllers();
app.MapRazorPages();
if (app.Environment.IsDevelopment())
{
    app.MapGet("/debug/endpoints", (IEnumerable<EndpointDataSource> sources) =>
    {
        var list = sources.SelectMany(s => s.Endpoints)
            .Select(e => new
            {
                displayName = e.DisplayName,
                route = (e as RouteEndpoint)?.RoutePattern?.RawText
            })
            .ToList();

        return Results.Ok(list);
    });
}

await IdentitySeeder.SeedAsync(app.Services);
await OpenIddictSeeder.SeedAsync(app.Services);

app.Run();
