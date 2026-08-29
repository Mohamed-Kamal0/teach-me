using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachMe.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTeacherSubject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "Teachers",
                type: "TEXT",
                maxLength: 60,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Subject",
                table: "Teachers");
        }
    }
}
