using System.Diagnostics;

namespace Botas.Tests;

[Collection("ActivitySource")]
public class BotActivitySourceTests
{
    [Fact]
    public void Source_IsNotNull()
    {
        Assert.NotNull(BotActivitySource.Source);
    }

    [Fact]
    public void Source_NameIsBotas()
    {
        Assert.Equal("botas", BotActivitySource.Source.Name);
    }

    [Fact]
    public void StartActivity_ReturnsNull_WhenNoListenerConfigured()
    {
        // Without an ActivityListener, StartActivity returns null (built-in no-op)
        var activity = BotActivitySource.Source.StartActivity("test-no-listener");
        Assert.Null(activity);
    }

    [Fact]
    public void StartActivity_ReturnsActivity_WhenListenerConfigured()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "botas",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
        };
        ActivitySource.AddActivityListener(listener);

        using var activity = BotActivitySource.Source.StartActivity("test-with-listener");
        Assert.NotNull(activity);
        Assert.Equal("test-with-listener", activity.OperationName);
    }
}
