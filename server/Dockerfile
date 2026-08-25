FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY server/TeachersLessons.Api/TeachersLessons.Api.csproj server/TeachersLessons.Api/
RUN dotnet restore server/TeachersLessons.Api/TeachersLessons.Api.csproj
COPY server/TeachersLessons.Api/ server/TeachersLessons.Api/
WORKDIR /src/server/TeachersLessons.Api
RUN dotnet publish TeachersLessons.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TeachersLessons.Api.dll"]
