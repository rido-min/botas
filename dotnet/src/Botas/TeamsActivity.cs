using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Microsoft Teams tenant information from channel data.
/// </summary>
public class TenantInfo
{
    /// <summary>The Azure AD tenant ID.</summary>
    [JsonPropertyName("id")] public string? Id { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Information about a Microsoft Teams channel.
/// </summary>
public class ChannelInfo
{
    /// <summary>Unique identifier for the Teams channel.</summary>
    [JsonPropertyName("id")] public string? Id { get; set; }

    /// <summary>Display name of the Teams channel.</summary>
    [JsonPropertyName("name")] public string? Name { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Information about a Microsoft Teams team.
/// </summary>
public class TeamInfo
{
    /// <summary>Unique identifier for the team.</summary>
    [JsonPropertyName("id")] public string? Id { get; set; }

    /// <summary>Display name of the team.</summary>
    [JsonPropertyName("name")] public string? Name { get; set; }

    /// <summary>The Azure AD group ID associated with this team.</summary>
    [JsonPropertyName("aadGroupId")] public string? AadGroupId { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Information about a Microsoft Teams meeting.
/// </summary>
public class MeetingInfo
{
    /// <summary>Unique identifier for the meeting.</summary>
    [JsonPropertyName("id")] public string? Id { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Notification settings for a Teams activity.
/// </summary>
public class NotificationInfo
{
    /// <summary>When <c>true</c>, the activity triggers an alert/notification in the Teams client.</summary>
    [JsonPropertyName("alert")] public bool? Alert { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Teams-specific channel data containing tenant, channel, team, meeting, and notification information.
/// Deserialized from the <c>channelData</c> property of a Teams activity.
/// </summary>
public class TeamsChannelData
{
    /// <summary>Tenant information for the Teams context.</summary>
    [JsonPropertyName("tenant")] public TenantInfo? Tenant { get; set; }

    /// <summary>Channel information (present when the activity occurs in a channel).</summary>
    [JsonPropertyName("channel")] public ChannelInfo? Channel { get; set; }

    /// <summary>Team information (present when the activity occurs within a team).</summary>
    [JsonPropertyName("team")] public TeamInfo? Team { get; set; }

    /// <summary>Meeting information (present when the activity occurs during a meeting).</summary>
    [JsonPropertyName("meeting")] public MeetingInfo? Meeting { get; set; }

    /// <summary>Notification settings for this activity.</summary>
    [JsonPropertyName("notification")] public NotificationInfo? Notification { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// A Teams-specific conversation that extends <see cref="Conversation"/> with Teams metadata
/// such as conversation type, tenant ID, and group indicator.
/// </summary>
public class TeamsConversation : Conversation
{
    /// <summary>The type of Teams conversation (e.g. <c>"personal"</c>, <c>"groupChat"</c>, <c>"channel"</c>).</summary>
    [JsonPropertyName("conversationType")] public string? ConversationType { get; set; }

    /// <summary>The Azure AD tenant ID for this conversation.</summary>
    [JsonPropertyName("tenantId")] public string? TenantId { get; set; }

    /// <summary>Whether this is a group conversation.</summary>
    [JsonPropertyName("isGroup")] public bool? IsGroup { get; set; }

    /// <summary>Display name of the conversation.</summary>
    [JsonPropertyName("name")] public string? Name { get; set; }
}

/// <summary>
/// Teams-specific activity with strongly-typed channel data and helper methods.
/// </summary>
public class TeamsActivity : CoreActivity
{
    /// <summary>Teams-specific channel data (tenant, channel, team, meeting, notification).</summary>
    [JsonPropertyName("channelData")] [JsonInclude] public TeamsChannelData? ChannelData { get; set; }

    /// <summary>UTC timestamp when the activity was sent.</summary>
    [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }

    /// <summary>Local timestamp when the activity was sent, including timezone offset.</summary>
    [JsonPropertyName("localTimestamp")] public string? LocalTimestamp { get; set; }

    /// <summary>Locale of the client (e.g. <c>"en-US"</c>).</summary>
    [JsonPropertyName("locale")] public string? Locale { get; set; }

    /// <summary>IANA timezone name of the client (e.g. <c>"America/Los_Angeles"</c>).</summary>
    [JsonPropertyName("localTimezone")] public string? LocalTimezone { get; set; }

    /// <summary>Suggested actions to present to the user as quick-reply buttons.</summary>
    [JsonPropertyName("suggestedActions")] public SuggestedActions? SuggestedActions { get; set; }

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

    /// <summary>Deserializes a <see cref="TeamsActivity"/> from a JSON string.</summary>
    /// <param name="json">The JSON string to deserialize.</param>
    /// <returns>The deserialized Teams activity.</returns>
    public static new TeamsActivity FromJsonString(string json)
        => JsonSerializer.Deserialize<TeamsActivity>(json, DefaultJsonOptions)!;

    /// <summary>Asynchronously deserializes a <see cref="TeamsActivity"/> from a JSON stream.</summary>
    /// <param name="stream">The stream containing the JSON payload.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>The deserialized Teams activity, or <c>null</c> if the stream contains a JSON null.</returns>
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
        return AddAdaptiveCardAttachment(content);
    }

    /// <summary>
    /// Appends a pre-parsed Adaptive Card as an attachment, avoiding double serialization.
    /// </summary>
    public TeamsActivityBuilder AddAdaptiveCardAttachment(JsonElement content)
    {
        var attachment = new Attachment
        {
            ContentType = "application/vnd.microsoft.card.adaptive",
            Content = content.Clone()
        };
        return AddAttachment(attachment);
    }

    /// <summary>
    /// Parses JSON as an Adaptive Card and sets it as the only attachment.
    /// </summary>
    public TeamsActivityBuilder WithAdaptiveCardAttachment(string cardJson)
    {
        var content = JsonSerializer.Deserialize<JsonElement>(cardJson);
        return WithAdaptiveCardAttachment(content);
    }

    /// <summary>
    /// Sets a pre-parsed Adaptive Card as the only attachment, avoiding double serialization.
    /// </summary>
    public TeamsActivityBuilder WithAdaptiveCardAttachment(JsonElement content)
    {
        var attachment = new Attachment
        {
            ContentType = "application/vnd.microsoft.card.adaptive",
            Content = content.Clone()
        };
        var node = JsonSerializer.SerializeToNode(attachment, CoreActivity.DefaultJsonOptions);
        _activity.Attachments = [node];
        return this;
    }

    /// <summary>Build the configured TeamsActivity.</summary>
    public TeamsActivity Build() => _activity;
}
