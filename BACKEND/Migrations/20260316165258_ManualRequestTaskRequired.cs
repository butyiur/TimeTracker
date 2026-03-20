using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class ManualRequestTaskRequired : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests");

            migrationBuilder.Sql(@"
UPDATE r
SET r.TaskId = t.Id
FROM ManualTimeEntryRequests r
OUTER APPLY (
    SELECT TOP (1) pt.Id
    FROM ProjectTasks pt
    WHERE pt.ProjectId = r.ProjectId
    ORDER BY CASE WHEN pt.IsActive = 1 THEN 0 ELSE 1 END, pt.Id
) t
WHERE r.TaskId IS NULL AND t.Id IS NOT NULL;

DELETE FROM ManualTimeEntryRequests
WHERE TaskId IS NULL;
");

            migrationBuilder.AlterColumn<int>(
                name: "TaskId",
                table: "ManualTimeEntryRequests",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests",
                column: "TaskId",
                principalTable: "ProjectTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests");

            migrationBuilder.AlterColumn<int>(
                name: "TaskId",
                table: "ManualTimeEntryRequests",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddForeignKey(
                name: "FK_ManualTimeEntryRequests_ProjectTasks_TaskId",
                table: "ManualTimeEntryRequests",
                column: "TaskId",
                principalTable: "ProjectTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
