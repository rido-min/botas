using Xunit;

namespace Botas.Tests
{
    public class InvokeActivityTests
    {
        private static CoreActivity MakeInvokeActivity(string? name = null) => new("invoke")
        {
            ServiceUrl = "http://service.url",
            From = new ChannelAccount { Id = "user1" },
            Recipient = new ChannelAccount { Id = "bot1" },
            Conversation = new Conversation { Id = "conv1" },
            Name = name,
        };

        [Fact]
        public async Task DispatchInvoke_ReturnsHandlerResponse_WhenHandlerRegistered()
        {
            var bot = new BotApplication();
            bot.OnInvoke("adaptiveCard/action", (ctx, ct) =>
                Task.FromResult(new InvokeResponse { Status = 200, Body = new { ok = true } }));

            var activity = MakeInvokeActivity("adaptiveCard/action");
            var context = new TurnContext(bot, activity);

            var response = await bot.DispatchInvokeHandler(context, CancellationToken.None);

            Assert.Equal(200, response.Status);
            Assert.NotNull(response.Body);
        }

        [Fact]
        public async Task DispatchInvoke_Returns501_WhenNoHandlerRegistered()
        {
            var bot = new BotApplication();
            var activity = MakeInvokeActivity("task/fetch");
            var context = new TurnContext(bot, activity);

            var response = await bot.DispatchInvokeHandler(context, CancellationToken.None);

            Assert.Equal(501, response.Status);
        }

        [Fact]
        public async Task DispatchInvoke_Returns501_WhenActivityHasNoName()
        {
            var bot = new BotApplication();
            var activity = MakeInvokeActivity(name: null);
            var context = new TurnContext(bot, activity);

            var response = await bot.DispatchInvokeHandler(context, CancellationToken.None);

            Assert.Equal(501, response.Status);
        }

        [Fact]
        public async Task DispatchInvoke_ReplacesHandler_OnDuplicateName()
        {
            var bot = new BotApplication();
            var calls = new List<string>();

            bot.OnInvoke("task/fetch", (ctx, ct) =>
            {
                calls.Add("first");
                return Task.FromResult(new InvokeResponse { Status = 200 });
            });
            bot.OnInvoke("task/fetch", (ctx, ct) =>
            {
                calls.Add("second");
                return Task.FromResult(new InvokeResponse { Status = 200 });
            });

            var activity = MakeInvokeActivity("task/fetch");
            var context = new TurnContext(bot, activity);

            await bot.DispatchInvokeHandler(context, CancellationToken.None);

            Assert.Equal(new[] { "second" }, calls);
        }

        [Fact]
        public async Task DispatchInvoke_WrapsThrownExceptionInBotHandlerException()
        {
            var bot = new BotApplication();
            var cause = new InvalidOperationException("invoke boom");
            bot.OnInvoke("task/submit", (ctx, ct) => throw cause);

            var activity = MakeInvokeActivity("task/submit");
            var context = new TurnContext(bot, activity);

            var ex = await Assert.ThrowsAsync<BotHandlerException>(
                () => bot.DispatchInvokeHandler(context, CancellationToken.None));

            Assert.Same(cause, ex.InnerException);
            Assert.Same(activity, ex.Activity);
        }

        [Fact]
        public void CoreActivity_Name_RoundTrips_ThroughJson()
        {
            var json = """{"type":"invoke","serviceUrl":"http://s","conversation":{"id":"c"},"name":"adaptiveCard/action","value":{"choice":"a"}}""";
            var activity = CoreActivity.FromJsonString(json);

            Assert.Equal("invoke", activity.Type);
            Assert.Equal("adaptiveCard/action", activity.Name);
            Assert.NotNull(activity.Value);
        }

        [Fact]
        public void InvokeResponse_CanBeConstructed()
        {
            var response = new InvokeResponse { Status = 200, Body = new { foo = "bar" } };
            Assert.Equal(200, response.Status);
            Assert.NotNull(response.Body);
        }

        [Fact]
        public void OnInvoke_ReturnsBotApplication_ForChaining()
        {
            var bot = new BotApplication();
            var result = bot.OnInvoke("task/fetch", (ctx, ct) =>
                Task.FromResult(new InvokeResponse { Status = 200 }));
            Assert.Same(bot, result);
        }
    }
}
