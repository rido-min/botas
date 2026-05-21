using Botas;
using Botas.State;

var app = BotApp.Create(args);

// Register state middleware with FileStorage
app.UseState(new FileStorage("./state-data"));

// Register message handler
app.On("message", async (context, ct) =>
{
    var text = context.Activity.Text?.Trim() ?? "";

    // Handle special commands
    if (text.Equals("reset", StringComparison.OrdinalIgnoreCase))
    {
        context.State?.DeleteConversationState();
        await context.SendAsync("✅ Conversation state cleared. Counters reset.", ct);
        return;
    }

    if (text.Equals("whoami", StringComparison.OrdinalIgnoreCase))
    {
        var userMsgCount = context.State?.User.Get<int>("user_message_count") ?? 0;
        var userId = context.Activity.From?.Id ?? "unknown";
        await context.SendAsync($"👤 User ID: {userId}\n📊 Your message count: {userMsgCount}", ct);
        return;
    }

    // Increment conversation-scoped turn counter (shared across all users in conversation)
    var turnCount = context.State?.Conversation.Get<int>("turn_count") ?? 0;
    turnCount++;
    context.State?.Conversation.Set("turn_count", turnCount);

    // Increment user-scoped message counter (follows this user across all conversations)
    var userMessageCount = context.State?.User.Get<int>("user_message_count") ?? 0;
    userMessageCount++;
    context.State?.User.Set("user_message_count", userMessageCount);

    // Use temp scope for the formatted reply (not persisted)
    var reply = $"🔢 Turn #{turnCount} | 💬 Your message #{userMessageCount}\n📝 You said: {text}";
    context.State?.Temp.Set("formatted_reply", reply);

    var finalReply = context.State?.Temp.Get<string>("formatted_reply") ?? "Error formatting reply";
    await context.SendAsync(finalReply, ct);
});

app.Run();
