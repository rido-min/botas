using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Botas;

public class TenantInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class ChannelInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class TeamInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("aadGroupId")] public string? AadGroupId { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class MeetingInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class NotificationInfo
{
    [JsonPropertyName("alert")] public bool? Alert { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class TeamsChannelData
{
    [JsonPropertyName("tenant")] public TenantInfo? Tenant { get; set; }
    [JsonPropertyName("channel")] public ChannelInfo? Channel { get; set; }
    [JsonPropertyName("team")] public TeamInfo? Team { get; set; }
    [JsonPropertyName("meeting")] public MeetingInfo? Meeting { get; set; }
    [JsonPropertyName("notification")] public NotificationInfo? Notification { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class TeamsConversation : Conversation
{
    [JsonPropertyName("conversationType")] public string? ConversationType { get; set; }
    [JsonPropertyName("tenantId")] public string? TenantId { get; set; }
    [JsonPropertyName("isGroup")] public bool? IsGroup { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
}

/// <summary>
/// Teams-specific activity with strongly-typed channel data and helper methods.
/// </summary>
public class TeamsActivity : CoreActivity
{
    [JsonPropertyName("channelData")] public TeamsChannelData? ChannelData { get; set; }
    [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }
    [JsonPropertyName("localTimestamp")] public string? LocalTimestamp { get; set; }
    [JsonPropertyName("locale")] public string? Locale { get; set; }
    [JsonPropertyName("localTimezone")] public string? LocalTimezone { get; set; }
    [JsonPropertyName("suggestedActions")] public SuggestedActions? SuggestedActions { get; set; }

    public new string ToJson() => JsonSerializer.Serialize(this, DefaultJsonOptions);

    /// <summary>
    /// Creates a TeamsActivity from a CoreActivity, converting channel data and accounts.
    /// </summary>
    public static TeamsActivity FromActivity(CoreActivity activity)
    {
        ArgumentNullException.ThrowIfNull(activity);
        var json = activity.ToJson();
        return JsonSerializer.Deserialize<TeamsActivity>(json, DefaultJsonOptions)!;
    }

    /// <summary>
    /// Appends an entity to the Entities collection.
    /// </summary>
    public void AddEntity(Entity entity)
    {
        Entities ??= [];
        var entityJson = JsonSerializer.SerializeToNode(entity, DefaultJsonOptions);
        Entities.Add(entityJson);
    }

    /// <summary>
    /// Returns a new TeamsActivityBuilder.
    /// </summary>
    public static TeamsActivityBuilder CreateBuilder() => new();

    public static new TeamsActivity FromJsonString(string json)
        => JsonSerializer.Deserialize<TeamsActivity>(json, DefaultJsonOptions)!;

    public static new ValueTask<TeamsActivity?> FromJsonStreamAsync(Stream stream, CancellationToken cancellationToken = default)
        => JsonSerializer.DeserializeAsync<TeamsActivity>(stream, DefaultJsonOptions, cancellationToken);
}

/// <summary>
/// Fluent builder for constructing outbound <see cref="TeamsActivity"/> instances.
/// </summary>
public class TeamsActivityBuilder
{
    private readonly TeamsActivity _activity = new();

    /// <summary>
    /// Copy routing fields from an incoming activity and swap from/recipient.
    /// </summary>
    public TeamsActivityBuilder WithConversationReference(CoreActivity source)
    {
        _activity.ServiceUrl = source.ServiceUrl;
        _activity.Conversation = source.Conversation;
        _activity.From = source.Recipient;
        _activity.Recipient = source.From;
        return this;
    }

    /// <summary>Set the activity type (default is "message").</summary>
    public TeamsActivityBuilder WithType(string type)
    {
        _activity.Type = type;
        return this;
    }

    /// <summary>Set the service URL.</summary>
    public TeamsActivityBuilder WithServiceUrl(string serviceUrl)
    {
        _activity.ServiceUrl = serviceUrl;
        return this;
    }

    /// <summary>Set the conversation.</summary>
    public TeamsActivityBuilder WithConversation(Conversation conversation)
    {
        _activity.Conversation = conversation;
        return this;
    }

    /// <summary>Set the sender account.</summary>
    public TeamsActivityBuilder WithFrom(ChannelAccount from)
    {
        _activity.From = from;
        return this;
    }

    /// <summary>Set the recipient account.</summary>
    public TeamsActivityBuilder WithRecipient(ChannelAccount recipient)
    {
        _activity.Recipient = recipient;
        return this;
    }

    /// <summary>Set the text content.</summary>
    public TeamsActivityBuilder WithText(string text)
    {
        _activity.Text = text;
        return this;
    }

    /// <summary>Set the Teams-specific channel data.</summary>
    public TeamsActivityBuilder WithChannelData(TeamsChannelData? channelData)
    {
        _activity.ChannelData = channelData;
        return this;
    }

    /// <summary>Set the suggested actions.</summary>
    public TeamsActivityBuilder WithSuggestedActions(SuggestedActions? suggestedActions)
    {
        _activity.SuggestedActions = suggestedActions;
        return this;
    }

    /// <summary>Replace the entities array.</summary>
    public TeamsActivityBuilder WithEntities(JsonArray? entities)
    {
        _activity.Entities = entities;
        return this;
    }

    /// <summary>Replace the attachments array.</summary>
    public TeamsActivityBuilder WithAttachments(JsonArray? attachments)
    {
        _activity.Attachments = attachments;
        return this;
    }

    /// <summary>Append an entity to the collection.</summary>
    public TeamsActivityBuilder AddEntity(Entity entity)
    {
        _activity.AddEntity(entity);
        return this;
    }

    /// <summary>Append an attachment to the collection.</summary>
    public TeamsActivityBuilder AddAttachment(Attachment attachment)
    {
        _activity.Attachments ??= [];
        var attachmentJson = JsonSerializer.SerializeToNode(attachment, CoreActivity.DefaultJsonOptions);
        _activity.Attachments.Add(attachmentJson);
        return this;
    }

    /// <summary>
    /// Creates a mention entity for the account and adds it to entities.
    /// Does NOT modify the activity text.
    /// </summary>
    public TeamsActivityBuilder AddMention(ChannelAccount account, string? mentionText = null)
    {
        ArgumentNullException.ThrowIfNull(account);
        string text = mentionText ?? $"<at>{account.Name}</at>";
        var entity = new Entity { Type = "mention" };
        entity.Properties["mentioned"] = account;
        entity.Properties["text"] = text;
        _activity.AddEntity(entity);
        return this;
    }

    /// <summary>
    /// Parses JSON as an Adaptive Card and appends it as an attachment.
    /// </summary>
    public TeamsActivityBuilder AddAdaptiveCardAttachment(string cardJson)
    {
        var content = JsonSerializer.Deserialize<JsonElement>(cardJson);
        var attachment = new Attachment
        {
            ContentType = "application/vnd.microsoft.card.adaptive",
            Content = content
        };
        return AddAttachment(attachment);
    }

    /// <summary>
    /// Parses JSON as an Adaptive Card and sets it as the only attachment.
    /// </summary>
    public TeamsActivityBuilder WithAdaptiveCardAttachment(string cardJson)
    {
        var content = JsonSerializer.Deserialize<JsonElement>(cardJson);
        var attachment = new Attachment
        {
            ContentType = "application/vnd.microsoft.card.adaptive",
            Content = content
        };
        var node = JsonSerializer.SerializeToNode(attachment, CoreActivity.DefaultJsonOptions);
        _activity.Attachments = [node];
        return this;
    }

    /// <summary>Build the configured TeamsActivity.</summary>
    public TeamsActivity Build() => _activity;
}
