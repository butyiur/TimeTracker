namespace TimeTracker.Api.Contracts.Audit;

public sealed class PagedAuditResponse
{
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public List<AuditLogDto> Items { get; set; } = new();
}