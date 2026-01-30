using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueRunningTimeEntryPerUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
                migrationBuilder.Sql(@"
                    CREATE UNIQUE INDEX IX_TimeEntries_OwnerUserId_Running
                    ON TimeEntries(OwnerUserId)
                    WHERE EndUtc IS NULL;
                    ");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
                migrationBuilder.Sql(@"
                    DROP INDEX IX_TimeEntries_OwnerUserId_Running ON TimeEntries;
                    ");
        }
    }
}
