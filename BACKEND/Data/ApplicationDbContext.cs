using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TimeTracker.Api.Domain.TimeTracking;
using TimeTracker.Api.Domain.Identity;
using TimeTracker.Api.Domain.Entities;

namespace TimeTracker.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> ProjectTasks => Set<ProjectTask>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<ManualTimeEntryRequest> ManualTimeEntryRequests => Set<ManualTimeEntryRequest>();
    public DbSet<ProjectAssignment> ProjectAssignments => Set<ProjectAssignment>();
    public DbSet<Approval> Approvals => Set<Approval>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.UseOpenIddict();

        builder.Entity<ApplicationUser>(b =>
        {
            b.Property(x => x.EmploymentActive).HasDefaultValue(true);
            b.Property(x => x.RegistrationApproved).HasDefaultValue(true);
        });

        // Project
        builder.Entity<Project>(b =>
        {
            b.Property(x => x.Name).HasMaxLength(256).IsRequired();
            b.Property(x => x.IsActive).HasDefaultValue(true);
            b.HasIndex(x => x.Name).IsUnique(false);

            b.HasOne(x => x.CreatedByUser)
             .WithMany()
             .HasForeignKey(x => x.CreatedByUserId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ProjectTask>(b =>
        {
            b.Property(x => x.Name).HasMaxLength(256).IsRequired();
            b.HasIndex(x => new { x.ProjectId, x.Name }).IsUnique(false);

            b.HasOne(x => x.Project)
             .WithMany(p => p.Tasks)
             .HasForeignKey(x => x.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ProjectAssignment
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
             .OnDelete(DeleteBehavior.Cascade);
        });

        // TimeEntry
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

            b.HasOne(x => x.Task)
             .WithMany()
             .HasForeignKey(x => x.TaskId)
             .OnDelete(DeleteBehavior.SetNull);

            b.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<ManualTimeEntryRequest>(b =>
        {
            b.HasIndex(x => new { x.RequesterUserId, x.Status, x.CreatedAtUtc });
            b.HasIndex(x => x.ProjectId);

            b.HasOne(x => x.Task)
             .WithMany()
             .HasForeignKey(x => x.TaskId)
             .OnDelete(DeleteBehavior.Restrict);

            b.Property(x => x.Description).HasMaxLength(1000);
            b.Property(x => x.ReviewerComment).HasMaxLength(500);
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
