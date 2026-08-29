using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TeachMe.Api.Features.Helper.Services;

namespace TeachMe.Api.Tests.TestSupport;

/// <summary>
/// The app with the AI path wired: a key is present, so ServiceRegistration composes
/// AiHelperService over HelperService — then the vendor implementation behind it is swapped for
/// <see cref="FakeAnswerModel"/>. The key is never used, because nothing reaches Gemini.
/// TimeoutSeconds is 1 so the timeout test costs a second rather than six.
/// </summary>
public class AiApiFactory : ApiFactory
{
    public FakeAnswerModel Model { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);

        // UseSetting, not ConfigureAppConfiguration: under minimal hosting the app reads
        // builder.Configuration while composing services, which is before the factory's
        // configuration callbacks run. UseSetting lands in the host configuration early enough
        // for ServiceRegistration to see the key at all.
        builder.UseSetting("Ai:Enabled", "true");
        builder.UseSetting("Ai:ApiKey", "not-a-real-key-nothing-here-calls-google");
        builder.UseSetting("Ai:TimeoutSeconds", "1");
        builder.UseSetting("Ai:MaxQuestionLength", "300");
        builder.UseSetting("Ai:RateLimitPerMinute", "6");
        builder.UseSetting("Ai:RateLimitPerDay", "60");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IAnswerModel>();
            services.AddSingleton<IAnswerModel>(Model);
        });
    }
}
