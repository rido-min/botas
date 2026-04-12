using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Botas.Tests
{
    public class UnitTest1
    {
        [Fact]
        public void TestAppIdPropertyReturnsConfiguredClientId()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new[] { new KeyValuePair<string, string?>("AzureAd:ClientId", "test-app-id") })
                .Build();

            var bot = new BotApplication(configuration, NullLogger<BotApplication>.Instance);

            Assert.Equal("test-app-id", bot.AppId);
        }
    }
}
