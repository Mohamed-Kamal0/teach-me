using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeachersLessons.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    FullName = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Students",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    Phone = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    Bio = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Students", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_Students_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Teachers",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    JoinCode = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    DecidedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    DecidedByUserId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teachers", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_Teachers_Users_DecidedByUserId",
                        column: x => x.DecidedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Teachers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Enrollments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeacherUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    JoinedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    LastViewedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Enrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Enrollments_Students_StudentUserId",
                        column: x => x.StudentUserId,
                        principalTable: "Students",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Enrollments_Teachers_TeacherUserId",
                        column: x => x.TeacherUserId,
                        principalTable: "Teachers",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Lessons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeacherUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    RecordingUrl = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    HandoutUrl = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    QuizUrl = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    AnswersUrl = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    DurationMinutes = table.Column<int>(type: "INTEGER", nullable: false),
                    QuizMaxScore = table.Column<int>(type: "INTEGER", nullable: false),
                    PassMark = table.Column<int>(type: "INTEGER", nullable: false),
                    OpensAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    QuizOpensAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    AnswersOpenAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lessons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lessons_Teachers_TeacherUserId",
                        column: x => x.TeacherUserId,
                        principalTable: "Teachers",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Marks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    LessonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Marks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Marks_Lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "Lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Marks_Students_StudentUserId",
                        column: x => x.StudentUserId,
                        principalTable: "Students",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_StudentUserId_TeacherUserId",
                table: "Enrollments",
                columns: new[] { "StudentUserId", "TeacherUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_TeacherUserId",
                table: "Enrollments",
                column: "TeacherUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_TeacherUserId_OrderIndex",
                table: "Lessons",
                columns: new[] { "TeacherUserId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Marks_LessonId_StudentUserId",
                table: "Marks",
                columns: new[] { "LessonId", "StudentUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Marks_StudentUserId",
                table: "Marks",
                column: "StudentUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Teachers_DecidedByUserId",
                table: "Teachers",
                column: "DecidedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Teachers_JoinCode",
                table: "Teachers",
                column: "JoinCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Enrollments");

            migrationBuilder.DropTable(
                name: "Marks");

            migrationBuilder.DropTable(
                name: "Lessons");

            migrationBuilder.DropTable(
                name: "Students");

            migrationBuilder.DropTable(
                name: "Teachers");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
