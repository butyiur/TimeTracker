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

        builder.Entity<TimeEntry>()
    .HasOne(x => x.OwnerUser)
    .WithMany()
    .HasForeignKey(x => x.OwnerUserId)
    .OnDelete(DeleteBehavior.Restrict);
    }
}