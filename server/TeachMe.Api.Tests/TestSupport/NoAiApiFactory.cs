using Microsoft.AspNetCore.Hosting;

namespace TeachMe.Api.Tests.TestSupport;

/// <summary>
/// The app as it ships with no key: ServiceRegistration never composes the AI path at all, so the
/// helper is HelperService and nothing else. Ai:ApiKey is blanked explicitly rather than merely
/// left unset, so a developer with Ai__ApiKey in their environment still runs this test against
/// the behaviour it is named for.
/// </summary>
public class NoAiApiFactory : ApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);

        builder.UseSetting("Ai:ApiKey", string.Empty);
    }
}
