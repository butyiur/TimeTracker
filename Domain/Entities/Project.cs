using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Domain.Entities;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;

    public string OwnerUserId { get; set; } = null!;
    public ApplicationUser OwnerUser { get; set; } = null!;

}