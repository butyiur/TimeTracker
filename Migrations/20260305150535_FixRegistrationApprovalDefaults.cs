using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixRegistrationApprovalDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "RegistrationApproved",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit");

                        // Existing users (created before approval flow) should stay usable.
                        // Keep truly pending registrations untouched (they have RegistrationRequestedAtUtc set).
                        migrationBuilder.Sql(@"
UPDATE [AspNetUsers]
SET [RegistrationApproved] = CAST(1 AS bit)
WHERE [RegistrationApproved] = CAST(0 AS bit)
    AND [RegistrationRequestedAtUtc] IS NULL;
");

            migrationBuilder.AlterColumn<bool>(
                name: "EmploymentActive",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "RegistrationApproved",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true);

            migrationBuilder.AlterColumn<bool>(
                name: "EmploymentActive",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true);
        }
    }
}
