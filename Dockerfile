FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY server/TeachMe.Api/TeachMe.Api.csproj server/TeachMe.Api/
RUN dotnet restore server/TeachMe.Api/TeachMe.Api.csproj
COPY server/TeachMe.Api/ server/TeachMe.Api/
WORKDIR /src/server/TeachMe.Api
RUN dotnet publish TeachMe.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
# SQLite will create the .db file but not its parent directory.
RUN mkdir -p /app/data
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
# Web projects default to Server GC, which sizes its heaps per core and is the wrong trade on a
# free 512 MB instance. Workstation GC keeps the footprint well inside the limit.
ENV DOTNET_gcServer=0
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TeachMe.Api.dll"]
