using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTeacherPhone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Teachers",
                type: "TEXT",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Teachers");
        }
    }
}
