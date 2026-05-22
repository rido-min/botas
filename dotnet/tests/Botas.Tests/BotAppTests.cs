using Botas.State;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for BotApp wrapper functionality.
/// </summary>
public class BotAppTests
{
    [Fact]
    public void UseState_RegistersStateMiddleware_AndReturnsThis()
    {
        // Arrange
        var app = BotApp.Create(args: null, routePath: "api/messages");
        var storage = new MemoryStorage();

        // Act
        var result = app.UseState(storage);

        // Assert
        Assert.Same(app, result); // Should return this for fluent chaining
    }

    [Fact]
    public void UseState_CanBeChainedWithOtherMethods()
    {
        // Arrange
        var app = BotApp.Create(args: null, routePath: "api/messages");
        var storage = new MemoryStorage();
        var handlerInvoked = false;

        // Act - Chain UseState with On handler registration
        var result = app
            .UseState(storage)
            .On("message", async (ctx, ct) => 
            {
                handlerInvoked = true;
                await Task.CompletedTask;
            });

        // Assert
        Assert.Same(app, result); // Should maintain fluent API
    }
}
