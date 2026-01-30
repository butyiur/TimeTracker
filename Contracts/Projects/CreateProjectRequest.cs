namespace TimeTracker.Api.Contracts.Projects;

// „MVP-ben OwnerUserId az adott dolgozóhoz rendelt projektet jelenti.”
public sealed record CreateProjectRequest(string Name, string OwnerUserId);