using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachersLessons.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAvatars : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Avatars",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Bytes = table.Column<byte[]>(type: "BLOB", nullable: false),
                    ContentType = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    ByteSize = table.Column<int>(type: "INTEGER", nullable: false),
                    ETag = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Avatars", x => x.UserId);
                    table.CheckConstraint("CK_Avatars_ByteSize", "\"ByteSize\" <= 200000");
                    table.ForeignKey(
                        name: "FK_Avatars_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Avatars");
        }
    }
}
