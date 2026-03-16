using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class TaskLinkOnEntriesAndRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TaskId",
                table: "TimeEntries",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TaskId",
                table: "ManualTimeEntryRequests",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_TaskId",
                table: "TimeEntries",
                column: "TaskId");

            migrationBuilder.CreateIndex(
                name: "IX_ManualTimeEntryRequests_TaskId",
                table: "ManualTimeEntryRequests",
                column: "TaskId");

            migrationBuilder.AddForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests",
                column: "TaskId",
                principalTable: "ProjectTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TimeEntries_ProjectTasks_TaskId",
                table: "TimeEntries",
                column: "TaskId",
                principalTable: "ProjectTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_TimeEntries_ProjectTasks_TaskId",
                table: "TimeEntries");

            migrationBuilder.DropIndex(
                name: "IX_TimeEntries_TaskId",
                table: "TimeEntries");

            migrationBuilder.DropIndex(
                name: "IX_ManualTimeEntryRequests_TaskId",
                table: "ManualTimeEntryRequests");

            migrationBuilder.DropColumn(
                name: "TaskId",
                table: "TimeEntries");

            migrationBuilder.DropColumn(
                name: "TaskId",
                table: "ManualTimeEntryRequests");
        }
    }
}
