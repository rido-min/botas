namespace Botas.Tests;

/// <summary>
/// Tests for PostHog telemetry. Telemetry is disabled by default unless POSTHOG_API_KEY is set.
/// These tests verify that telemetry can be safely called without crashing when disabled.
/// </summary>
public class PostHogTelemetryTests
{
    [Fact]
    public void TrackEvent_WithoutApiKey_DoesNotThrow()
    {
        // Arrange: ensure POSTHOG_API_KEY is not set
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert: telemetry should be no-op and not throw
        var props = new Dictionary<string, object>
        {
            ["test_property"] = "test_value"
        };

        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackEvent("test/event", props));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackBotStarted_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);
        var bot = new BotApplication();

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackBotStarted(bot));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackActivityReceived_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackActivityReceived("message", true, "emulator"));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackHandlerDispatched_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackHandlerDispatched("message", "type", 100));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackHandlerError_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackHandlerError("message", "InvalidOperationException"));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackOutboundSent_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackOutboundSent("send", true));

        Assert.Null(exception);
    }

    [Fact]
    public void Shutdown_WithoutApiKey_DoesNotThrow()
    {
        // Arrange
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", null);

        // Act & Assert
        var exception = Record.Exception(() =>
            PostHogTelemetry.Shutdown());

        Assert.Null(exception);
    }

    [Fact]
    public void TrackEvent_WithEmptyApiKey_DoesNotThrow()
    {
        // Arrange: empty API key should also disable telemetry
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", "");

        // Act & Assert
        var props = new Dictionary<string, object>
        {
            ["test_property"] = "test_value"
        };

        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackEvent("test/event", props));

        Assert.Null(exception);
    }

    [Fact]
    public void TrackEvent_WithWhitespaceApiKey_DoesNotThrow()
    {
        // Arrange: whitespace API key should also disable telemetry
        Environment.SetEnvironmentVariable("POSTHOG_API_KEY", "   ");

        // Act & Assert
        var props = new Dictionary<string, object>
        {
            ["test_property"] = "test_value"
        };

        var exception = Record.Exception(() =>
            PostHogTelemetry.TrackEvent("test/event", props));

        Assert.Null(exception);
    }
}
