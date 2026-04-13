using System.Text.Json;

namespace Botas.Tests;

public class TeamsActivityTests
{
    [Fact]
    public void FromActivity_CopiesBasicFields()
    {
        var core = new CoreActivity
        {
            Type = "message",
            Text = "hello",
            ServiceUrl = "http://service.url",
            From = new ChannelAccount { Id = "user1", Name = "User One" },
            Recipient = new ChannelAccount { Id = "bot1", Name = "Bot One" },
            Conversation = new Conversation { Id = "conv1" }
        };
        var teams = TeamsActivity.FromActivity(core);
        Assert.Equal("message", teams.Type);
        Assert.Equal("hello", teams.Text);
        Assert.Equal("http://service.url", teams.ServiceUrl);
        Assert.Equal("user1", teams.From?.Id);
        Assert.Equal("bot1", teams.Recipient?.Id);
        Assert.Equal("conv1", teams.Conversation?.Id);
    }

    [Fact]
    public void FromActivity_ThrowsOnNull()
    {
        Assert.Throws<ArgumentNullException>(() => TeamsActivity.FromActivity(null!));
    }

    [Fact]
    public void Deserialize_TeamsSpecificFields()
    {
        string json = """
        {
            "type": "message",
            "text": "hello",
            "timestamp": "2024-01-01T00:00:00Z",
            "localTimestamp": "2024-01-01T00:00:00-08:00",
            "locale": "en-US",
            "localTimezone": "America/Los_Angeles",
            "channelData": {
                "tenant": { "id": "tenant-123" },
                "channel": { "id": "channel-456", "name": "General" },
                "team": { "id": "team-789", "name": "My Team", "aadGroupId": "group-abc" }
            },
            "suggestedActions": {
                "to": ["user1"],
                "actions": [
                    { "type": "imBack", "title": "Yes", "value": "yes" }
                ]
            }
        }
        """;
        var act = TeamsActivity.FromJsonString(json);
        Assert.Equal("message", act.Type);
        Assert.Equal("hello", act.Text);
        Assert.Equal("2024-01-01T00:00:00Z", act.Timestamp);
        Assert.Equal("en-US", act.Locale);
        Assert.Equal("America/Los_Angeles", act.LocalTimezone);
        Assert.NotNull(act.ChannelData);
        Assert.Equal("tenant-123", act.ChannelData!.Tenant?.Id);
        Assert.Equal("channel-456", act.ChannelData.Channel?.Id);
        Assert.Equal("General", act.ChannelData.Channel?.Name);
        Assert.Equal("team-789", act.ChannelData.Team?.Id);
        Assert.Equal("group-abc", act.ChannelData.Team?.AadGroupId);
        Assert.NotNull(act.SuggestedActions);
        Assert.Single(act.SuggestedActions!.Actions);
        Assert.Equal("imBack", act.SuggestedActions.Actions[0].Type);
        Assert.Equal("Yes", act.SuggestedActions.Actions[0].Title);
    }

    [Fact]
    public void Serialize_OmitsNullTeamsFields()
    {
        var act = new TeamsActivity { Text = "hi" };
        string json = act.ToJson();
        Assert.DoesNotContain("channelData", json);
        Assert.DoesNotContain("timestamp", json);
        Assert.DoesNotContain("suggestedActions", json);
    }

    [Fact]
    public void Serialize_IncludesTeamsFields()
    {
        var act = new TeamsActivity
        {
            Text = "hi",
            Locale = "en-US",
            ChannelData = new TeamsChannelData
            {
                Tenant = new TenantInfo { Id = "t1" }
            }
        };
        string json = act.ToJson();
        Assert.Contains("\"locale\": \"en-US\"", json);
        Assert.Contains("\"channelData\"", json);
        Assert.Contains("\"tenant\"", json);
        Assert.Contains("\"id\": \"t1\"", json);
    }

    [Fact]
    public void ChannelData_PreservesUnknownFields()
    {
        string json = """
        {
            "type": "message",
            "channelData": {
                "tenant": { "id": "t1" },
                "customField": "custom-value"
            }
        }
        """;
        var act = TeamsActivity.FromJsonString(json);
        Assert.NotNull(act.ChannelData);
        Assert.Equal("t1", act.ChannelData!.Tenant?.Id);
        Assert.True(act.ChannelData.Properties.ContainsKey("customField"));
    }

    [Fact]
    public void TeamsChannelAccount_Deserialization()
    {
        string json = """
        {
            "id": "user1",
            "name": "User One",
            "email": "user@example.com",
            "userPrincipalName": "user@contoso.com"
        }
        """;
        var account = JsonSerializer.Deserialize<TeamsChannelAccount>(json, CoreActivity.DefaultJsonOptions);
        Assert.NotNull(account);
        Assert.Equal("user1", account!.Id);
        Assert.Equal("User One", account.Name);
        Assert.Equal("user@example.com", account.Email);
        Assert.Equal("user@contoso.com", account.UserPrincipalName);
    }

    [Fact]
    public void TeamsConversation_Deserialization()
    {
        string json = """
        {
            "id": "conv1",
            "conversationType": "personal",
            "tenantId": "tenant-123",
            "isGroup": false,
            "name": "Chat"
        }
        """;
        var conv = JsonSerializer.Deserialize<TeamsConversation>(json, CoreActivity.DefaultJsonOptions);
        Assert.NotNull(conv);
        Assert.Equal("conv1", conv!.Id);
        Assert.Equal("personal", conv.ConversationType);
        Assert.Equal("tenant-123", conv.TenantId);
        Assert.False(conv.IsGroup);
        Assert.Equal("Chat", conv.Name);
    }
}
