namespace TimeTracker.Api.Contracts.Reports;

public sealed record TimeEntryReportRow(
    int Id,
    int ProjectId,
    string ProjectName,
    string UserId,
    string UserEmail,
    DateTime StartUtc,
    DateTime? EndUtc,
    int? DurationMinutes
);

public sealed record TimeEntrySummaryRow(
    int ProjectId,
    string ProjectName,
    string UserId,
    string UserEmail,
    int TotalMinutes
);