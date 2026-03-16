namespace TimeTracker.Api.Auth;

public static class AuditEventTypes
{
    public const string AuthLoginSuccess = "auth.login.success";
    public const string AuthLoginFailure = "auth.login.failure";
    public const string AuthLogout = "auth.logout";
    public const string AuthTokenIssued = "auth.token.issued";
}