// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.
#nullable disable

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Auth;
using TimeTracker.Api.Services;

namespace TimeTracker.Api.Areas.Identity.Pages.Account
{
    public class LoginModel : PageModel
    {
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly TimeTracker.Api.Services.IAuditService _audit;
        private readonly ISecurityPolicyStore _securityPolicyStore;
        private readonly ILogger<LoginModel> _logger;

        public LoginModel(SignInManager<ApplicationUser> signInManager,UserManager<ApplicationUser> userManager,TimeTracker.Api.Services.IAuditService audit,ISecurityPolicyStore securityPolicyStore,ILogger<LoginModel> logger)
        {
            _signInManager = signInManager;
            _userManager = userManager;
            _audit = audit;
            _securityPolicyStore = securityPolicyStore;
            _logger = logger;
        }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        [BindProperty]
        public InputModel Input { get; set; }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        public IList<AuthenticationScheme> ExternalLogins { get; set; }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        public string ReturnUrl { get; set; }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        [TempData]
        public string ErrorMessage { get; set; }

        /// <summary>
        ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
        ///     directly from your code. This API may change or be removed in future releases.
        /// </summary>
        public class InputModel
        {
            /// <summary>
            ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
            ///     directly from your code. This API may change or be removed in future releases.
            /// </summary>
            [Required]
            public string Email { get; set; }

            /// <summary>
            ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
            ///     directly from your code. This API may change or be removed in future releases.
            /// </summary>
            [Required]
            [DataType(DataType.Password)]
            public string Password { get; set; }

            /// <summary>
            ///     This API supports the ASP.NET Core Identity default UI infrastructure and is not intended to be used
            ///     directly from your code. This API may change or be removed in future releases.
            /// </summary>
            [Display(Name = "Remember me?")]
            public bool RememberMe { get; set; }
        }

        public async Task OnGetAsync(string returnUrl = null)
        {
            if (!string.IsNullOrEmpty(ErrorMessage))
            {
                ModelState.AddModelError(string.Empty, ErrorMessage);
            }

            returnUrl ??= Url.Content("~/");

            // Clear the existing external cookie to ensure a clean login process
            await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);

            ExternalLogins = (await _signInManager.GetExternalAuthenticationSchemesAsync()).ToList();

            ReturnUrl = returnUrl;
        }

        public async Task<IActionResult> OnPostAsync(string returnUrl = null)
        {
            returnUrl ??= Url.Content("~/");

            ExternalLogins = (await _signInManager.GetExternalAuthenticationSchemesAsync()).ToList();

            if (!ModelState.IsValid)
                return Page();

            var loginIdentifier = (Input.Email ?? string.Empty).Trim();
            var user = await ResolveUserByLoginIdentifierAsync(loginIdentifier);
            var signInUserName = user?.UserName ?? loginIdentifier;

            var policy = await _securityPolicyStore.GetAsync();

            if (user != null)
            {
                if (!user.RegistrationApproved)
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.pending_registration_approval",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email);

                    ModelState.AddModelError(string.Empty, "A regisztráció még HR jóváhagyásra vár. Belépés csak jóváhagyás után lehetséges.");
                    return Page();
                }

                if (!user.EmploymentActive)
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.inactive_profile",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email);

                    ModelState.AddModelError(string.Empty, "A fiók inaktív státuszú. Fordulj a HR osztályhoz.");
                    return Page();
                }

                if (!user.LockoutEnabled)
                    await _userManager.SetLockoutEnabledAsync(user, true);

                if (await _userManager.IsLockedOutAsync(user))
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.locked_out",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email);

                    ModelState.AddModelError(string.Empty, "A fiók zárolva van. Kérj jelszó-visszaállítást vagy fordulj adminhoz.");
                    return Page();
                }
            }

            if (user is not null)
            {
                var roles = await _userManager.GetRolesAsync(user);
                var isPrivileged = roles.Any(r =>
                    string.Equals(r, Roles.Admin, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(r, Roles.HR, StringComparison.OrdinalIgnoreCase));

                if (isPrivileged && !user.TwoFactorEnabled)
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.requires_2fa_enrollment",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email,
                        data: new { roles });

                    ModelState.AddModelError(string.Empty, "HR/Admin belépéshez kötelező a 2FA. Kérd egy admin segítségét a 2FA beállításhoz.");
                    return Page();
                }
            }

            var result = await _signInManager.PasswordSignInAsync(
                signInUserName,
                Input.Password,
                Input.RememberMe,
                lockoutOnFailure: false);

            if (user?.TwoFactorEnabled == true)
            {
                // Ensure next login consistently asks for TOTP on this browser.
                await _signInManager.ForgetTwoFactorClientAsync();
            }

            if (result.Succeeded)
            {
                if (user is null)
                    user = await ResolveUserByLoginIdentifierAsync(signInUserName);

                var userId = user?.Id;
                var email = user?.Email ?? loginIdentifier;

                _logger.LogInformation("User logged in.");

                await _audit.WriteAsync(
                    eventType: "auth.login.success",
                    result: "success",
                    userId: userId,
                    userEmail: email);

                if (user != null)
                    await _userManager.ResetAccessFailedCountAsync(user);

                return LocalRedirect(returnUrl);
            }

            if (result.RequiresTwoFactor)
            {
                // Audit: 2FA required (user already has it enabled)
                if (user != null)
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.requires_2fa",
                        result: "success",
                        userId: user.Id,
                        userEmail: user.Email);
                }

                return RedirectToPage("./LoginWith2fa", new { ReturnUrl = returnUrl, RememberMe = Input.RememberMe });
            }

            if (result.IsLockedOut)
            {
                _logger.LogWarning("User account locked out.");

                if (user != null)
                {
                    await _audit.WriteAsync(
                        eventType: "auth.login.locked_out",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email);
                }

                ModelState.AddModelError(string.Empty, "A fiók zárolva van. Kérj jelszó-visszaállítást vagy fordulj adminhoz.");
                return Page();
            }

            // Fail
            if (user != null)
            {
                await _userManager.AccessFailedAsync(user);
                var failedCount = await _userManager.GetAccessFailedCountAsync(user);

                if (failedCount >= policy.MaxFailedLoginAttempts)
                {
                    await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddYears(100));

                    await _audit.WriteAsync(
                        eventType: "auth.login.locked_out",
                        result: "fail",
                        userId: user.Id,
                        userEmail: user.Email,
                        data: new { failedCount, threshold = policy.MaxFailedLoginAttempts });

                    ModelState.AddModelError(string.Empty, "Túl sok sikertelen próbálkozás miatt a fiók zárolva lett.");
                    return Page();
                }
            }

            await _audit.WriteAsync(
                eventType: "auth.login.fail",
                result: "fail",
                userId: user?.Id,
                userEmail: user?.Email ?? loginIdentifier);

            ModelState.AddModelError(string.Empty, "Invalid login attempt.");
            return Page();
        }

        private async Task<ApplicationUser?> ResolveUserByLoginIdentifierAsync(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return null;

            var byEmail = await _userManager.FindByEmailAsync(identifier);
            if (byEmail is not null)
                return byEmail;

            return await _userManager.FindByNameAsync(identifier);
        }
    }
}
