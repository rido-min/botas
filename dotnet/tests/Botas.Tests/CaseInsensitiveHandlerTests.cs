using Xunit;

namespace Botas.Tests;

public class CaseInsensitiveHandlerTests
{
    [Fact]
    public async Task Handler_RegisteredWithUppercase_MatchesLowercaseActivityType()
    {
        var bot = new BotApplication();
        var handlerCalled = false;

        bot.On("Message", (ctx, ct) =>
        {
            handlerCalled = true;
            return Task.CompletedTask;
        });

        var activity = new CoreActivity("message") { Text = "hello" };
        var context = new TurnContext(bot, activity);

        await bot.DispatchToHandler(context, CancellationToken.None);

        Assert.True(handlerCalled, "Handler registered as 'Message' should match activity type 'message'");
    }

    [Fact]
    public async Task Handler_RegisteredWithLowercase_MatchesMixedCaseActivityType()
    {
        var bot = new BotApplication();
        var handlerCalled = false;

        bot.On("typing", (ctx, ct) =>
        {
            handlerCalled = true;
            return Task.CompletedTask;
        });

        var activity = new CoreActivity("Typing");
        var context = new TurnContext(bot, activity);

        await bot.DispatchToHandler(context, CancellationToken.None);

        Assert.True(handlerCalled, "Handler registered as 'typing' should match activity type 'Typing'");
    }

    [Fact]
    public async Task Handler_CaseInsensitive_SecondRegistrationReplaceFirst()
    {
        var bot = new BotApplication();
        var firstCalled = false;
        var secondCalled = false;

        bot.On("message", (ctx, ct) =>
        {
            firstCalled = true;
            return Task.CompletedTask;
        });

        bot.On("MESSAGE", (ctx, ct) =>
        {
            secondCalled = true;
            return Task.CompletedTask;
        });

        var activity = new CoreActivity("Message") { Text = "test" };
        var context = new TurnContext(bot, activity);

        await bot.DispatchToHandler(context, CancellationToken.None);

        Assert.False(firstCalled, "First handler should have been replaced by second registration with different casing");
        Assert.True(secondCalled, "Second handler should be called since it replaced the first");
    }
}
