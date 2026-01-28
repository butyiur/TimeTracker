using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerUserIdToTimeEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TimeEntries_AspNetUsers_UserId",
                table: "TimeEntries");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "TimeEntries",
                newName: "OwnerUserId");

            migrationBuilder.RenameIndex(
                name: "IX_TimeEntries_UserId",
                table: "TimeEntries",
                newName: "IX_TimeEntries_OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TimeEntries_AspNetUsers_OwnerUserId",
                table: "TimeEntries",
                column: "OwnerUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TimeEntries_AspNetUsers_OwnerUserId",
                table: "TimeEntries");

            migrationBuilder.RenameColumn(
                name: "OwnerUserId",
                table: "TimeEntries",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_TimeEntries_OwnerUserId",
                table: "TimeEntries",
                newName: "IX_TimeEntries_UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TimeEntries_AspNetUsers_UserId",
                table: "TimeEntries",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
