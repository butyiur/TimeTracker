using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Domain.Entities;
using TimeTracker.Api.Domain.Identity;

namespace TimeTracker.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.UseOpenIddict();

        // Ownership mappings (maradhat, csak lent módosítjuk a user típust!)
        builder.Entity<Project>(b =>
        {
            b.HasOne(p => p.OwnerUser)
             .WithMany()
             .HasForeignKey(p => p.OwnerUserId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<TimeEntry>(b =>
        {
            b.HasOne(t => t.User)
             .WithMany()
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(t => t.Project)
             .WithMany()
             .HasForeignKey(t => t.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}