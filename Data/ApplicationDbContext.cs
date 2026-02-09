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
    public DbSet<ProjectAssignment> ProjectAssignments => Set<ProjectAssignment>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();



    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.UseOpenIddict();

        // Ownership mappings (maradhat, csak lent módosítjuk a user típust!)
        builder.Entity<Project>(b =>
        {
            b.HasOne(p => p.CreatedByUser)
             .WithMany()
             .HasForeignKey(p => p.CreatedByUserId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(p => p.Name).IsUnique(false);
        });

        builder.Entity<ProjectAssignment>(b =>
        {
            b.HasKey(x => new { x.ProjectId, x.UserId });

            b.HasOne(x => x.Project)
             .WithMany(p => p.Assignments)
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.User)
             .WithMany()
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => x.UserId);
        });

        builder.Entity<TimeEntry>(b =>
        {
            b.HasOne(x => x.OwnerUser)
             .WithMany()
             .HasForeignKey(x => x.OwnerUserId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(x => x.Project)
             .WithMany()
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<AuditLog>(b =>
        {
            b.Property(x => x.EventType).HasMaxLength(128).IsRequired();
            b.Property(x => x.Result).HasMaxLength(32).IsRequired();

            b.Property(x => x.UserId).HasMaxLength(450);
            b.Property(x => x.UserEmail).HasMaxLength(256);

            b.Property(x => x.IpAddress).HasMaxLength(64);
            b.Property(x => x.UserAgent).HasMaxLength(512);

            b.Property(x => x.CorrelationId).HasMaxLength(128);

            b.HasIndex(x => x.TimestampUtc);
            b.HasIndex(x => x.EventType);
            b.HasIndex(x => x.UserId);
        });
    }
}