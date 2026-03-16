using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlannedHoursToProjectsAndTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlannedHours",
                table: "ProjectTasks",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlannedHours",
                table: "Projects",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlannedHours",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "PlannedHours",
                table: "Projects");
        }
    }
}
