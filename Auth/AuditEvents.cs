namespace TimeTracker.Api.Auth;

public static class AuditEvents
{
    public const string AuthLoginSuccess = "auth.login.success";
    public const string AuthLoginFailed = "auth.login.failed";
    public const string AuthLogout = "auth.logout";

    public const string ReportExportCsv = "report.export.csv";
}